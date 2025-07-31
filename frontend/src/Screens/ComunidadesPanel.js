import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import {
  Container,
  Table,
  Button,
  Alert,
  Spinner,
  Form,
  Modal
} from 'react-bootstrap';

const API_URL = `${process.env.REACT_APP_API_URL}/api/comunidades`;

const ComunidadesPanel = () => {
  const [userRole, setUserRole] = useState(null);
  const [comunidades, setComunidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [modalShow, setModalShow] = useState(false);
  const [editingComunidad, setEditingComunidad] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    direccion: '',
    telefono: '',
    administrador: '',
  });

  useEffect(() => {
  const token = localStorage.getItem('token'); // ✅

  if (!token) return;

  const decoded = jwtDecode(token);
  setUserRole(decoded.rol);

  if (decoded.rol !== 'admin_total') {
    setMessage({ type: 'danger', text: 'Acceso denegado' });
    return;
  }

  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  fetchComunidades();
  }, []);

  const fetchComunidades = async () => {
    try {
      const res = await axios.get(API_URL);
      setComunidades(res.data);
    } catch (err) {
      setMessage({ type: 'danger', text: 'Error al cargar comunidades' });
    } finally {
      setLoading(false);
    }
  };

  const openModal = (comunidad = null) => {
    setEditingComunidad(comunidad);
    setFormData(
      comunidad || {
        nombre: '',
        descripcion: '',
        direccion: '',
        telefono: '',
        administrador: '',
      }
    );
    setModalShow(true);
  };

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    try {
      if (editingComunidad) {
        await axios.put(`${API_URL}/${editingComunidad.id}`, formData);
        setMessage({ type: 'success', text: 'Comunidad actualizada' });
      } else {
        console.log('📤 Enviando datos comunidad:', formData);
        if (!formData.nombre.trim()) {
        return setMessage({ type: 'danger', text: 'El nombre de la comunidad es obligatorio.' });
        }
        await axios.post(API_URL, formData);
        setMessage({ type: 'success', text: 'Comunidad creada' });
      }
      fetchComunidades();
      setModalShow(false);
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err.response?.data?.message || 'Error al guardar comunidad',
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta comunidad?')) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      setMessage({ type: 'success', text: 'Comunidad eliminada' });
      fetchComunidades();
    } catch {
      setMessage({ type: 'danger', text: 'Error al eliminar comunidad' });
    }
  };

  return (
    <Container className="mt-4">
      <h2 className="mb-3">🏘️ Panel de Gestión de Comunidades</h2>

      {message.text && <Alert variant={message.type}>{message.text}</Alert>}

     {userRole === 'admin_total' && (
       <Button variant="primary" className="mb-3" onClick={() => openModal()}>
        ➕ Crear nueva comunidad
       </Button>
     )}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <div>Cargando comunidades...</div>
        </div>
      ) : (
        <Table responsive bordered hover>
          <thead className="table-light">
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Administrador</th>
              <th>Teléfono</th>
              <th>Dirección</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {comunidades.map((com) => (
              <tr key={com.id}>
                <td>{com.id}</td>
                <td>{com.nombre}</td>
                <td>{com.administrador}</td>
                <td>{com.telefono}</td>
                <td>{com.direccion}</td>
                <td>
                  <Button
                    size="sm"
                    variant="warning"
                    className="me-2"
                    onClick={() => openModal(com)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(com.id)}
                  >
                    Eliminar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Modal de Crear/Editar */}
      <Modal show={modalShow} onHide={() => setModalShow(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingComunidad ? 'Editar Comunidad' : 'Nueva Comunidad'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-2">
            <Form.Label>Nombre</Form.Label>
            <Form.Control
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Descripción</Form.Label>
            <Form.Control
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              as="textarea"
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Dirección</Form.Label>
            <Form.Control
              name="direccion"
              value={formData.direccion}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Teléfono</Form.Label>
            <Form.Control
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Administrador</Form.Label>
            <Form.Control
              name="administrador"
              value={formData.administrador}
              onChange={handleChange}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModalShow(false)}>
            Cancelar
          </Button>

         <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={userRole !== 'admin_total'}
         >
          {editingComunidad ? 'Guardar Cambios' : 'Crear Comunidad'}
         </Button>

        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ComunidadesPanel;

