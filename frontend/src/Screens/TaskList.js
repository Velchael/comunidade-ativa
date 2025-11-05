// src/Screens/TaskList.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
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
import es from 'date-fns/locale/es';
import parseISO from 'date-fns/parseISO';

const locales = { es };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const API_URL = `${process.env.REACT_APP_API_URL || ''}/api/tasks`;

const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [userRole, setUserRole] = useState('');
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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    const decoded = jwtDecode(token);
    setUserRole((decoded.rol || '').toLowerCase());
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
      showMessage('danger', 'Error al cargar tareas');
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
      showMessage('danger', 'La fecha de vencimiento es obligatoria');
      return;
    }
    try {
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, form);
        showMessage('success', 'Tarea actualizada');
      } else {
        await axios.post(API_URL, form);
        showMessage('success', 'Tarea creada');
      }
      fetchTasks();
      setModalShow(false);
    } catch (err) {
      showMessage('danger', err.response?.data?.message || 'Error al guardar tarea');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta tarea?')) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      showMessage('success', 'Tarea eliminada');
      fetchTasks();
    } catch {
      showMessage('danger', 'No se pudo eliminar');
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
        <Col><h2>📅 Agenda de Tareas</h2></Col>

        <Col className="text-end d-flex gap-2 justify-content-end align-items-center">
          <Form.Select
            value={frecuenciaFiltro}
            onChange={(e) => { setFrecuenciaFiltro(e.target.value); setLoading(true); }}
            style={{ maxWidth: '220px' }}
          >
            <option value="">Todas las frecuencias</option>
            <option value="semanal">Semanal</option>
            <option value="mensual">Mensual</option>
            <option value="anual">Anual</option>
          </Form.Select>

          <ButtonGroup className="me-2">
            <Button variant={viewMode === 'table' ? 'primary' : 'outline-primary'} size="sm" onClick={() => setViewMode('table')}>Tabla</Button>
            <Button variant={viewMode === 'month' ? 'primary' : 'outline-primary'} size="sm" onClick={() => setViewMode('month')}>Mes</Button>
          </ButtonGroup>

          {(userRole === 'admin_total' || userRole === 'admin_basic') && (
            <Button onClick={() => openModal()} variant="primary">Nueva tarea</Button>
          )}
        </Col>
      </Row>

      {message.text && <Alert variant={message.type}>{message.text}</Alert>}

      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : tasks.length === 0 ? (
        <Alert variant="info">No hay tareas disponibles.</Alert>
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
                messages={{ next: 'Siguiente', previous: 'Anterior', today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' }}
                culture="es"
              />
            </div>
          )}

          {/* TABLA */}
          {viewMode === 'table' && (
            <Table striped bordered hover responsive className="mt-3">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Descripción</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th>Autor</th>
                  {(userRole === 'admin_total' || userRole === 'admin_basic') && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const rawDue = task.dueDate || task.due_date || task.due;
                  const due = rawDue ? (/\d{4}-\d{2}-\d{2}/.test(rawDue) ? new Date(`${rawDue}T00:00:00`) : new Date(rawDue)) : null;
                  const dueStr = due ? due.toLocaleDateString('es-ES') : '-';
                  const createdRaw = task.createdAt || task.created_at || task.created;
                  const created = createdRaw ? new Date(createdRaw) : null;
                  const createdStr = created ? created.toLocaleDateString('es-ES') : '-';
                  return (
                    <tr key={task.id}>
                      <td>{task.title}</td>
                      <td>{task.description}</td>
                      <td>{dueStr}</td>
                      <td>{task.status}</td>
                      <td>{createdStr}</td>
                      <td>{task.creator?.username || '-'}</td>
                      {(userRole === 'admin_total' || userRole === 'admin_basic') && (
                        <td>
                          <Button size="sm" variant="warning" onClick={() => openModal(task)} className="me-2">Editar</Button>
                          {userRole === 'admin_total' && <Button size="sm" variant="danger" onClick={() => handleDelete(task.id)}>Eliminar</Button>}
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
          <Modal.Title>{editingId ? 'Editar Tarea' : 'Nueva Tarea'}</Modal.Title>
        </Modal.Header>

        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Título</Form.Label>
              <Form.Control type="text" name="title" value={form.title} onChange={handleChange} required/>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Descripción</Form.Label>
              <Form.Control as="textarea" name="description" value={form.description} onChange={handleChange}/>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Frecuencia</Form.Label>
              <Form.Select name="frequency" value={form.frequency} onChange={handleChange}>
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
                <option value="anual">Anual</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Fecha de vencimiento</Form.Label>
              <Form.Control type="date" name="dueDate" value={form.dueDate} onChange={handleChange} required/>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Estado</Form.Label>
              <Form.Select name="status" value={form.status} onChange={handleChange}>
                <option value="pendiente">Pendiente</option>
                <option value="en_progreso">En progreso</option>
                <option value="completada">Completada</option>
                <option value="cancelada">Cancelada</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Prioridad</Form.Label>
              <Form.Select name="priority" value={form.priority} onChange={handleChange}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </Form.Select>
              <Form.Text className="text-muted">La prioridad se guarda, no aparece en la tabla por diseño.</Form.Text>
            </Form.Group>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" onClick={() => setModalShow(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">{editingId ? 'Actualizar' : 'Crear'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default TaskList;

