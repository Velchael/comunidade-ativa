import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Header, formatCommunityDisplayName } from './App';
import { UserContext } from './UserContext';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() }
    },
    get: jest.fn(),
    post: jest.fn(),
    request: jest.fn()
  }
}));

jest.mock('./services/authClient', () => ({
  request: jest.fn()
}));

const baseUser = {
  id: 7,
  email: 'velchael@example.test',
  username: 'Velchael Stalin',
  comunidadId: 12,
  comunidad_id: 12,
  comunidadNombre: 'Comunidade Ativa',
  rol_global: 'miembro',
  rol_comunidad: 'miembro',
  is_owner: false,
  can_manage_comunidad: false
};

const renderHeader = ({
  user = baseUser,
  token = null,
  isHydrating = false,
  initialPath = '/interacciones',
  toggleSidebar = jest.fn()
} = {}) => {
  const userContextValue = {
    user,
    token,
    logoutPending: false,
    retryAuthentication: jest.fn(),
    isHydrating,
    refreshAuthSession: jest.fn()
  };

  const view = render(
    <UserContext.Provider value={userContextValue}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Header toggleSidebar={toggleSidebar} />
      </MemoryRouter>
    </UserContext.Provider>
  );

  return {
    ...view,
    toggleSidebar,
    userContextValue
  };
};

test('renderiza nombre real de comunidad como título principal', () => {
  renderHeader();

  expect(screen.getByLabelText('Comunidade atual: Comunidade Ativa')).toHaveTextContent('Comunidade Ativa');
});

test('preserva capitalización real cuando el nombre ya está correctamente escrito', () => {
  renderHeader({
    user: {
      ...baseUser,
      comunidadNombre: 'Comunidade São José'
    }
  });

  expect(screen.getByLabelText('Comunidade atual: Comunidade São José')).toHaveTextContent('Comunidade São José');
});

test('normaliza sólo nombres de comunidad completamente uppercase sin mutar user', () => {
  const user = {
    ...baseUser,
    comunidadNombre: 'VENEZOLANOS DE LA GUAIRA CUATRO'
  };
  const originalName = user.comunidadNombre;

  renderHeader({ user });

  expect(screen.getByLabelText('Comunidade atual: Venezolanos de la guaira cuatro')).toHaveTextContent(
    'Venezolanos de la guaira cuatro'
  );
  expect(user.comunidadNombre).toBe(originalName);
});

test('helper preserva nombres mixtos y normaliza uppercase completo', () => {
  expect(formatCommunityDisplayName('COMUNIDADE ATIVA')).toBe('Comunidade ativa');
  expect(formatCommunityDisplayName('Comunidade São José')).toBe('Comunidade São José');
  expect(formatCommunityDisplayName('Igreja Batista Central')).toBe('Igreja Batista Central');
});

test('sin comunidad no renderiza fila principal ni fallback Sem comunidade', () => {
  const { container } = renderHeader({
    user: {
      ...baseUser,
      comunidadNombre: '   '
    }
  });

  expect(container.querySelector('.community-header-title-row')).not.toBeInTheDocument();
  expect(screen.queryByText('Sem comunidade')).not.toBeInTheDocument();
});

test('mantiene hamburguesa y navegación principal', () => {
  const { toggleSidebar } = renderHeader();

  const menuButton = screen.getByRole('button', { name: 'Abrir menu lateral' });
  expect(menuButton).toBeInTheDocument();
  userEvent.click(menuButton);

  expect(toggleSidebar).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: 'Interações' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Agenda' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Grupos' })).toBeInTheDocument();
});

test('header no muestra Sair', () => {
  renderHeader();

  expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument();
  expect(screen.queryByText('Sair')).not.toBeInTheDocument();
});

test('desktop mantiene nombre completo y móvil dispone de primer nombre textual', () => {
  const { container } = renderHeader();

  expect(container.querySelector('.header-user-name-full')).toHaveTextContent('Olá, Velchael Stalin');
  expect(container.querySelector('.header-user-name-mobile')).toHaveTextContent('Velchael');
});

test('campana y menú de configuración permanecen para admin_total', async () => {
  renderHeader({
    user: {
      ...baseUser,
      rol_global: 'admin_total',
      rol_comunidad: 'admin_basic'
    }
  });

  expect(screen.getByRole('button', { name: 'Abrir notificações' })).toBeInTheDocument();

  await userEvent.click(screen.getByText('⚙'));

  expect(screen.getByRole('link', { name: 'Usuários' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Comunidade' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Membros' })).toBeInTheDocument();
});

test('admin_basic local ve Comunidade y Membros sin Usuários', async () => {
  renderHeader({
    user: {
      ...baseUser,
      rol_comunidad: 'admin_basic'
    }
  });

  await userEvent.click(screen.getByText('⚙'));

  expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Comunidade' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Membros' })).toBeInTheDocument();
});

test('miembro no ve menú de configuración', () => {
  renderHeader();

  expect(screen.queryByText('⚙')).not.toBeInTheDocument();
});

test('nombre largo de comunidad se renderiza como texto accesible', () => {
  renderHeader({
    user: {
      ...baseUser,
      comunidadNombre: 'Comunidade Evangélica Internacional dos Venezuelanos de São Paulo'
    }
  });

  const header = screen.getByRole('banner');
  expect(within(header).getByLabelText(
    'Comunidade atual: Comunidade Evangélica Internacional dos Venezuelanos de São Paulo'
  )).toBeInTheDocument();
});
