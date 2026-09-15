import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Header, formatCommunityDisplayName } from './App';
import { UserContext } from './UserContext';
import authClient from './services/authClient';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

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

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigate.mockClear();
  authClient.request.mockResolvedValue({ data: { items: [], unread_count: 0 } });
});

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
  expect(screen.getByRole('link', { name: 'Conversas' })).toBeInTheDocument();
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

test('campana renderiza respuesta_interaccion legacy y navega a interacciones', async () => {
  authClient.request.mockImplementation(async (config) => {
    if (config.method === 'patch') return { data: { id: 20, leida: true } };
    return {
      data: {
        items: [{
          id: 20,
          tipo: 'respuesta_interaccion',
          interaccion_id: 7,
          respuesta_id: 70,
          leida: false,
          created_at: new Date().toISOString(),
          actor: { id: 42, username: 'Efraim' }
        }],
        unread_count: 1
      }
    };
  });

  renderHeader({ token: 'access-token' });

  await userEvent.click(screen.getByRole('button', { name: 'Abrir notificações' }));
  expect(await screen.findByText('💬 Efraim respondeu à sua publicação')).toBeInTheDocument();

  await userEvent.click(screen.getByText('💬 Efraim respondeu à sua publicação'));

  expect(authClient.request).toHaveBeenCalledWith({
    method: 'patch',
    url: 'http://localhost:3000/api/notificaciones/20/leida'
  });
  expect(mockNavigate).toHaveBeenCalledWith('/interacciones?interaccionId=7');
});

test('campana renderiza Agenda created y al tocar marca leído y navega /TaskList', async () => {
  authClient.request.mockImplementation(async (config) => {
    if (config.method === 'patch') return { data: { id: 21, leida: true } };
    return {
      data: {
        items: [{
          id: 21,
          tipo: 'agenda_task_created',
          titulo: 'Nova atividade na Agenda',
          corpo: 'Culto de oração — 15/09',
          url: '/TaskList',
          task_id: 99,
          comunidad_id: 7,
          leida: false,
          created_at: new Date().toISOString(),
          actor: { id: 44, username: 'Admin' }
        }],
        unread_count: 1
      }
    };
  });

  renderHeader({ token: 'access-token' });

  await userEvent.click(screen.getByRole('button', { name: 'Abrir notificações' }));
  expect(await screen.findByText('Nova atividade na Agenda')).toBeInTheDocument();
  expect(screen.getByText('Culto de oração — 15/09')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Nova atividade na Agenda'));

  expect(authClient.request).toHaveBeenCalledWith({
    method: 'patch',
    url: 'http://localhost:3000/api/notificaciones/21/leida'
  });
  expect(mockNavigate).toHaveBeenCalledWith('/TaskList');
});

test.each([
  ['agenda_task_updated', 'Atividade atualizada', 'Culto de oração — nova data: 16/09'],
  ['agenda_task_cancelled', 'Atividade cancelada', 'Culto de oração foi cancelada'],
  ['agenda_task_deleted', 'Atividade removida', 'Culto de oração foi removida da Agenda']
])('campana renderiza %s', async (tipo, titulo, corpo) => {
  authClient.request.mockResolvedValue({
    data: {
      items: [{
        id: 22,
        tipo,
        titulo,
        corpo,
        url: '/TaskList',
        task_id: 99,
        comunidad_id: 7,
        leida: true,
        created_at: new Date().toISOString(),
        actor: null
      }],
      unread_count: 0
    }
  });

  renderHeader({ token: 'access-token' });

  await userEvent.click(screen.getByRole('button', { name: 'Abrir notificações' }));

  expect(await screen.findByText(titulo)).toBeInTheDocument();
  expect(screen.getByText(corpo)).toBeInTheDocument();
});

test('campana renderiza mensagem_privada e navega para URL interna da conversa', async () => {
  authClient.request.mockImplementation(async (config) => {
    if (config.method === 'patch') return { data: { id: 23, leida: true } };
    return {
      data: {
        items: [{
          id: 23,
          tipo: 'mensagem_privada',
          titulo: 'Nova mensagem privada',
          corpo: 'Maria enviou uma mensagem.',
          url: '/conversas/55',
          leida: false,
          created_at: new Date().toISOString(),
          actor: { id: 44, username: 'Maria' }
        }],
        unread_count: 1
      }
    };
  });

  renderHeader({ token: 'access-token' });

  await userEvent.click(screen.getByRole('button', { name: 'Abrir notificações' }));
  expect(await screen.findByText('Nova mensagem privada')).toBeInTheDocument();
  expect(screen.getByText('Maria enviou uma mensagem.')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Nova mensagem privada'));

  expect(authClient.request).toHaveBeenCalledWith({
    method: 'patch',
    url: 'http://localhost:3000/api/notificaciones/23/leida'
  });
  expect(mockNavigate).toHaveBeenCalledWith('/conversas/55');
});

test.each([
  '//evil.example/conversas/55',
  'https://evil.example/conversas/55'
])('campana ignora URL externa de mensagem_privada: %s', async (url) => {
  authClient.request.mockResolvedValue({
    data: {
      items: [{
        id: 24,
        tipo: 'mensagem_privada',
        titulo: 'Nova mensagem privada',
        corpo: 'Maria enviou uma mensagem.',
        url,
        leida: false,
        created_at: new Date().toISOString(),
        actor: { id: 44, username: 'Maria' }
      }],
      unread_count: 1
    }
  });

  renderHeader({ token: 'access-token' });

  await userEvent.click(screen.getByRole('button', { name: 'Abrir notificações' }));
  await userEvent.click(await screen.findByText('Nova mensagem privada'));

  expect(mockNavigate).not.toHaveBeenCalled();
  expect(authClient.request).not.toHaveBeenCalledWith(expect.objectContaining({
    method: 'patch',
    url: 'http://localhost:3000/api/notificaciones/24/leida'
  }));
});
