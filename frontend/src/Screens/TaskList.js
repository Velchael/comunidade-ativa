// src/components/TaskList.js
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
  Col
} from 'react-bootstrap';

const API_URL = `${process.env.REACT_APP_API_URL}/api/tasks`;

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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    const decoded = jwtDecode(token);
    setUserRole(decoded.rol.toLowerCase());
    fetchTasks();
  }, [frecuenciaFiltro]);

  const fetchTasks = async () => {
    try {
      const url = frecuenciaFiltro ? `${API_URL}?frecuencia=${frecuenciaFiltro}` : API_URL;
      const res = await axios.get(url);
      setTasks(res.data);
    } catch (err) {
      showMessage('danger', 'Error al cargar tareas');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const openModal = (task = null) => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description,
        frequency: task.frequency,
        dueDate: task.dueDate || '',
        status: task.status,
        priority: task.priority
      });
      setEditingId(task.id);
    } else {
      setForm({ title: '', description: '', frequency: 'semanal', dueDate: '', status: 'pendiente', priority: 'media' });
      setEditingId(null);
    }
    setModalShow(true);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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

  return (
    <Container className="mt-4">
      <Row className="mb-3 align-items-center">
        <Col><h2>📅 Agenda de Tareas</h2></Col>
        {userRole === 'administrador' && (
          <Col className="text-end d-flex gap-2 justify-content-end">
            <Form.Select
              value={frecuenciaFiltro}
              onChange={(e) => {
                setFrecuenciaFiltro(e.target.value);
                setLoading(true);
              }}
              style={{ maxWidth: '200px' }}
            >
              <option value="">Todas las frecuencias</option>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
            </Form.Select>
            <Button onClick={() => openModal()} variant="primary">
              Nueva tarea
            </Button>
          </Col>
        )}
      </Row>

      {message.text && <Alert variant={message.type}>{message.text}</Alert>}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <div>Cargando tareas...</div>
        </div>
      ) : tasks.length === 0 ? (
        <Alert variant="info">No hay tareas disponibles.</Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Título</th>
              <th>Descripción</th>
              <th>Frecuencia</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Autor</th>
              {userRole === 'administrador' && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>{task.title}</td>
                <td>{task.description}</td>
                <td>{task.frequency}</td>
                <td>{task.dueDate}</td>
                <td>{task.status}</td>
                <td>{task.priority}</td>
                <td>{task.creator?.username || '-'}</td>
                {userRole === 'administrador' && (
                  <td>
                    <Button
                      size="sm"
                      variant="warning"
                      onClick={() => openModal(task)}
                      className="me-2"
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(task.id)}
                    >
                      Eliminar
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal show={modalShow} onHide={() => setModalShow(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{editingId ? 'Editar Tarea' : 'Nueva Tarea'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Título</Form.Label>
              <Form.Control
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Descripción</Form.Label>
              <Form.Control
                as="textarea"
                name="description"
                value={form.description}
                onChange={handleChange}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Frecuencia</Form.Label>
              <Form.Select
                name="frequency"
                value={form.frequency}
                onChange={handleChange}
              >
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
                <option value="anual">Anual</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Fecha de vencimiento</Form.Label>
              <Form.Control
                type="date"
                name="dueDate"
                value={form.dueDate}
                onChange={handleChange}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Estado</Form.Label>
              <Form.Select
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                <option value="pendiente">Pendiente</option>
                <option value="en_progreso">En progreso</option>
                <option value="completada">Completada</option>
                <option value="cancelada">Cancelada</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Prioridad</Form.Label>
              <Form.Select
                name="priority"
                value={form.priority}
                onChange={handleChange}
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setModalShow(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {editingId ? 'Actualizar' : 'Crear'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default TaskList;
