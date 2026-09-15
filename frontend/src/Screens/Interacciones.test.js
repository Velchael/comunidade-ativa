import { render, screen, waitFor } from '@testing-library/react';
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

const renderInteracciones = (items) => {
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
      <MemoryRouter initialEntries={['/interacciones']}>
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
