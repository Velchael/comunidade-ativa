const { randomUUID } = require('node:crypto');
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const REQUIRED_CONFIG = ['AWS_REGION', 'COMUVA_S3_BUCKET', 'COMUVA_S3_PREFIX'];
const DEFAULT_MEDIA_URL_TTL_SECONDS = 3600;
const MAX_PRESIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_SIGNED_URL_CACHE_MAX_ENTRIES = 1000;

const readS3Config = (env = process.env) => {
  const missing = REQUIRED_CONFIG.filter((name) => !env[name]?.trim());
  if (missing.length) {
    const error = new Error(`Configuração S3 ausente: ${missing.join(', ')}`);
    error.code = 'S3_CONFIG_ERROR';
    throw error;
  }

  const configuredTtl = env.COMUVA_MEDIA_URL_TTL_SECONDS?.trim();
  const ttlSeconds = configuredTtl
    ? Number(configuredTtl)
    : DEFAULT_MEDIA_URL_TTL_SECONDS;

  if (
    !Number.isInteger(ttlSeconds)
    || ttlSeconds <= 0
    || ttlSeconds > MAX_PRESIGNED_URL_TTL_SECONDS
  ) {
    const error = new Error('COMUVA_MEDIA_URL_TTL_SECONDS deve ser um inteiro entre 1 e 604800');
    error.code = 'S3_CONFIG_ERROR';
    throw error;
  }

  return {
    region: env.AWS_REGION.trim(),
    bucket: env.COMUVA_S3_BUCKET.trim(),
    prefix: env.COMUVA_S3_PREFIX.trim().replace(/^\/+|\/+$/g, ''),
    ttlSeconds
  };
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MANAGED_AVATAR_UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const MANAGED_IMAGE_UUID = MANAGED_AVATAR_UUID;
const MANAGED_IMAGE_EXTENSIONS = new Set(['jpg', 'png', 'webp']);

const normalizePositiveIntegerId = (value) => {
  const normalized = String(value);
  return /^\d+$/.test(normalized) && normalized !== '0' ? normalized : null;
};

const normalizeImageExtension = (extension) => {
  const normalized = String(extension || '').toLowerCase();
  return MANAGED_IMAGE_EXTENSIONS.has(normalized) ? normalized : null;
};

const isManagedProfilePhotoKey = ({ key, prefix }) => {
  if (typeof key !== 'string' || /^https?:\/\//i.test(key)) return false;

  const normalizedPrefix = String(prefix).replace(/^\/+|\/+$/g, '');
  const pattern = new RegExp(
    `^${escapeRegExp(normalizedPrefix)}/profiles/users/[1-9]\\d*/${MANAGED_AVATAR_UUID}\\.(?:jpg|png|webp)$`,
    'i'
  );

  return pattern.test(key);
};

const buildInteractionImageKey = ({ interactionId, extension, prefix, uuidFactory = randomUUID }) => {
  const normalizedInteractionId = normalizePositiveIntegerId(interactionId);
  if (!normalizedInteractionId) {
    const error = new Error('Interação inválida');
    error.code = 'INVALID_INTERACTION';
    throw error;
  }

  const normalizedExtension = normalizeImageExtension(extension);
  if (!normalizedExtension) {
    const error = new Error('Extensão de imagem não permitida');
    error.code = 'INVALID_IMAGE_EXTENSION';
    throw error;
  }

  const normalizedPrefix = String(prefix).replace(/^\/+|\/+$/g, '');
  return `${normalizedPrefix}/interactions/${normalizedInteractionId}/${uuidFactory()}.${normalizedExtension}`;
};

const isManagedInteractionImageKey = ({ key, interactionId, prefix }) => {
  if (typeof key !== 'string' || /^https?:\/\//i.test(key)) return false;

  const normalizedInteractionId = normalizePositiveIntegerId(interactionId);
  if (!normalizedInteractionId) return false;

  const normalizedPrefix = String(prefix).replace(/^\/+|\/+$/g, '');
  const pattern = new RegExp(
    `^${escapeRegExp(normalizedPrefix)}/interactions/${normalizedInteractionId}/${MANAGED_IMAGE_UUID}\\.(?:jpg|png|webp)$`,
    'i'
  );

  return pattern.test(key);
};

const isManagedInteractionImageReadKey = ({ key, prefix }) => {
  if (typeof key !== 'string' || /^https?:\/\//i.test(key)) return false;

  const normalizedPrefix = String(prefix).replace(/^\/+|\/+$/g, '');
  const pattern = new RegExp(
    `^${escapeRegExp(normalizedPrefix)}/interactions/[1-9]\\d*/${MANAGED_IMAGE_UUID}\\.(?:jpg|png|webp)$`,
    'i'
  );

  return pattern.test(key);
};

const isManagedUserAvatarKey = ({ key, userId, prefix }) => {
  if (typeof key !== 'string' || /^https?:\/\//i.test(key)) return false;

  const normalizedUserId = normalizePositiveIntegerId(userId);
  if (!normalizedUserId) return false;

  const normalizedPrefix = String(prefix).replace(/^\/+|\/+$/g, '');
  const pattern = new RegExp(
    `^${escapeRegExp(normalizedPrefix)}/profiles/users/${normalizedUserId}/${MANAGED_AVATAR_UUID}\\.(?:jpg|png|webp)$`,
    'i'
  );

  return pattern.test(key);
};

const getSignedUrlReuseMarginMs = (ttlSeconds) => {
  const ttlMs = ttlSeconds * 1000;
  return Math.min(60 * 1000, Math.floor(ttlMs * 0.1));
};

const createSignedUrlCache = ({
  ttlSeconds,
  maxEntries = DEFAULT_SIGNED_URL_CACHE_MAX_ENTRIES,
  now = Date.now
}) => {
  const entries = new Map();
  const reuseMarginMs = getSignedUrlReuseMarginMs(ttlSeconds);

  const pruneExpired = () => {
    const currentTime = now();

    for (const [key, entry] of entries) {
      if (entry.expiresAt <= currentTime) {
        entries.delete(key);
      }
    }
  };

  const enforceMaxEntries = () => {
    pruneExpired();

    while (entries.size > maxEntries) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey === undefined) return;
      entries.delete(oldestKey);
    }
  };

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return null;

      const currentTime = now();
      if (entry.expiresAt <= currentTime) {
        entries.delete(key);
        return null;
      }

      if (entry.expiresAt - currentTime <= reuseMarginMs) {
        return null;
      }

      return entry.url;
    },

    set(key, url) {
      entries.delete(key);
      entries.set(key, {
        url,
        expiresAt: now() + ttlSeconds * 1000
      });
      enforceMaxEntries();
    },

    delete(key) {
      entries.delete(key);
    },

    pruneExpired,

    size() {
      pruneExpired();
      return entries.size;
    }
  };
};

const createS3Service = ({
  client,
  bucket,
  prefix,
  ttlSeconds = DEFAULT_MEDIA_URL_TTL_SECONDS,
  presign = getSignedUrl,
  uuidFactory = randomUUID,
  now = Date.now,
  maxSignedUrlCacheEntries = DEFAULT_SIGNED_URL_CACHE_MAX_ENTRIES
}) => {
  const signedUrlCache = createSignedUrlCache({
    ttlSeconds,
    maxEntries: maxSignedUrlCacheEntries,
    now
  });

  const getCachedSignedReadUrl = async (key) => {
    const cachedUrl = signedUrlCache.get(key);
    if (cachedUrl) return cachedUrl;

    const url = await presign(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: ttlSeconds }
    );
    signedUrlCache.set(key, url);

    return url;
  };

  return {
    buildInteractionImageKey({ interactionId, extension }) {
      return buildInteractionImageKey({
        interactionId,
        extension,
        prefix,
        uuidFactory
      });
    },

    async uploadUserAvatar({ userId, buffer, contentType, extension }) {
      const normalizedUserId = normalizePositiveIntegerId(userId);
      if (!normalizedUserId) {
        const error = new Error('Identidade autenticada inválida');
        error.code = 'INVALID_AUTHENTICATED_USER';
        throw error;
      }

      const key = `${prefix}/profiles/users/${normalizedUserId}/${uuidFactory()}.${extension}`;
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType
      });
      await client.send(command);

      return { key };
    },

    async uploadInteractionImage({ interactionId, buffer, contentType, extension }) {
      const key = buildInteractionImageKey({
        interactionId,
        extension,
        prefix,
        uuidFactory
      });
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType
      });
      await client.send(command);

      return { key };
    },

    isManagedUserAvatarKey({ key, userId }) {
      return isManagedUserAvatarKey({ key, userId, prefix });
    },

    isManagedProfilePhotoKey(key) {
      return isManagedProfilePhotoKey({ key, prefix });
    },

    isManagedInteractionImageKey({ key, interactionId }) {
      return isManagedInteractionImageKey({ key, interactionId, prefix });
    },

    async getSignedReadUrl(key) {
      if (
        !isManagedProfilePhotoKey({ key, prefix })
        && !isManagedInteractionImageReadKey({ key, prefix })
      ) {
        const error = new Error('A referência não é uma key de foto gerenciada');
        error.code = 'UNMANAGED_S3_KEY';
        throw error;
      }

      return getCachedSignedReadUrl(key);
    },

    async getSignedInteractionImageUrl({ key, interactionId }) {
      if (!isManagedInteractionImageKey({ key, interactionId, prefix })) {
        const error = new Error('A key não pertence à imagem gerenciada desta interação');
        error.code = 'UNMANAGED_S3_KEY';
        throw error;
      }

      return getCachedSignedReadUrl(key);
    },

    async deleteUserAvatar({ key, userId }) {
      if (!isManagedUserAvatarKey({ key, userId, prefix })) {
        const error = new Error('A key não pertence ao avatar gerenciado deste usuário');
        error.code = 'UNMANAGED_S3_KEY';
        throw error;
      }

      await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
      }));
      signedUrlCache.delete(key);
    },

    async deleteInteractionImage({ key, interactionId }) {
      if (!isManagedInteractionImageKey({ key, interactionId, prefix })) {
        const error = new Error('A key não pertence à imagem gerenciada desta interação');
        error.code = 'UNMANAGED_S3_KEY';
        throw error;
      }

      await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
      }));
      signedUrlCache.delete(key);
    },

    getSignedUrlCacheSize() {
      return signedUrlCache.size();
    }
  };
};

let defaultService;

const getS3Service = () => {
  if (!defaultService) {
    const config = readS3Config();
    defaultService = createS3Service({
      client: new S3Client({ region: config.region }),
      bucket: config.bucket,
      prefix: config.prefix,
      ttlSeconds: config.ttlSeconds
    });
  }

  return defaultService;
};

const uploadUserAvatar = (params) => getS3Service().uploadUserAvatar(params);
const uploadInteractionImage = (params) => getS3Service().uploadInteractionImage(params);
const deleteUserAvatar = (params) => getS3Service().deleteUserAvatar(params);
const deleteInteractionImage = (params) => getS3Service().deleteInteractionImage(params);
const isManagedAvatar = (params) => getS3Service().isManagedUserAvatarKey(params);
const isManagedProfilePhoto = (key) => getS3Service().isManagedProfilePhotoKey(key);
const isManagedInteractionImage = (params) => getS3Service().isManagedInteractionImageKey(params);
const getSignedReadUrl = (key) => getS3Service().getSignedReadUrl(key);
const getSignedInteractionImageUrl = (params) => (
  getS3Service().getSignedInteractionImageUrl(params)
);

module.exports = {
  buildInteractionImageKey,
  createS3Service,
  deleteInteractionImage,
  deleteUserAvatar,
  getSignedInteractionImageUrl,
  getSignedReadUrl,
  isManagedInteractionImage,
  isManagedInteractionImageKey,
  isManagedProfilePhoto,
  isManagedProfilePhotoKey,
  isManagedUserAvatarKey,
  isManagedAvatar,
  readS3Config,
  uploadInteractionImage,
  uploadUserAvatar
};
