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

const isManagedProfilePhotoKey = ({ key, prefix }) => {
  if (typeof key !== 'string' || /^https?:\/\//i.test(key)) return false;

  const normalizedPrefix = String(prefix).replace(/^\/+|\/+$/g, '');
  const pattern = new RegExp(
    `^${escapeRegExp(normalizedPrefix)}/profiles/users/[1-9]\\d*/${MANAGED_AVATAR_UUID}\\.(?:jpg|png|webp)$`,
    'i'
  );

  return pattern.test(key);
};

const isManagedUserAvatarKey = ({ key, userId, prefix }) => {
  if (typeof key !== 'string' || /^https?:\/\//i.test(key)) return false;

  const normalizedUserId = String(userId);
  if (!/^\d+$/.test(normalizedUserId) || normalizedUserId === '0') return false;

  const normalizedPrefix = String(prefix).replace(/^\/+|\/+$/g, '');
  const pattern = new RegExp(
    `^${escapeRegExp(normalizedPrefix)}/profiles/users/${normalizedUserId}/${MANAGED_AVATAR_UUID}\\.(?:jpg|png|webp)$`,
    'i'
  );

  return pattern.test(key);
};

const createS3Service = ({
  client,
  bucket,
  prefix,
  ttlSeconds = DEFAULT_MEDIA_URL_TTL_SECONDS,
  presign = getSignedUrl,
  uuidFactory = randomUUID
}) => ({
  async uploadUserAvatar({ userId, buffer, contentType, extension }) {
    const normalizedUserId = String(userId);
    if (!/^\d+$/.test(normalizedUserId) || normalizedUserId === '0') {
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

  isManagedUserAvatarKey({ key, userId }) {
    return isManagedUserAvatarKey({ key, userId, prefix });
  },

  isManagedProfilePhotoKey(key) {
    return isManagedProfilePhotoKey({ key, prefix });
  },

  async getSignedReadUrl(key) {
    if (!isManagedProfilePhotoKey({ key, prefix })) {
      const error = new Error('A referência não é uma key de foto gerenciada');
      error.code = 'UNMANAGED_S3_KEY';
      throw error;
    }

    return presign(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: ttlSeconds }
    );
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
  }
});

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
const deleteUserAvatar = (params) => getS3Service().deleteUserAvatar(params);
const isManagedAvatar = (params) => getS3Service().isManagedUserAvatarKey(params);
const isManagedProfilePhoto = (key) => getS3Service().isManagedProfilePhotoKey(key);
const getSignedReadUrl = (key) => getS3Service().getSignedReadUrl(key);

module.exports = {
  createS3Service,
  deleteUserAvatar,
  getSignedReadUrl,
  isManagedProfilePhoto,
  isManagedProfilePhotoKey,
  isManagedUserAvatarKey,
  isManagedAvatar,
  readS3Config,
  uploadUserAvatar
};
