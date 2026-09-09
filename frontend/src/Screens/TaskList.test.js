import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import TaskList from './TaskList';
import { UserContext } from '../UserContext';

const mockCalendarProps = jest.fn();

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
    put: jest.fn(),
    delete: jest.fn(),
    request: jest.fn()
  }
}));

jest.mock('react-big-calendar', () => ({
  Calendar: (props) => {
    mockCalendarProps(props);
    const { events, onSelectEvent } = props;

    return (
      <div data-testid="calendar">
        {events.map((event) => (
          <button key={event.id} type="button" onClick={() => onSelectEvent(event)}>
            {event.title}
          </button>
        ))}
      </div>
    );
  },
  dateFnsLocalizer: () => ({})
}));

const task = {
  id: 10,
  title: 'Reunião comunitária',
  description: 'Alinhar agenda',
  frequency: 'semanal',
  due_date: '2026-09-15',
  status: 'pendiente',
  priority: 'media',
  created_at: '2026-09-01T00:00:00.000Z',
  creator: { username: 'Admin' }
};

const baseUser = {
  id: 1,
  rol: 'miembro',
  rol_global: 'miembro',
  rol_comunidad: 'miembro',
  is_owner: false,
  can_manage_comunidad: false
};

const users = {
  adminTotalGlobal: {
    ...baseUser,
    rol_global: 'admin_total'
  },
  adminTotalLocal: {
    ...baseUser,
    comunidad_id: 7,
    rol_comunidad: 'admin_total',
    can_manage_comunidad: true
  },
  owner: {
    ...baseUser,
    is_owner: true,
    can_manage_comunidad: true
  },
  adminBasic: {
    ...baseUser,
    rol_comunidad: 'admin_basic'
  },
  moderador: {
    ...baseUser,
    rol_comunidad: 'moderador'
  },
  miembro: baseUser
};

const renderTaskList = async (user) => {
  axios.get.mockResolvedValueOnce({ data: [task] });

  render(
    <UserContext.Provider value={{ user }}>
      <TaskList />
    </UserContext.Provider>
  );

  await screen.findByText('Reunião comunitária');
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('calendário mensal habilita popup nativo para tarefas ocultas', async () => {
  await renderTaskList(users.miembro);

  fireEvent.click(screen.getByRole('button', { name: 'Mês' }));

  expect(screen.getByTestId('calendar')).toBeInTheDocument();
  expect(mockCalendarProps).toHaveBeenLastCalledWith(
    expect.objectContaining({
      views: ['month'],
      defaultView: 'month',
      popup: true
    })
  );
});

test.each([
  ['admin_total global', users.adminTotalGlobal],
  ['admin_total local', users.adminTotalLocal],
  ['owner', users.owner],
  ['admin_basic', users.adminBasic]
])('%s pode criar, editar e excluir tarefas', async (_label, user) => {
  await renderTaskList(user);

  expect(screen.getByText(/Agenda de Tarefas/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Nova tarefa' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
});

test.each([
  ['moderador', users.moderador],
  ['miembro', users.miembro]
])('%s ve agenda sem ações administrativas', async (_label, user) => {
  await renderTaskList(user);

  expect(screen.getByText(/Agenda de Tarefas/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Nova tarefa' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
});

test('admin pode abrir edição pelo calendário', async () => {
  await renderTaskList(users.adminBasic);

  fireEvent.click(screen.getByRole('button', { name: 'Mês' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reunião comunitária' }));

  await waitFor(() => {
    expect(screen.getByText('Editar tarefa')).toBeInTheDocument();
  });
});

test.each([
  ['moderador', users.moderador],
  ['miembro', users.miembro]
])('%s nao entra em edição pelo calendário', async (_label, user) => {
  await renderTaskList(user);

  fireEvent.click(screen.getByRole('button', { name: 'Mês' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reunião comunitária' }));

  await waitFor(() => {
    expect(screen.queryByText('Editar tarefa')).not.toBeInTheDocument();
  });
});
