const crypto = require('crypto');
const {
  generateRefreshSecret,
  buildRefreshCredential,
  parseRefreshCredential,
  hashRefreshSecret,
  safeHashEqual,
} = require('../utils/refreshCredentials');

const DAY_MS = 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const AUTH_SESSION_IDLE_DAYS = 180;
const AUTH_SESSION_ABSOLUTE_DAYS = 365;
const REFRESH_RACE_GRACE_SECONDS = 10;

class AuthSessionError extends Error {
  constructor(code, { statusHint = 401, recoverable = false, session = null } = {}) {
    super(code);
    this.name = 'AuthSessionError';
    this.code = code;
    this.statusHint = statusHint;
    this.recoverable = recoverable;
    this.session = session;
  }
}

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const createAuthSessionService = ({ AuthSession, sequelize, now = () => new Date() }) => {
  if (!AuthSession || !sequelize) throw new TypeError('AuthSession and sequelize are required');

  const runOwnTransaction = async (callback) => {
    const outcome = await sequelize.transaction(async (activeTransaction) => {
      try {
        return { value: await callback(activeTransaction) };
      } catch (error) {
        if (!(error instanceof AuthSessionError)) throw error;
        return { error };
      }
    });
    if (outcome.error) throw outcome.error;
    return outcome.value;
  };

  const parseCredential = (credential) => {
    if (credential === null || credential === undefined || credential === '') {
      throw new AuthSessionError('AUTH_REFRESH_MISSING');
    }
    const parsed = parseRefreshCredential(credential);
    if (!parsed) throw new AuthSessionError('AUTH_REFRESH_MALFORMED');
    return parsed;
  };

  const loadLockedSession = async (sessionId, transaction) => {
    const session = await AuthSession.findByPk(sessionId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!session) throw new AuthSessionError('AUTH_SESSION_NOT_FOUND');
    return session;
  };

  const validateActive = async (session, timestamp, transaction) => {
    if (session.revoked_at) throw new AuthSessionError('AUTH_SESSION_REVOKED', { session });

    if (timestamp.getTime() >= new Date(session.absolute_expires_at).getTime()) {
      await session.update({ revoked_at: timestamp, revoked_reason: 'absolute_expired' }, { transaction });
      throw new AuthSessionError('AUTH_SESSION_ABSOLUTE_EXPIRED', { session });
    }
    if (timestamp.getTime() >= new Date(session.expires_at).getTime()) {
      await session.update({ revoked_at: timestamp, revoked_reason: 'idle_expired' }, { transaction });
      throw new AuthSessionError('AUTH_SESSION_IDLE_EXPIRED', { session });
    }
  };

  /**
   * With an external transaction, the returned credential is provisional: the
   * caller must not emit it in Set-Cookie or return it to the browser until that
   * transaction commits successfully, and must discard it after rollback.
   * Without an external transaction, AuthSession.create autocommits before the
   * credential is returned.
   */
  const createSession = async ({ userId, transaction } = {}) => {
    if (!Number.isInteger(userId) || userId <= 0) throw new TypeError('userId must be a positive integer');
    const timestamp = now();
    const sessionId = crypto.randomUUID();
    const familyId = crypto.randomUUID();
    const secret = generateRefreshSecret();
    const session = await AuthSession.create({
      id: sessionId,
      user_id: userId,
      family_id: familyId,
      refresh_token_hash: hashRefreshSecret(secret),
      previous_refresh_token_hash: null,
      rotation_counter: 0,
      rotated_at: null,
      previous_valid_until: null,
      created_at: timestamp,
      updated_at: timestamp,
      last_used_at: timestamp,
      expires_at: addDays(timestamp, AUTH_SESSION_IDLE_DAYS),
      absolute_expires_at: addDays(timestamp, AUTH_SESSION_ABSOLUTE_DAYS),
      revoked_at: null,
      revoked_reason: null,
    }, { transaction });
    return { session, credential: buildRefreshCredential(sessionId, secret), result: 'CREATED' };
  };

  const rotateSessionCredential = async ({ credential } = {}) => {
    const { sessionId, secret } = parseCredential(credential);
    const presentedHash = hashRefreshSecret(secret);

    return runOwnTransaction(async (activeTransaction) => {
      const session = await loadLockedSession(sessionId, activeTransaction);
      const timestamp = now();
      await validateActive(session, timestamp, activeTransaction);

      if (safeHashEqual(presentedHash, session.refresh_token_hash)) {
        const newSecret = generateRefreshSecret();
        const absoluteMs = new Date(session.absolute_expires_at).getTime();
        const idleMs = addDays(timestamp, AUTH_SESSION_IDLE_DAYS).getTime();
        await session.update({
          previous_refresh_token_hash: session.refresh_token_hash,
          refresh_token_hash: hashRefreshSecret(newSecret),
          rotation_counter: sequelize.literal('rotation_counter + 1'),
          rotated_at: timestamp,
          previous_valid_until: new Date(timestamp.getTime() + REFRESH_RACE_GRACE_SECONDS * 1000),
          last_used_at: timestamp,
          expires_at: new Date(Math.min(idleMs, absoluteMs)),
        }, { transaction: activeTransaction, returning: true });
        return {
          session,
          credential: buildRefreshCredential(session.id, newSecret),
          result: 'ROTATED',
        };
      }

      if (safeHashEqual(presentedHash, session.previous_refresh_token_hash)) {
        const withinGrace = session.previous_valid_until &&
          timestamp.getTime() <= new Date(session.previous_valid_until).getTime();
        if (withinGrace) {
          throw new AuthSessionError('AUTH_REFRESH_RACE', {
            statusHint: 409,
            recoverable: true,
            session,
          });
        }
        await session.update({
          revoked_at: timestamp,
          revoked_reason: 'refresh_token_reuse',
        }, { transaction: activeTransaction });
        throw new AuthSessionError('AUTH_REFRESH_REUSE', { session });
      }

      throw new AuthSessionError('AUTH_REFRESH_INVALID', { session });
    });
  };

  const revokeSession = async ({ credential, reason = 'user_logout' } = {}) => {
    if (reason !== 'user_logout') throw new TypeError('Unsupported revocation reason');
    const { sessionId, secret } = parseCredential(credential);
    const presentedHash = hashRefreshSecret(secret);

    return runOwnTransaction(async (activeTransaction) => {
      const session = await loadLockedSession(sessionId, activeTransaction);
      const timestamp = now();
      await validateActive(session, timestamp, activeTransaction);
      if (!safeHashEqual(presentedHash, session.refresh_token_hash)) {
        throw new AuthSessionError('AUTH_REFRESH_INVALID', { session });
      }
      await session.update({ revoked_at: timestamp, revoked_reason: reason }, {
        transaction: activeTransaction,
      });
      return { session, result: 'REVOKED' };
    });
  };

  return { createSession, rotateSessionCredential, revokeSession };
};

module.exports = {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_SESSION_IDLE_DAYS,
  AUTH_SESSION_ABSOLUTE_DAYS,
  REFRESH_RACE_GRACE_SECONDS,
  AuthSessionError,
  createAuthSessionService,
};
