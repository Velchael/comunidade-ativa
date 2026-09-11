import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
        <button type="button" onClick={() => onSelectEvent(events[0])}>
          Evento do popup
        </button>
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

const secondTask = {
  ...task,
  id: 11,
  title: 'Mutirão de limpeza',
  description: 'Organizar praça',
  due_date: '2026-09-20',
  status: 'en_progreso',
  priority: 'alta',
  frequency: 'mensual'
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

const renderTaskList = async (user, taskData = [task]) => {
  axios.get.mockResolvedValueOnce({ data: taskData });

  render(
    <UserContext.Provider value={{ user }}>
      <TaskList />
    </UserContext.Provider>
  );

  await screen.findByText(taskData[0].title);
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('calendário mensal habilita popup nativo para tarefas ocultas', async () => {
  await renderTaskList(users.miembro);

  fireEvent.click(screen.getByRole('button', { name: 'Mês' }));

  expect(screen.getByTestId('calendar')).toBeInTheDocument();
  expect(screen.getByTestId('calendar').parentElement).toHaveClass('agenda-calendar');
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

test.each([
  ['moderador', users.moderador],
  ['miembro', users.miembro]
])('%s abre detalhes read-only pelo calendário', async (_label, user) => {
  await renderTaskList(user);

  fireEvent.click(screen.getByRole('button', { name: 'Mês' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reunião comunitária' }));

  const dialog = await screen.findByRole('dialog');

  expect(within(dialog).getByText('Detalhes da atividade')).toBeInTheDocument();
  expect(within(dialog).getByText('Título')).toBeInTheDocument();
  expect(within(dialog).getByText('Reunião comunitária')).toBeInTheDocument();
  expect(within(dialog).getByText('Alinhar agenda')).toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
  expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
  expect(within(dialog).queryByDisplayValue('Reunião comunitária')).not.toBeInTheDocument();
});

test.each([
  ['admin_basic', users.adminBasic],
  ['admin_total global', users.adminTotalGlobal],
  ['admin_total local', users.adminTotalLocal],
  ['owner', users.owner]
])('%s abre detalhes com ações administrativas pelo calendário', async (_label, user) => {
  await renderTaskList(user);

  fireEvent.click(screen.getByRole('button', { name: 'Mês' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reunião comunitária' }));

  const dialog = await screen.findByRole('dialog');

  expect(within(dialog).getByText('Detalhes da atividade')).toBeInTheDocument();
  expect(within(dialog).getByText('Reunião comunitária')).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
});

test('Fechar encerra detalhe e próxima atividade mostra dados corretos', async () => {
  await renderTaskList(users.miembro, [task, secondTask]);

  fireEvent.click(screen.getByRole('button', { name: 'Mês' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reunião comunitária' }));

  let dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Alinhar agenda')).toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));

  await waitFor(() => {
    expect(screen.queryByText('Detalhes da atividade')).not.toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: 'Mutirão de limpeza' }));

  dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Mutirão de limpeza')).toBeInTheDocument();
  expect(within(dialog).getByText('Organizar praça')).toBeInTheDocument();
  expect(within(dialog).queryByText('Alinhar agenda')).not.toBeInTheDocument();
});

test('admin abre edição a partir do detalhe do calendário', async () => {
  await renderTaskList(users.adminBasic);

  fireEvent.click(screen.getByRole('button', { name: 'Mês' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reunião comunitária' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));

  await waitFor(() => {
    expect(screen.getByText('Editar tarefa')).toBeInTheDocument();
  });
  expect(screen.getByDisplayValue('Reunião comunitária')).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.queryByText('Detalhes da atividade')).not.toBeInTheDocument();
  });
});

test('edição cancelada limpa formulário antes de editar outra atividade', async () => {
  await renderTaskList(users.adminBasic, [task, secondTask]);

  fireEvent.click(screen.getByRole('button', { name: 'Mês' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reunião comunitária' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));

  await screen.findByDisplayValue('Reunião comunitária');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

  await waitFor(() => {
    expect(screen.queryByText('Editar tarefa')).not.toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: 'Mutirão de limpeza' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));

  await screen.findByDisplayValue('Mutirão de limpeza');
  expect(screen.getByDisplayValue('Organizar praça')).toBeInTheDocument();
  expect(screen.queryByDisplayValue('Reunião comunitária')).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('Alinhar agenda')).not.toBeInTheDocument();
});

test.each([
  ['moderador', users.moderador],
  ['miembro', users.miembro]
])('%s nao entra em edição direta pelo calendário', async (_label, user) => {
  await renderTaskList(user);

  fireEvent.click(screen.getByRole('button', { name: 'Mês' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reunião comunitária' }));

  await waitFor(() => {
    expect(screen.queryByText('Editar tarefa')).not.toBeInTheDocument();
  });
});

test('delete cancelado mantém detalhe aberto e não chama API', async () => {
  window.confirm = jest.fn(() => false);
  await renderTaskList(users.adminBasic);

  fireEvent.click(screen.getByRole('button', { name: 'Mês' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reunião comunitária' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }));

  expect(window.confirm).toHaveBeenCalledWith('Excluir esta tarefa?');
  expect(axios.delete).not.toHaveBeenCalled();
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('Detalhes da atividade')).toBeInTheDocument();
  expect(within(dialog).getByText('Reunião comunitária')).toBeInTheDocument();
});

test('delete falho mantém detalhe aberto com task selecionada', async () => {
  window.confirm = jest.fn(() => true);
  axios.delete.mockRejectedValueOnce(new Error('erro'));
  await renderTaskList(users.adminBasic);

  fireEvent.click(screen.getByRole('button', { name: 'Mês' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reunião comunitária' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }));

  await waitFor(() => {
    expect(axios.delete).toHaveBeenCalledWith('/api/tasks/10');
  });
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('Detalhes da atividade')).toBeInTheDocument();
  expect(within(dialog).getByText('Reunião comunitária')).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByText('Não foi possível excluir')).toBeInTheDocument();
  });
});

test('admin exclui tarefa a partir do detalhe usando fluxo existente', async () => {
  window.confirm = jest.fn(() => true);
  axios.delete.mockResolvedValueOnce({});
  axios.get
    .mockResolvedValueOnce({ data: [task] })
    .mockResolvedValueOnce({ data: [] });

  render(
    <UserContext.Provider value={{ user: users.adminBasic }}>
      <TaskList />
    </UserContext.Provider>
  );

  await screen.findByText('Reunião comunitária');

  fireEvent.click(screen.getByRole('button', { name: 'Mês' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reunião comunitária' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }));

  await waitFor(() => {
    expect(axios.delete).toHaveBeenCalledWith('/api/tasks/10');
  });
  expect(window.confirm).toHaveBeenCalledWith('Excluir esta tarefa?');
  await waitFor(() => {
    expect(screen.queryByText('Detalhes da atividade')).not.toBeInTheDocument();
  });
});

test('evento selecionado desde popup usa o mesmo modal de detalhe', async () => {
  await renderTaskList(users.miembro);

  fireEvent.click(screen.getByRole('button', { name: 'Mês' }));
  fireEvent.click(screen.getByRole('button', { name: 'Evento do popup' }));

  const dialog = await screen.findByRole('dialog');

  expect(within(dialog).getByText('Detalhes da atividade')).toBeInTheDocument();
  expect(within(dialog).getByText('Reunião comunitária')).toBeInTheDocument();
});

test('detalhe usa fallback para campos ausentes ou inválidos', async () => {
  const incompleteTask = {
    id: 12,
    title: 'Atividade incompleta',
    description: null,
    frequency: null,
    due_date: 'data-invalida',
    status: '',
    priority: null
  };

  await renderTaskList(users.miembro, [incompleteTask]);

  fireEvent.click(screen.getByRole('button', { name: 'Mês' }));
  fireEvent.click(screen.getByRole('button', { name: 'Atividade incompleta' }));

  const dialog = await screen.findByRole('dialog');

  expect(within(dialog).getByText('Atividade incompleta')).toBeInTheDocument();
  expect(within(dialog).getAllByText('-')).toHaveLength(5);
  expect(within(dialog).queryByText('undefined')).not.toBeInTheDocument();
  expect(within(dialog).queryByText('null')).not.toBeInTheDocument();
  expect(within(dialog).queryByText('Invalid Date')).not.toBeInTheDocument();
});
