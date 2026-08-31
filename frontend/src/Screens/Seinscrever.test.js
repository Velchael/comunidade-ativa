import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Seinscrever from './Seinscrever';
import { UserContext } from '../UserContext';
import { getPendingInvitation, savePendingInvitation } from '../utils/invitationSession';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    },
    post: jest.fn(),
    request: jest.fn()
  }
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.pushState({}, '', '/Seinscrever');
});

test('continúa aceptando ?token legacy, lo migra y preserva pendingInvitationPath', async () => {
  let releaseMigration;
  const login = jest.fn().mockImplementation(() => new Promise((resolve) => {
    releaseMigration = resolve;
  }));
  savePendingInvitation('/convite/invitation-token');
  window.history.pushState({}, '', '/Seinscrever?token=google-legacy-jwt&mode=invitation');

  render(
    <HelmetProvider>
      <UserContext.Provider value={{
        user: null,
        authStatus: 'hydrating',
        login
      }}>
        <MemoryRouter initialEntries={['/Seinscrever?token=google-legacy-jwt&mode=invitation']}>
          <Seinscrever />
        </MemoryRouter>
      </UserContext.Provider>
    </HelmetProvider>
  );

  await waitFor(() => expect(login).toHaveBeenCalledWith('google-legacy-jwt'));
  expect(window.location.search).not.toContain('token=');
  expect(window.location.search).toContain('mode=invitation');
  expect(getPendingInvitation()).toBe('/convite/invitation-token');

  releaseMigration({ id: 9, email: 'google@example.test', comunidad_id: null });
  await waitFor(() => expect(getPendingInvitation()).toBe('/convite/invitation-token'));
});

test('callback limpio continúa con usuario autenticado y recupera pendingInvitationPath', async () => {
  const login = jest.fn();
  savePendingInvitation('/convite/invitation-token');
  window.history.pushState({}, '', '/seinscrever');

  render(
    <HelmetProvider>
      <UserContext.Provider value={{
        user: { id: 9, email: 'google@example.test', comunidad_id: null },
        authStatus: 'authenticated',
        login
      }}>
        <MemoryRouter initialEntries={['/seinscrever']}>
          <Routes>
            <Route path="/seinscrever" element={<Seinscrever />} />
            <Route path="/convite/invitation-token" element={<div>Convite pendente</div>} />
          </Routes>
        </MemoryRouter>
      </UserContext.Provider>
    </HelmetProvider>
  );

  await screen.findByText('Convite pendente');
  expect(window.location.search).toBe('');
  expect(login).not.toHaveBeenCalled();
  expect(getPendingInvitation()).toBe('/convite/invitation-token');
});

test('localStorage.user aislado no se usa para autenticar Seinscrever', async () => {
  const login = jest.fn();
  localStorage.setItem('user', JSON.stringify({ email: 'stale@example.test' }));

  render(
    <HelmetProvider>
      <UserContext.Provider value={{ user: null, authStatus: 'unauthenticated', login }}>
        <MemoryRouter>
          <Seinscrever />
        </MemoryRouter>
      </UserContext.Provider>
    </HelmetProvider>
  );

  await waitFor(() => expect(login).not.toHaveBeenCalled());
  expect(localStorage.getItem('user')).not.toBeNull();
});
