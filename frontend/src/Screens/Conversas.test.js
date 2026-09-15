import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Conversas, { mergeMessagesById } from './Conversas';
import { UserContext } from '../UserContext';
import authClient from '../services/authClient';

jest.mock('../services/authClient', () => ({
  request: jest.fn()
}));

jest.mock('../UserContext', () => {
  const React = require('react');
  return {
    UserContext: React.createContext()
  };
});

const currentUser = {
  id: 7,
  username: 'Pessoa Atual'
};

const conversa = {
  id: 12,
  outro_participante: {
    id: 9,
    username: 'Maria Silva',
    foto_perfil: null
  },
  ultimo_mensagem: {
    id: 3,
    corpo: 'Posso ajudar amanhã.',
    sender_user_id: 9,
    created_at: '2026-09-15T14:32:00.000Z'
  },
  last_message_at: '2026-09-15T14:32:00.000Z',
  unread_count: 2,
  can_send: true
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-path">{location.pathname}</div>;
}

function RouteControls() {
  const navigate = useNavigate();
  return (
    <div>
      <button type="button" onClick={() => navigate('/conversas/12')}>Ir conversa 12</button>
      <button type="button" onClick={() => navigate('/conversas/13')}>Ir conversa 13</button>
    </div>
  );
}

const renderConversas = (initialPath = '/conversas') => render(
  <UserContext.Provider value={{ user: currentUser }}>
    <MemoryRouter initialEntries={[initialPath]}>
      <LocationProbe />
      <RouteControls />
      <Routes>
        <Route path="/conversas" element={<Conversas />} />
        <Route path="/conversas/:id" element={<Conversas />} />
      </Routes>
    </MemoryRouter>
  </UserContext.Provider>
);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  window.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
});

test('lista vazia mostra estado vazio', async () => {
  authClient.request.mockResolvedValue({ data: { items: [] } });

  renderConversas();

  expect(await screen.findByText('Você ainda não tem conversas.')).toBeInTheDocument();
  expect(screen.getByText('As conversas podem começar a partir de uma interação.')).toBeInTheDocument();
});

test('lista conversas, mostra não lidas e abre /conversas/:id ao clicar', async () => {
  authClient.request.mockResolvedValue({ data: { items: [conversa] } });

  renderConversas();

  expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
  expect(screen.getByText('Posso ajudar amanhã.')).toBeInTheDocument();
  expect(screen.getByText('2 não lidas')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /Maria Silva/i }));

  expect(screen.getByTestId('location-path')).toHaveTextContent('/conversas/12');
});

test('rota /conversas/:id carrega mensagens, diferencia autoria e marca como lida', async () => {
  authClient.request.mockImplementation(async (config) => {
    if (config.url.endsWith('/api/conversas?limit=100')) {
      return { data: { items: [conversa] } };
    }
    if (config.url.endsWith('/api/conversas/12/mensagens?limit=50')) {
      return {
        data: {
          items: [
            { id: 1, sender_user_id: 9, corpo: 'Oi!', created_at: '2026-09-15T14:31:00.000Z' },
            { id: 2, sender_user_id: 7, corpo: 'Obrigado!', created_at: '2026-09-15T14:32:00.000Z' }
          ]
        }
      };
    }
    if (config.method === 'patch') return { data: { marked_read: 1 } };
    return { data: {} };
  });

  renderConversas('/conversas/12');

  expect(await screen.findByRole('heading', { name: 'Maria Silva' })).toBeInTheDocument();
  expect(screen.getByText('Oi!')).toBeInTheDocument();
  expect(screen.getByText('Obrigado!')).toBeInTheDocument();
  expect(screen.getByText('Maria Silva', { selector: '.conversa-message__author' })).toBeInTheDocument();
  expect(screen.getByText('Você')).toBeInTheDocument();
  expect(authClient.request).toHaveBeenCalledWith({
    method: 'patch',
    url: 'http://localhost:3000/api/conversas/12/lida'
  });
});

test('envia mensagem válida e vazio ou maior que 2000 não envia', async () => {
  authClient.request.mockImplementation(async (config) => {
    if (config.url.endsWith('/api/conversas?limit=100')) return { data: { items: [conversa] } };
    if (config.url.endsWith('/api/conversas/12/mensagens?limit=50')) return { data: { items: [] } };
    if (config.method === 'patch') return { data: { marked_read: 0 } };
    if (config.method === 'post') {
      return {
        data: {
          id: 5,
          sender_user_id: 7,
          corpo: config.data.corpo,
          created_at: '2026-09-15T14:40:00.000Z'
        }
      };
    }
    return { data: {} };
  });

  renderConversas('/conversas/12');

  const input = await screen.findByLabelText('Digite uma mensagem');
  const sendButton = screen.getByRole('button', { name: 'Enviar' });
  expect(sendButton).toBeDisabled();

  fireEvent.change(input, { target: { value: 'x'.repeat(2001) } });
  expect(sendButton).toBeDisabled();
  expect(screen.getByText('A mensagem deve ter no máximo 2000 caracteres.')).toBeInTheDocument();

  fireEvent.change(input, { target: { value: '  Olá Maria  ' } });
  await userEvent.click(sendButton);

  expect(await screen.findByText('Olá Maria')).toBeInTheDocument();
  expect(authClient.request).toHaveBeenCalledWith({
    method: 'post',
    url: 'http://localhost:3000/api/conversas/12/mensagens',
    data: { corpo: 'Olá Maria' }
  });
});

test('can_send=false mostra histórico e impede envio', async () => {
  authClient.request.mockImplementation(async (config) => {
    if (config.url.endsWith('/api/conversas?limit=100')) {
      return { data: { items: [{ ...conversa, can_send: false }] } };
    }
    if (config.url.endsWith('/api/conversas/12/mensagens?limit=50')) {
      return { data: { items: [{ id: 1, sender_user_id: 9, corpo: 'Histórico', created_at: '2026-09-15T14:31:00.000Z' }] } };
    }
    if (config.method === 'patch') return { data: { marked_read: 1 } };
    return { data: {} };
  });

  renderConversas('/conversas/12');

  expect(await screen.findByText('Histórico')).toBeInTheDocument();
  expect(screen.getByText('Não é possível enviar novas mensagens nesta conversa.')).toBeInTheDocument();
  expect(screen.queryByLabelText('Digite uma mensagem')).not.toBeInTheDocument();
});

test('403 ao enviar desabilita envio e conserva texto', async () => {
  authClient.request.mockImplementation(async (config) => {
    if (config.url.endsWith('/api/conversas?limit=100')) return { data: { items: [conversa] } };
    if (config.url.endsWith('/api/conversas/12/mensagens?limit=50')) return { data: { items: [] } };
    if (config.method === 'patch') return { data: { marked_read: 0 } };
    if (config.method === 'post') {
      const error = new Error('forbidden');
      error.response = { status: 403, data: { message: 'Sem permissão' } };
      throw error;
    }
    return { data: {} };
  });

  renderConversas('/conversas/12');

  const input = await screen.findByLabelText('Digite uma mensagem');
  fireEvent.change(input, { target: { value: 'Ainda está aí?' } });
  await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

  expect(await screen.findAllByText('Não é possível enviar novas mensagens nesta conversa.')).toHaveLength(2);
  expect(input).toHaveValue('Ainda está aí?');
});

test('polling incremental usa after_id e não duplica mensagens', async () => {
  jest.useFakeTimers();
  let pollCount = 0;

  authClient.request.mockImplementation(async (config) => {
    if (config.url.endsWith('/api/conversas?limit=100')) return { data: { items: [conversa] } };
    if (config.url.endsWith('/api/conversas/12/mensagens?limit=50')) {
      return { data: { items: [{ id: 1, sender_user_id: 9, corpo: 'Inicial', created_at: '2026-09-15T14:31:00.000Z' }] } };
    }
    if (config.url.endsWith('/api/conversas/12/mensagens?after_id=1&limit=50')) {
      pollCount += 1;
      return {
        data: {
          items: [{ id: 2, sender_user_id: 9, corpo: 'Nova', created_at: '2026-09-15T14:35:00.000Z' }]
        }
      };
    }
    if (config.url.endsWith('/api/conversas/12/mensagens?after_id=2&limit=50')) {
      return {
        data: {
          items: [{ id: 2, sender_user_id: 9, corpo: 'Nova', created_at: '2026-09-15T14:35:00.000Z' }]
        }
      };
    }
    if (config.method === 'patch') return { data: { marked_read: 1 } };
    return { data: {} };
  });

  renderConversas('/conversas/12');
  expect(await screen.findByText('Inicial')).toBeInTheDocument();

  await act(async () => {
    jest.advanceTimersByTime(5000);
  });

  expect(await screen.findByText('Nova')).toBeInTheDocument();
  expect(authClient.request).toHaveBeenCalledWith({
    method: 'get',
    url: 'http://localhost:3000/api/conversas/12/mensagens?after_id=1&limit=50'
  });

  await act(async () => {
    jest.advanceTimersByTime(5000);
  });

  expect(screen.getAllByText('Nova')).toHaveLength(1);
  expect(pollCount).toBe(1);
});

test('resposta atrasada de outra conversa não contamina a rota atual', async () => {
  let resolveConversa12;
  const conversa12Promise = new Promise((resolve) => {
    resolveConversa12 = resolve;
  });
  const conversa13 = {
    ...conversa,
    id: 13,
    outro_participante: { id: 10, username: 'João Santos', foto_perfil: null }
  };

  authClient.request.mockImplementation(async (config) => {
    if (config.url.endsWith('/api/conversas?limit=100')) {
      return { data: { items: [conversa, conversa13] } };
    }
    if (config.url.endsWith('/api/conversas/12/mensagens?limit=50')) {
      return conversa12Promise;
    }
    if (config.url.endsWith('/api/conversas/13/mensagens?limit=50')) {
      return {
        data: {
          items: [{ id: 8, sender_user_id: 10, corpo: 'Mensagem atual', created_at: '2026-09-15T15:00:00.000Z' }]
        }
      };
    }
    if (config.method === 'patch') return { data: { marked_read: 1 } };
    return { data: {} };
  });

  renderConversas('/conversas/12');
  await userEvent.click(screen.getByRole('button', { name: 'Ir conversa 13' }));

  expect(await screen.findByText('Mensagem atual')).toBeInTheDocument();

  await act(async () => {
    resolveConversa12({
      data: {
        items: [{ id: 1, sender_user_id: 9, corpo: 'Mensagem antiga', created_at: '2026-09-15T14:00:00.000Z' }]
      }
    });
  });

  expect(screen.queryByText('Mensagem antiga')).not.toBeInTheDocument();
  expect(screen.getByText('Mensagem atual')).toBeInTheDocument();
});

test('carregar mensagens anteriores usa before_id', async () => {
  const initialMessages = Array.from({ length: 50 }, (_, index) => ({
    id: index + 2,
    sender_user_id: index % 2 ? 7 : 9,
    corpo: `Mensagem ${index + 2}`,
    created_at: '2026-09-15T14:31:00.000Z'
  }));

  authClient.request.mockImplementation(async (config) => {
    if (config.url.endsWith('/api/conversas?limit=100')) return { data: { items: [conversa] } };
    if (config.url.endsWith('/api/conversas/12/mensagens?limit=50')) return { data: { items: initialMessages } };
    if (config.url.endsWith('/api/conversas/12/mensagens?before_id=2&limit=50')) {
      return { data: { items: [{ id: 1, sender_user_id: 9, corpo: 'Mais antiga', created_at: '2026-09-15T14:00:00.000Z' }] } };
    }
    if (config.method === 'patch') return { data: { marked_read: 1 } };
    return { data: {} };
  });

  renderConversas('/conversas/12');

  await userEvent.click(await screen.findByRole('button', { name: 'Carregar mensagens anteriores' }));

  expect(await screen.findByText('Mais antiga')).toBeInTheDocument();
  expect(authClient.request).toHaveBeenCalledWith({
    method: 'get',
    url: 'http://localhost:3000/api/conversas/12/mensagens?before_id=2&limit=50'
  });
});

test('mergeMessagesById ordena e remove duplicados por id', () => {
  expect(mergeMessagesById([{ id: 2, corpo: 'b' }], [{ id: 1, corpo: 'a' }, { id: 2, corpo: 'b2' }]))
    .toEqual([{ id: 1, corpo: 'a' }, { id: 2, corpo: 'b2' }]);
});
