import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import authClient from './services/authClient';

export const UserContext = createContext();

const normalizeUser = (baseUser = {}) => ({
  ...baseUser,
  comunidadId: baseUser.comunidadId || baseUser.comunidad_id,
  rol_global: baseUser.rol_global || baseUser.rol || null,
  rol_comunidad: baseUser.rol_comunidad || null,
  is_owner: baseUser.is_owner === true,
  can_manage_comunidad: baseUser.can_manage_comunidad === true
});

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authStatus, setAuthStatus] = useState('hydrating');
  const [logoutPending, setLogoutPending] = useState(false);

  useEffect(() => authClient.setAuthHandlers({
    onHydrating: () => setAuthStatus('hydrating'),
    onAuthenticated: ({ user: authoritativeUser, accessToken }) => {
      setUser(normalizeUser(authoritativeUser));
      setToken(accessToken);
      setAuthStatus('authenticated');
      setLogoutPending(false);
    },
    onUnauthenticated: ({ logoutPending: pending = false } = {}) => {
      setUser(null);
      setToken(null);
      setAuthStatus('unauthenticated');
      setLogoutPending(pending);
    },
    onTemporarilyUnavailable: () => {
      setUser(null);
      setToken(null);
      setAuthStatus('temporarilyUnavailable');
    },
    onLogoutPending: () => setLogoutPending(true)
  }), []);

  const bootstrap = useCallback(() => authClient.bootstrap().catch(() => null), []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback((legacyToken) => (
    authClient.setLegacyTokenAndMigrate(legacyToken)
  ), []);

  const refreshAuthSession = useCallback(({ force = false } = {}) => {
    if (!force && !authClient.shouldRefreshOnResume(authStatus)) return Promise.resolve(user);
    return authClient.refresh();
  }, [authStatus, user]);

  const retryAuthentication = useCallback(() => {
    if (logoutPending) return authClient.retryPendingLogout();
    setAuthStatus('hydrating');
    return bootstrap();
  }, [bootstrap, logoutPending]);

  const logout = useCallback(() => authClient.logout(), []);

  useEffect(() => {
    const handleResume = () => {
      if (
        document.visibilityState === 'visible' &&
        authClient.shouldRefreshOnResume(authStatus)
      ) {
        const recovery = (
          authStatus === 'temporarilyUnavailable' || !authClient.getAccessToken()
        )
          ? authClient.bootstrap()
          : authClient.refresh();
        recovery.catch(() => null);
      }
    };

    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('online', handleResume);
    return () => {
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('online', handleResume);
    };
  }, [authStatus]);

  const value = useMemo(() => ({
    user,
    token,
    authStatus,
    isHydrating: authStatus === 'hydrating',
    logoutPending,
    login,
    logout,
    setUser,
    refreshAuthSession,
    retryAuthentication
  }), [
    authStatus,
    login,
    logout,
    logoutPending,
    refreshAuthSession,
    retryAuthentication,
    token,
    user
  ]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
