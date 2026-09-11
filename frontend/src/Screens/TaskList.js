// src/Screens/TaskList.js
import React, { useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Container,
  Table,
  Button,
  Modal,
  Form,
  Alert,
  Spinner,
  Row,
  Col,
  ButtonGroup
} from 'react-bootstrap';

import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import ptBR from 'date-fns/locale/pt-BR';
import parseISO from 'date-fns/parseISO';
import { UserContext } from '../UserContext';
import { isAdminTotalGlobal } from '../utils/permissions';

const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const API_URL = `${process.env.REACT_APP_API_URL || ''}/api/tasks`;
const EMPTY_VALUE = '-';
const INITIAL_TASK_FORM = {
  title: '',
  description: '',
  frequency: 'semanal',
  dueDate: '',
  status: 'pendiente',
  priority: 'media'
};

const getTaskDueDate = (task) => task?.dueDate || task?.due_date || task?.due || '';

const canManageAgendaForUser = (user) => {
  if (!user) return false;
  if (isAdminTotalGlobal(user) || user.is_owner === true) return true;
  return ['admin_total', 'admin_basic'].includes(user.rol_comunidad);
};

const formatTaskDate = (value) => {
  if (!value) return EMPTY_VALUE;

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
  return date.toLocaleDateString('pt-BR');
};

const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalShow, setModalShow] = useState(false);
  const [detailModalShow, setDetailModalShow] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [form, setForm] = useState(INITIAL_TASK_FORM);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [frecuenciaFiltro, setFrecuenciaFiltro] = useState('');

  // viewMode: 'table' (default) or 'month'
  const [viewMode, setViewMode] = useState('table');
  const { user } = useContext(UserContext);
  const canManageAgenda = useMemo(
    () => canManageAgendaForUser(user),
    [user]
  );
  const canCreateOrEditTasks = useMemo(
    () => canManageAgenda,
    [canManageAgenda]
  );
  const canDeleteTasks = useMemo(
    () => canManageAgenda,
    [canManageAgenda]
  );

  useEffect(() => {
    if (!user) return;
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frecuenciaFiltro, user]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const url = frecuenciaFiltro ? `${API_URL}?frecuencia=${frecuenciaFiltro}` : API_URL;
      const res = await axios.get(url);
      setTasks(res.data || []);
      // Debug: ver qué devuelve la API
      // console.log('tasks from API', res.data);
    } catch (err) {
      showMessage('danger', 'Erro ao carregar tarefas');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3500);
  };

  const resetTaskForm = () => {
    setForm(INITIAL_TASK_FORM);
    setEditingId(null);
  };

  const closeTaskModal = () => {
    setModalShow(false);
    resetTaskForm();
  };

  const openModal = (task = null) => {
    if (!canCreateOrEditTasks) return;

    if (task) {
      // el backend puede enviar due_date o dueDate, created_at o createdAt
      setForm({
        title: task.title || '',
        description: task.description || '',
        frequency: task.frequency || 'semanal',
        dueDate: getTaskDueDate(task),
        status: task.status || 'pendiente',
        priority: task.priority || 'media'
      });
      setEditingId(task.id);
    } else {
      resetTaskForm();
    }
    setModalShow(true);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.dueDate) {
      showMessage('danger', 'A data de vencimento é obrigatória');
      return;
    }
    try {
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, form);
        showMessage('success', 'Tarefa atualizada');
      } else {
        await axios.post(API_URL, form);
        showMessage('success', 'Tarefa criada');
      }
      fetchTasks();
      closeTaskModal();
    } catch (err) {
      showMessage('danger', err.response?.data?.message || 'Erro ao salvar tarefa');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir esta tarefa?')) return false;
    try {
      await axios.delete(`${API_URL}/${id}`);
      showMessage('success', 'Tarefa excluída');
      fetchTasks();
      return true;
    } catch {
      showMessage('danger', 'Não foi possível excluir');
      return false;
    }
  };

  const closeDetailModal = () => {
    setDetailModalShow(false);
    setSelectedTask(null);
  };

  const handleEditSelectedTask = () => {
    const taskToEdit = selectedTask;
    if (!taskToEdit) return;
    closeDetailModal();
    openModal(taskToEdit);
  };

  const handleDeleteSelectedTask = async () => {
    if (!selectedTask) return;
    const deleted = await handleDelete(selectedTask.id);
    if (deleted) closeDetailModal();
  };

  // --- preparar eventos para calendario (month) ---
  const events = tasks
    .map(t => {
      // soporta dueDate (camel) o due_date (snake)
      const raw = getTaskDueDate(t);
      if (!raw) return null;

      // Si viene solo 'YYYY-MM-DD', concatenamos T00:00:00 para evitar desajustes por zona horaria
      let start;
      try {
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          start = new Date(`${raw}T00:00:00`);
        } else {
          // si viene con hora o Z, usar parseISO para manejar correctamente
          start = parseISO(raw);
        }
      } catch (err) {
        // fallback
        start = new Date(raw);
      }
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);

      return {
        id: t.id,
        title: t.title,
        start,
        end,
        resource: t
      };
    })
    .filter(Boolean);

  const handleSelectEvent = (event) => {
    if (!event?.resource) return;
    setSelectedTask(event.resource);
    setDetailModalShow(true);
  };

  const detailRows = selectedTask ? [
    ['Título', selectedTask.title || EMPTY_VALUE],
    ['Descrição', selectedTask.description || EMPTY_VALUE],
    ['Data de vencimento', formatTaskDate(getTaskDueDate(selectedTask))],
    ['Status', selectedTask.status || EMPTY_VALUE],
    ['Prioridade', selectedTask.priority || EMPTY_VALUE],
    ['Frequência', selectedTask.frequency || EMPTY_VALUE]
  ] : [];

  return (
    <Container className="mt-4">
      <Row className="mb-3 align-items-center">
        <Col><h2>📅 Agenda de Tarefas</h2></Col>

        <Col className="text-end d-flex gap-2 justify-content-end align-items-center">
          <Form.Select
            value={frecuenciaFiltro}
            onChange={(e) => { setFrecuenciaFiltro(e.target.value); setLoading(true); }}
            style={{ maxWidth: '220px' }}
          >
            <option value="">Todas as frequências</option>
            <option value="semanal">Semanal</option>
            <option value="mensual">Mensal</option>
            <option value="anual">Anual</option>
          </Form.Select>

          <ButtonGroup className="me-2">
            <Button variant={viewMode === 'table' ? 'primary' : 'outline-primary'} size="sm" onClick={() => setViewMode('table')}>Tabela</Button>
            <Button variant={viewMode === 'month' ? 'primary' : 'outline-primary'} size="sm" onClick={() => setViewMode('month')}>Mês</Button>
          </ButtonGroup>

          {canCreateOrEditTasks && (
            <Button onClick={() => openModal()} variant="primary">Nova tarefa</Button>
          )}
        </Col>
      </Row>

      {message.text && <Alert variant={message.type}>{message.text}</Alert>}

      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : tasks.length === 0 ? (
        <Alert variant="info">Não há tarefas disponíveis.</Alert>
      ) : (
        <>
          {/* CALENDAR: sólo vista "month" */}
          {viewMode === 'month' && (
            <div className="agenda-calendar" style={{ height: 600 }}>
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                views={['month']}
                defaultView="month"
                popup
                onSelectEvent={handleSelectEvent}
                messages={{ next: 'Próximo', previous: 'Anterior', today: 'Hoje', month: 'Mês', week: 'Semana', day: 'Dia' }}
                culture="pt-BR"
              />
            </div>
          )}

          {/* TABLA */}
          {viewMode === 'table' && (
            <Table striped bordered hover responsive className="mt-3">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Descrição</th>
                  <th>Vencimento</th>
                  <th>Estado</th>
                  <th>Criado em</th>
                  <th>Autor</th>
                  {canCreateOrEditTasks && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const dueStr = formatTaskDate(getTaskDueDate(task));
                  const createdRaw = task.createdAt || task.created_at || task.created;
                  const createdStr = formatTaskDate(createdRaw);
                  return (
                    <tr key={task.id}>
                      <td>{task.title}</td>
                      <td>{task.description}</td>
                      <td>{dueStr}</td>
                      <td>{task.status}</td>
                      <td>{createdStr}</td>
                      <td>{task.creator?.username || '-'}</td>
                      {canCreateOrEditTasks && (
                        <td>
                          <Button size="sm" variant="warning" onClick={() => openModal(task)} className="me-2">Editar</Button>
                          {canDeleteTasks && <Button size="sm" variant="danger" onClick={() => handleDelete(task.id)}>Excluir</Button>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </>
      )}

      {/* Modal crear/editar */}
      <Modal show={modalShow} onHide={closeTaskModal}>
        <Modal.Header closeButton>
          <Modal.Title>{editingId ? 'Editar tarefa' : 'Nova tarefa'}</Modal.Title>
        </Modal.Header>

        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Título</Form.Label>
              <Form.Control type="text" name="title" value={form.title} onChange={handleChange} required/>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Descrição</Form.Label>
              <Form.Control as="textarea" name="description" value={form.description} onChange={handleChange}/>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Frequência</Form.Label>
              <Form.Select name="frequency" value={form.frequency} onChange={handleChange}>
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensal</option>
                <option value="anual">Anual</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Data de vencimento</Form.Label>
              <Form.Control type="date" name="dueDate" value={form.dueDate} onChange={handleChange} required/>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Estado</Form.Label>
              <Form.Select name="status" value={form.status} onChange={handleChange}>
                <option value="pendiente">Pendente</option>
                <option value="en_progreso">Em andamento</option>
                <option value="completada">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Prioridade</Form.Label>
              <Form.Select name="priority" value={form.priority} onChange={handleChange}>
                <option value="baja">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </Form.Select>
              <Form.Text className="text-muted">A prioridade é salva, mas não aparece na tabela por design.</Form.Text>
            </Form.Group>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" onClick={closeTaskModal}>Cancelar</Button>
            <Button type="submit" variant="primary">{editingId ? 'Atualizar' : 'Criar'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={detailModalShow}
        onHide={closeDetailModal}
        dialogClassName="agenda-detail-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Detalhes da atividade</Modal.Title>
        </Modal.Header>

        <Modal.Body className="agenda-detail-modal__body">
          <dl className="agenda-detail-list">
            {detailRows.map(([label, value]) => (
              <div className="agenda-detail-list__row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Modal.Body>

        <Modal.Footer className="agenda-detail-modal__footer">
          {canDeleteTasks && (
            <Button variant="danger" onClick={handleDeleteSelectedTask}>
              Excluir
            </Button>
          )}
          {canCreateOrEditTasks && (
            <Button variant="warning" onClick={handleEditSelectedTask}>
              Editar
            </Button>
          )}
          <Button variant="secondary" onClick={closeDetailModal}>
            Fechar
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default TaskList;
