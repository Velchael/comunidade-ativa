import { fireEvent, render, screen, within } from '@testing-library/react';
import axios from 'axios';
import { MemoryRouter } from 'react-router-dom';
import MiembrosComunidadPanel from './MiembrosComunidadPanel';
import { UserContext } from '../UserContext';

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
    patch: jest.fn()
  }
}));

jest.mock('qrcode.react', () => ({
  QRCodeCanvas: ({ value }) => <canvas data-testid="qr-code" data-value={value} />
}));

const adminUser = {
  id: 11,
  username: 'admin',
  rol_global: 'miembro',
  rol_comunidad: 'admin_basic',
  comunidad_id: 7,
  can_manage_comunidad: true
};

const normalInvitation = {
  id: 101,
  comunidad_id: 7,
  tipo: 'normal',
  estado: 'activa',
  estado_efectivo: 'activa',
  usos_actuales: 15
};

const consolidacaoInvitation = {
  id: 202,
  comunidad_id: 7,
  tipo: 'consolidacao',
  estado: 'activa',
  estado_efectivo: 'activa',
  usos_actuales: 3
};

const mockInitialRequests = ({
  invitaciones = [normalInvitation, consolidacaoInvitation],
  miembros = [{
    user_id: 31,
    username: 'maria',
    email: 'maria@example.com',
    rol_comunidad: 'miembro',
    estado: 'activo',
    es_principal: true
  }]
} = {}) => {
  axios.get.mockImplementation((url) => {
    if (url.endsWith('/miembros')) {
      return Promise.resolve({ data: { miembros, total: miembros.length } });
    }

    if (url.endsWith('/invitaciones')) {
      return Promise.resolve({ data: { invitaciones } });
    }

    return Promise.resolve({ data: { nombre: 'Comunidade Teste' } });
  });
};

const renderPanel = async (options = {}) => {
  mockInitialRequests(options);

  const view = render(
    <MemoryRouter>
      <UserContext.Provider value={{ user: adminUser, token: 'auth-token' }}>
        <MiembrosComunidadPanel comunidadId={7} comunidadNombre="Comunidade Teste" />
      </UserContext.Provider>
    </MemoryRouter>
  );

  await screen.findByRole('combobox', { name: 'Tipo de convite' });
  await screen.findByText('maria');

  return view;
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('selector inicia em Convite ativo e alterna cartões sem criar ou revogar convites', async () => {
  await renderPanel();

  const selector = screen.getByRole('combobox', { name: 'Tipo de convite' });
  expect(selector).toHaveValue('normal');
  expect(await screen.findByTestId('invitation-card-title')).toHaveTextContent('Convite ativo');
  expect(await screen.findByText('15')).toBeInTheDocument();
  expect(screen.getByTestId('invitation-card-title')).not.toHaveTextContent('Convite de Consolidação ativo');
  expect(screen.queryByText('3')).not.toBeInTheDocument();

  fireEvent.change(selector, { target: { value: 'consolidacao' } });

  expect(selector).toHaveValue('consolidacao');
  expect(screen.getByTestId('invitation-card-title')).toHaveTextContent('Convite de Consolidação ativo');
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByTestId('invitation-card-title')).not.toHaveTextContent(/^Convite ativo$/);
  expect(screen.queryByText('15')).not.toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
  expect(axios.patch).not.toHaveBeenCalled();

  fireEvent.change(selector, { target: { value: 'normal' } });

  expect(selector).toHaveValue('normal');
  expect(screen.getByTestId('invitation-card-title')).toHaveTextContent('Convite ativo');
  expect(screen.getByText('15')).toBeInTheDocument();
  expect(screen.getByTestId('invitation-card-title')).not.toHaveTextContent('Convite de Consolidação ativo');
  expect(axios.post).not.toHaveBeenCalled();
  expect(axios.patch).not.toHaveBeenCalled();
});

test('convites normal e consolidacao mantêm estados independentes ao gerar e revogar consolidacao', async () => {
  axios.post.mockResolvedValueOnce({
    data: {
      id: 303,
      token: 'consolidacao-token',
      url: 'https://comuva.com/convite/consolidacao-token',
      comunidad_id: 7,
      tipo: 'consolidacao',
      estado: 'activa',
      expires_at: null,
      max_usos: null,
      usos_actuales: 0,
      created_at: '2026-10-03T00:00:00.000Z'
    }
  });
  axios.patch.mockResolvedValueOnce({ data: { message: 'Convite revogado' } });

  await renderPanel();

  const selector = screen.getByRole('combobox', { name: 'Tipo de convite' });
  fireEvent.change(selector, { target: { value: 'consolidacao' } });

  fireEvent.click(screen.getByRole('button', { name: 'Gerar convite de consolidação' }));

  await screen.findByText('https://comuva.com/convite/consolidacao-token');
  expect(axios.post).toHaveBeenCalledWith(
    'http://localhost:3000/api/comunidades/7/invitaciones',
    { tipo: 'consolidacao' },
    { headers: { Authorization: 'Bearer auth-token' } }
  );
  expect(screen.getAllByTestId('qr-code')).toHaveLength(1);

  fireEvent.change(selector, { target: { value: 'normal' } });

  expect(screen.getByTestId('invitation-card-title')).toHaveTextContent('Convite ativo');
  expect(screen.getByText('15')).toBeInTheDocument();
  expect(screen.queryByText('https://comuva.com/convite/consolidacao-token')).not.toBeInTheDocument();

  fireEvent.change(selector, { target: { value: 'consolidacao' } });
  fireEvent.click(screen.getByRole('button', { name: 'Revogar convite' }));

  await screen.findByText('Convite revogado.');
  expect(axios.patch).toHaveBeenCalledWith(
    'http://localhost:3000/api/invitaciones/303/revocar',
    {},
    { headers: { Authorization: 'Bearer auth-token' } }
  );

  fireEvent.change(selector, { target: { value: 'normal' } });

  expect(screen.getByTestId('invitation-card-title')).toHaveTextContent('Convite ativo');
  expect(screen.getByText('15')).toBeInTheDocument();
});

test('renderiza somente uma área de convite visível por vez em viewport móvel', async () => {
  global.innerWidth = 375;
  global.dispatchEvent(new Event('resize'));

  await renderPanel();

  const manager = document.querySelector('.community-invitation-manager');
  expect(within(manager).getByRole('combobox', { name: 'Tipo de convite' })).toBeInTheDocument();
  expect(within(manager).getAllByText('Estado')).toHaveLength(1);
  expect(within(manager).getAllByText('Usos')).toHaveLength(1);

  fireEvent.change(
    within(manager).getByRole('combobox', { name: 'Tipo de convite' }),
    { target: { value: 'consolidacao' } }
  );

  expect(within(manager).getAllByText('Estado')).toHaveLength(1);
  expect(within(manager).getAllByText('Usos')).toHaveLength(1);
  expect(screen.getByTestId('invitation-card-title')).toHaveTextContent('Convite de Consolidação ativo');
});

test('selector funciona quando somente convite normal existe', async () => {
  await renderPanel({ invitaciones: [normalInvitation] });

  const selector = screen.getByRole('combobox', { name: 'Tipo de convite' });
  expect(screen.getByTestId('invitation-card-title')).toHaveTextContent('Convite ativo');
  expect(screen.getByText('15')).toBeInTheDocument();

  fireEvent.change(selector, { target: { value: 'consolidacao' } });

  expect(screen.getByTestId('invitation-card-title')).toHaveTextContent('Convide para consolidação');
  expect(screen.getByRole('button', { name: 'Gerar convite de consolidação' })).toBeInTheDocument();
  expect(screen.queryByText('15')).not.toBeInTheDocument();
});

test('selector funciona quando somente convite consolidacao existe', async () => {
  await renderPanel({ invitaciones: [consolidacaoInvitation] });

  const selector = screen.getByRole('combobox', { name: 'Tipo de convite' });
  expect(screen.getByTestId('invitation-card-title')).toHaveTextContent('Convide pessoas para sua comunidade');
  expect(screen.getByRole('button', { name: 'Gerar convite' })).toBeInTheDocument();

  fireEvent.change(selector, { target: { value: 'consolidacao' } });

  expect(screen.getByTestId('invitation-card-title')).toHaveTextContent('Convite de Consolidação ativo');
  expect(screen.getByText('3')).toBeInTheDocument();
});

test('selector funciona quando nenhum convite existe', async () => {
  await renderPanel({ invitaciones: [] });

  const selector = screen.getByRole('combobox', { name: 'Tipo de convite' });
  expect(screen.getByTestId('invitation-card-title')).toHaveTextContent('Convide pessoas para sua comunidade');
  expect(screen.getByRole('button', { name: 'Gerar convite' })).toBeInTheDocument();

  fireEvent.change(selector, { target: { value: 'consolidacao' } });

  expect(screen.getByTestId('invitation-card-title')).toHaveTextContent('Convide para consolidação');
  expect(screen.getByRole('button', { name: 'Gerar convite de consolidação' })).toBeInTheDocument();
});

test('gerar convite normal mantém consolidacao intacto e usa payload histórico vazio', async () => {
  axios.post.mockResolvedValueOnce({
    data: {
      id: 404,
      token: 'normal-token',
      url: 'https://comuva.com/convite/normal-token',
      comunidad_id: 7,
      tipo: 'normal',
      estado: 'activa',
      expires_at: null,
      max_usos: null,
      usos_actuales: 0,
      created_at: '2026-10-03T00:00:00.000Z'
    }
  });

  await renderPanel({ invitaciones: [consolidacaoInvitation] });

  fireEvent.click(screen.getByRole('button', { name: 'Gerar convite' }));

  await screen.findByText('https://comuva.com/convite/normal-token');
  expect(axios.post).toHaveBeenCalledWith(
    'http://localhost:3000/api/comunidades/7/invitaciones',
    {},
    { headers: { Authorization: 'Bearer auth-token' } }
  );

  fireEvent.change(
    screen.getByRole('combobox', { name: 'Tipo de convite' }),
    { target: { value: 'consolidacao' } }
  );

  expect(screen.getByTestId('invitation-card-title')).toHaveTextContent('Convite de Consolidação ativo');
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.queryByText('https://comuva.com/convite/normal-token')).not.toBeInTheDocument();
});
