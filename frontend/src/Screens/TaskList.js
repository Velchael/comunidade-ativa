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
import {
  canManageCommunity,
  isAdminTotalGlobal
} from '../utils/permissions';

const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const API_URL = `${process.env.REACT_APP_API_URL || ''}/api/tasks`;

const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalShow, setModalShow] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    frequency: 'semanal',
    dueDate: '',
    status: 'pendiente',
    priority: 'media'
  });
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [frecuenciaFiltro, setFrecuenciaFiltro] = useState('');

  // viewMode: 'table' (default) or 'month'
  const [viewMode, setViewMode] = useState('table');
  const { user } = useContext(UserContext);
  const canCreateOrEditTasks = useMemo(
    () => isAdminTotalGlobal(user) || canManageCommunity(user),
    [user]
  );
  const canDeleteTasks = useMemo(
    () => isAdminTotalGlobal(user),
    [user]
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frecuenciaFiltro]);

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

  const openModal = (task = null) => {
    if (task) {
      // el backend puede enviar due_date o dueDate, created_at o createdAt
      setForm({
        title: task.title || '',
        description: task.description || '',
        frequency: task.frequency || 'semanal',
        dueDate: task.dueDate || task.due_date || '',
        status: task.status || 'pendiente',
        priority: task.priority || 'media'
      });
      setEditingId(task.id);
    } else {
      setForm({ title: '', description: '', frequency: 'semanal', dueDate: '', status: 'pendiente', priority: 'media' });
      setEditingId(null);
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
      setModalShow(false);
    } catch (err) {
      showMessage('danger', err.response?.data?.message || 'Erro ao salvar tarefa');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir esta tarefa?')) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      showMessage('success', 'Tarefa excluída');
      fetchTasks();
    } catch {
      showMessage('danger', 'Não foi possível excluir');
    }
  };

  // --- preparar eventos para calendario (month) ---
  const events = tasks
    .map(t => {
      // soporta dueDate (camel) o due_date (snake)
      const raw = t.dueDate || t.due_date || t.due || '';
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
    if (event?.resource) openModal(event.resource);
  };

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
            <div style={{ height: 600 }}>
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                views={['month']}
                defaultView="month"
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
                  const rawDue = task.dueDate || task.due_date || task.due;
                  const due = rawDue ? (/\d{4}-\d{2}-\d{2}/.test(rawDue) ? new Date(`${rawDue}T00:00:00`) : new Date(rawDue)) : null;
                  const dueStr = due ? due.toLocaleDateString('pt-BR') : '-';
                  const createdRaw = task.createdAt || task.created_at || task.created;
                  const created = createdRaw ? new Date(createdRaw) : null;
                  const createdStr = created ? created.toLocaleDateString('pt-BR') : '-';
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
      <Modal show={modalShow} onHide={() => setModalShow(false)}>
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
            <Button variant="secondary" onClick={() => setModalShow(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">{editingId ? 'Atualizar' : 'Criar'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default TaskList;
