import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RequireAuth from './RequireAuth';
import { UserContext } from '../UserContext';

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

const renderStatus = (authStatus, extra = {}) => {
  const retryAuthentication = jest.fn();
  render(
    <UserContext.Provider value={{ authStatus, retryAuthentication, ...extra }}>
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/private" element={<div>Conteúdo privado</div>} />
          </Route>
          <Route path="/Seinscrever" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    </UserContext.Provider>
  );
  return retryAuthentication;
};

test('hydrating mostra estado neutro sem redirect', () => {
  renderStatus('hydrating');
  expect(screen.getByRole('status')).toHaveTextContent('Carregando sessão');
  expect(screen.queryByText('Login')).not.toBeInTheDocument();
});

test('authenticated renderiza Outlet', () => {
  renderStatus('authenticated');
  expect(screen.getByText('Conteúdo privado')).toBeInTheDocument();
});

test('unauthenticated redireciona a login', () => {
  renderStatus('unauthenticated');
  expect(screen.getByText('Login')).toBeInTheDocument();
});

test('temporarilyUnavailable mostra retry sem redirect', () => {
  const retry = renderStatus('temporarilyUnavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Login')).not.toBeInTheDocument();
});

test('logout remoto pendente não redireciona e permite retry', () => {
  const retry = renderStatus('unauthenticated', { logoutPending: true });
  fireEvent.click(screen.getByRole('button', { name: 'Tentar logout novamente' }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Login')).not.toBeInTheDocument();
});
