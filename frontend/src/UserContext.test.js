import { act, render, waitFor } from '@testing-library/react';
import { UserProvider } from './UserContext';
import authClient from './services/authClient';
import { syncPushSubscriptionIfGranted } from './services/pushNotifications';

jest.mock('./services/authClient', () => {
  const client = {
    bootstrap: jest.fn(() => Promise.resolve(null)),
    refresh: jest.fn(() => Promise.resolve(null)),
    setAuthHandlers: jest.fn(),
    shouldRefreshOnResume: jest.fn(() => false),
    getAccessToken: jest.fn(() => null),
    setLegacyTokenAndMigrate: jest.fn(),
    retryPendingLogout: jest.fn(),
    logout: jest.fn()
  };
  client.setAuthHandlers.mockImplementation((handlers) => {
    client.handlers = handlers;
    return () => { client.handlers = null; };
  });
  return { __esModule: true, default: client };
});

jest.mock('./services/pushNotifications', () => ({
  syncPushSubscriptionIfGranted: jest.fn(() => Promise.resolve({ status: 'active' }))
}));

const USER = { id: 7, email: 'lucas@example.test' };

beforeEach(() => {
  jest.clearAllMocks();
  authClient.setAuthHandlers.mockImplementation((handlers) => {
    authClient.handlers = handlers;
    return () => { authClient.handlers = null; };
  });
  authClient.bootstrap.mockResolvedValue(null);
  authClient.refresh.mockResolvedValue(null);
  authClient.shouldRefreshOnResume.mockReturnValue(false);
  syncPushSubscriptionIfGranted.mockResolvedValue({ status: 'active' });
});

test('logoutPending bloquea refresh por focus, visibility y online', async () => {
  render(<UserProvider><div>app</div></UserProvider>);
  await waitFor(() => expect(authClient.bootstrap).toHaveBeenCalledTimes(1));

  act(() => {
    authClient.handlers.onUnauthenticated({ logoutPending: true });
  });
  authClient.bootstrap.mockClear();
  authClient.refresh.mockClear();

  act(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
  });

  expect(authClient.shouldRefreshOnResume).toHaveBeenCalled();
  expect(authClient.bootstrap).not.toHaveBeenCalled();
  expect(authClient.refresh).not.toHaveBeenCalled();
});

test('login autenticado dispara sync automático sólo si el usuario está listo', async () => {
  render(<UserProvider><div>app</div></UserProvider>);
  await waitFor(() => expect(authClient.bootstrap).toHaveBeenCalledTimes(1));

  act(() => {
    authClient.handlers.onAuthenticated({ user: USER, accessToken: 'token-lucas' });
  });

  await waitFor(() => expect(syncPushSubscriptionIfGranted).toHaveBeenCalledTimes(1));
  expect(syncPushSubscriptionIfGranted).toHaveBeenCalledWith(expect.objectContaining({
    token: 'token-lucas'
  }));
});

test('bootstrap restaurado sincroniza push si queda autenticado', async () => {
  authClient.bootstrap.mockImplementation(async () => {
    authClient.handlers.onAuthenticated({ user: USER, accessToken: 'token-bootstrap' });
    return USER;
  });

  render(<UserProvider><div>app</div></UserProvider>);

  await waitFor(() => expect(syncPushSubscriptionIfGranted).toHaveBeenCalledTimes(1));
  expect(syncPushSubscriptionIfGranted).toHaveBeenCalledWith(expect.objectContaining({
    token: 'token-bootstrap'
  }));
});

test('refresh del token con el mismo user.id no re-registra push', async () => {
  render(<UserProvider><div>app</div></UserProvider>);
  await waitFor(() => expect(authClient.bootstrap).toHaveBeenCalledTimes(1));

  act(() => {
    authClient.handlers.onAuthenticated({ user: USER, accessToken: 'token-1' });
  });
  await waitFor(() => expect(syncPushSubscriptionIfGranted).toHaveBeenCalledTimes(1));

  act(() => {
    authClient.handlers.onAuthenticated({ user: { ...USER, username: 'Lucas' }, accessToken: 'token-2' });
  });

  await Promise.resolve();
  expect(syncPushSubscriptionIfGranted).toHaveBeenCalledTimes(1);
});

test('cambio de usuario en el mismo dispositivo sincroniza con el token del nuevo usuario', async () => {
  render(<UserProvider><div>app</div></UserProvider>);
  await waitFor(() => expect(authClient.bootstrap).toHaveBeenCalledTimes(1));

  act(() => {
    authClient.handlers.onAuthenticated({ user: { id: 3, email: 'efraim@example.test' }, accessToken: 'token-a' });
  });
  await waitFor(() => expect(syncPushSubscriptionIfGranted).toHaveBeenCalledTimes(1));

  act(() => {
    authClient.handlers.onUnauthenticated({ logoutPending: false });
  });
  act(() => {
    authClient.handlers.onAuthenticated({ user: { id: 7, email: 'lucas@example.test' }, accessToken: 'token-b' });
  });

  await waitFor(() => expect(syncPushSubscriptionIfGranted).toHaveBeenCalledTimes(2));
  expect(syncPushSubscriptionIfGranted.mock.calls[1][0]).toEqual(expect.objectContaining({
    token: 'token-b'
  }));
});

test('logoutPending aborta sync push en vuelo', async () => {
  render(<UserProvider><div>app</div></UserProvider>);
  await waitFor(() => expect(authClient.bootstrap).toHaveBeenCalledTimes(1));

  act(() => {
    authClient.handlers.onAuthenticated({ user: USER, accessToken: 'token-lucas' });
  });
  await waitFor(() => expect(syncPushSubscriptionIfGranted).toHaveBeenCalledTimes(1));
  const signal = syncPushSubscriptionIfGranted.mock.calls[0][0].signal;

  act(() => {
    authClient.handlers.onLogoutPending();
  });

  await waitFor(() => expect(signal.aborted).toBe(true));
});
