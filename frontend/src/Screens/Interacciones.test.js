import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import axios from 'axios';
import Interacciones from './Interacciones';
import { UserContext } from '../UserContext';
import authClient from '../services/authClient';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() }
  }
}));

jest.mock('../services/authClient', () => ({
  request: jest.fn()
}));

const currentUser = {
  id: 7,
  username: 'Pessoa Atual',
  comunidadId: 3,
  comunidad_id: 3,
  comunidadNombre: 'Comunidade Teste'
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-path">{location.pathname}</div>;
}

const sampleItems = [
  {
    id: 10,
    tipo: 'ayuda',
    categoria: 'servicio',
    descripcion: 'Tenho ferramentas',
    visibilidad: 'comunidad',
    estado: 'abierto',
    usuario: { id: 9, username: 'Maria' },
    comunidad: { nombre_comunidad: 'Comunidade Teste' },
    respuestas: []
  },
  {
    id: 11,
    tipo: 'necesidad',
    categoria: 'producto',
    descripcion: 'Preciso de uma mesa',
    visibilidad: 'comunidad',
    estado: 'abierto',
    usuario: { id: 8, username: 'João' },
    comunidad: { nombre_comunidad: 'Comunidade Teste' },
    respuestas: []
  }
];

const renderInteracciones = (items, initialEntry = '/interacciones') => {
  axios.get.mockResolvedValue({
    data: {
      items,
      auth: {
        can_moderate_interacciones: false,
        is_admin_total_global: false,
        rol_comunidad: 'miembro',
        comunidad_id: 3
      }
    }
  });

  return render(
    <UserContext.Provider value={{ user: currentUser }}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/interacciones" element={<Interacciones />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </UserContext.Provider>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
});

test('selector horizontal mostra Interação e Explorar sem ocultar publicações no estado inicial', async () => {
  renderInteracciones(sampleItems);

  const selector = screen.getByRole('group', { name: 'Selecionar painel superior' });
  expect(within(selector).getByRole('button', { name: 'Interação' })).toBeInTheDocument();
  expect(within(selector).getByRole('button', { name: 'Explorar' })).toBeInTheDocument();

  expect(await screen.findByText('Tenho ferramentas')).toBeInTheDocument();
  expect(screen.getByText('Preciso de uma mesa')).toBeInTheDocument();
  expect(screen.queryByText('Nova publicação')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Explorar' })).not.toBeInTheDocument();
});

test('click em Interação mostra Nova publicação e mantém publicações visíveis', async () => {
  renderInteracciones(sampleItems);

  await screen.findByText('Tenho ferramentas');
  await userEvent.click(screen.getByRole('button', { name: 'Interação' }));

  expect(screen.getByText('Nova publicação')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Explorar' })).not.toBeInTheDocument();
  expect(screen.getByText('Tenho ferramentas')).toBeInTheDocument();
  expect(screen.getByText('Preciso de uma mesa')).toBeInTheDocument();
});

test('click em Explorar mostra filtros e mantém publicações visíveis', async () => {
  renderInteracciones(sampleItems);

  await screen.findByText('Tenho ferramentas');
  await userEvent.click(screen.getByRole('button', { name: 'Explorar' }));

  expect(screen.getByRole('heading', { name: 'Explorar' })).toBeInTheDocument();
  expect(screen.queryByText('Nova publicação')).not.toBeInTheDocument();
  expect(screen.getByText('Tenho ferramentas')).toBeInTheDocument();
  expect(screen.getByText('Preciso de uma mesa')).toBeInTheDocument();
});

test('somente um card superior fica visível e segundo click volta ao estado neutro', async () => {
  renderInteracciones(sampleItems);

  await screen.findByText('Tenho ferramentas');
  await userEvent.click(screen.getByRole('button', { name: 'Interação' }));
  expect(screen.getByText('Nova publicação')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Explorar' }));
  expect(screen.getByRole('heading', { name: 'Explorar' })).toBeInTheDocument();
  expect(screen.queryByText('Nova publicação')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Explorar' }));
  expect(screen.queryByRole('heading', { name: 'Explorar' })).not.toBeInTheDocument();
  expect(screen.queryByText('Nova publicação')).not.toBeInTheDocument();
  expect(screen.getByText('Tenho ferramentas')).toBeInTheDocument();
});

test('filtros continuam funcionando dentro de Explorar', async () => {
  renderInteracciones(sampleItems);

  await screen.findByText('Tenho ferramentas');
  await userEvent.click(screen.getByRole('button', { name: 'Explorar' }));

  const filtros = screen.getByRole('group', { name: 'Filtros de exploração' });
  await userEvent.click(within(filtros).getByRole('button', { name: /Tipo Todos/i }));
  await userEvent.click(screen.getByRole('menuitemradio', { name: /Necessidade/i }));

  expect(screen.queryByText('Tenho ferramentas')).not.toBeInTheDocument();
  expect(screen.getByText('Preciso de uma mesa')).toBeInTheDocument();
});

test('criar publicação continua funcionando dentro de Interação', async () => {
  axios.post.mockResolvedValue({ data: {} });
  renderInteracciones(sampleItems);

  await screen.findByText('Tenho ferramentas');
  await userEvent.click(screen.getByRole('button', { name: 'Interação' }));
  await userEvent.type(
    screen.getByPlaceholderText('Do que você precisa ou o que pode oferecer?'),
    'Posso doar livros'
  );
  await userEvent.click(screen.getByRole('button', { name: 'Publicar' }));

  await waitFor(() => {
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:3000/api/interacciones',
      {
        user_id: 7,
        comunidad_id: 3,
        tipo: 'ayuda',
        categoria: 'servicio',
        descripcion: 'Posso doar livros',
        visibilidad: 'comunidad'
      }
    );
  });
});

test('interaccionId continua destacando e rolando até a publicação sem abrir painel superior', async () => {
  renderInteracciones(sampleItems, '/interacciones?interaccionId=11');

  await waitFor(() => {
    expect(document.getElementById('interaccion-11')).toHaveClass('is-notification-target');
  });
  await waitFor(() => {
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center'
    });
  });
  expect(screen.queryByText('Nova publicação')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Explorar' })).not.toBeInTheDocument();
});

test('polling continua chamando o mesmo GET de interações', async () => {
  jest.useFakeTimers();
  renderInteracciones(sampleItems);

  await screen.findByText('Tenho ferramentas');
  expect(axios.get).toHaveBeenCalledWith('http://localhost:3000/api/interacciones/3');

  act(() => {
    jest.advanceTimersByTime(10000);
  });

  await waitFor(() => {
    expect(axios.get).toHaveBeenCalledTimes(2);
  });
});

test('interação alheia mostra Conversar em privado e cria usando origin_interaccion_id', async () => {
  authClient.request.mockResolvedValue({ data: { id: 55 } });
  renderInteracciones([
    {
      id: 10,
      tipo: 'ayuda',
      categoria: 'servicio',
      descripcion: 'Tenho ferramentas',
      visibilidad: 'comunidad',
      estado: 'abierto',
      usuario: { id: 9, username: 'Maria' },
      comunidad: { nombre_comunidad: 'Comunidade Teste' },
      respuestas: []
    }
  ]);

  await userEvent.click(await screen.findByRole('button', { name: '💬 Conversar em privado' }));

  expect(authClient.request).toHaveBeenCalledWith({
    method: 'post',
    url: 'http://localhost:3000/api/conversas',
    data: { origin_interaccion_id: 10 }
  });
  expect(authClient.request.mock.calls[0][0].data).not.toHaveProperty('target_user_id');
  await waitFor(() => {
    expect(screen.getByTestId('location-path')).toHaveTextContent('/conversas/55');
  });
});

test('interação própria não mostra ação privada da publicação', async () => {
  renderInteracciones([
    {
      id: 11,
      tipo: 'necesidad',
      categoria: 'producto',
      descripcion: 'Preciso de uma mesa',
      visibilidad: 'comunidad',
      estado: 'abierto',
      usuario: { id: 7, username: 'Pessoa Atual' },
      comunidad: { nombre_comunidad: 'Comunidade Teste' },
      respuestas: []
    }
  ]);

  await screen.findByText('Preciso de uma mesa');

  expect(screen.queryByRole('button', { name: '💬 Conversar em privado' })).not.toBeInTheDocument();
});

test('resposta alheia permite privado usando origin_respuesta_id', async () => {
  authClient.request.mockResolvedValue({ data: { id: 88 } });
  renderInteracciones([
    {
      id: 12,
      tipo: 'ayuda',
      categoria: 'servicio',
      descripcion: 'Posso ajudar',
      visibilidad: 'comunidad',
      estado: 'abierto',
      usuario: { id: 7, username: 'Pessoa Atual' },
      comunidad: { nombre_comunidad: 'Comunidade Teste' },
      respuestas: [
        {
          id: 30,
          user_id: 9,
          mensaje: 'Eu também posso',
          estado: 'activa',
          usuario: { id: 9, username: 'João' }
        }
      ]
    }
  ]);

  await userEvent.click(await screen.findByRole('button', { name: /Ver respostas/ }));
  await userEvent.click(screen.getByRole('button', { name: '💬 Conversar em privado' }));

  expect(authClient.request).toHaveBeenCalledWith({
    method: 'post',
    url: 'http://localhost:3000/api/conversas',
    data: { origin_respuesta_id: 30 }
  });
  expect(authClient.request.mock.calls[0][0].data).not.toHaveProperty('target_user_id');
  await waitFor(() => {
    expect(screen.getByTestId('location-path')).toHaveTextContent('/conversas/88');
  });
});

test('resposta própria não mostra ação privada da resposta', async () => {
  renderInteracciones([
    {
      id: 13,
      tipo: 'ayuda',
      categoria: 'servicio',
      descripcion: 'Tenho tempo',
      visibilidad: 'comunidad',
      estado: 'abierto',
      usuario: { id: 9, username: 'Maria' },
      comunidad: { nombre_comunidad: 'Comunidade Teste' },
      respuestas: [
        {
          id: 31,
          user_id: 7,
          mensaje: 'Resposta minha',
          estado: 'activa',
          usuario: { id: 7, username: 'Pessoa Atual' }
        }
      ]
    }
  ]);

  await userEvent.click(await screen.findByRole('button', { name: /Ver respostas/ }));

  await waitFor(() => {
    expect(screen.getByText('Resposta minha')).toBeInTheDocument();
  });
  expect(screen.getAllByRole('button', { name: '💬 Conversar em privado' })).toHaveLength(1);
});
