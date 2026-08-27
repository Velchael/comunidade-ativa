import { act, render, waitFor } from '@testing-library/react';
import { UserProvider } from './UserContext';
import authClient from './services/authClient';

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

beforeEach(() => {
  jest.clearAllMocks();
  authClient.setAuthHandlers.mockImplementation((handlers) => {
    authClient.handlers = handlers;
    return () => { authClient.handlers = null; };
  });
  authClient.bootstrap.mockResolvedValue(null);
  authClient.refresh.mockResolvedValue(null);
  authClient.shouldRefreshOnResume.mockReturnValue(false);
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
