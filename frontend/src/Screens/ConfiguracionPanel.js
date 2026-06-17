import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import {
  Container,
  Table,
  Button,
  Alert,
  Spinner,
  Form,
  Modal
} from 'react-bootstrap';
import { UserContext } from '../UserContext';
import { isAdminTotalGlobal } from '../utils/permissions';

const API_URL = `${process.env.REACT_APP_API_URL}/api/users`;

const ConfiguracionPanel = () => {
  const { user, isHydrating, logout } = useContext(UserContext);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [modalShow, setModalShow] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRol, setNewRol] = useState('');
  const [updatingRol, setUpdatingRol] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const isAdminTotal = isAdminTotalGlobal(user);

    if (isHydrating) {
      return;
    }

    if (!token || !user) {
      setLoading(false);
      setMessage({ type: 'danger', text: 'Debes iniciar sesión como admin_total.' });
      return;
    }

    if (!isAdminTotal) {
      setLoading(false);
      setMessage({ type: 'danger', text: 'Acceso denegado' });
      return;
    }

    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    fetchUsuarios();
  }, [user, isHydrating]);

  const fetchUsuarios = async () => {
    try {
      const res = await axios.get(API_URL);
      setUsuarios(res.data);
    } catch (err) {
      setMessage({ type: 'danger', text: 'Error al cargar usuarios' });
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setNewRol(user.rol_global || user.rol);
    setModalShow(true);
  };

 const handleRolUpdate = async () => {
  const validRoles = ['miembro', 'admin_basic', 'admin_total'];
  if (!validRoles.includes(newRol)) {
    setMessage({ type: 'danger', text: 'Rol inválido seleccionado' });
    return;
  }

  setUpdatingRol(true);
  try {
    const token = localStorage.getItem('token');

    await axios.put(
      `${API_URL}/${selectedUser.id}/rol`,
      { rol: newRol },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const refreshRes = await axios.get(`${process.env.REACT_APP_API_URL}/api/auth/refresh`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    localStorage.setItem('token', refreshRes.data.token);
    if (refreshRes.data.user) {
      localStorage.setItem('user', JSON.stringify(refreshRes.data.user));
    }

    setMessage({ type: 'success', text: 'Rol actualizado correctamente' });

    if (
      refreshRes.data.user?.rol_global !== 'admin_total' &&
      refreshRes.data.user?.rol !== 'admin_total'
    ) {
      alert('Rol actualizado. Debes iniciar sesión nuevamente.');
      logout?.();
      window.location.href = '/Seinscrever';
    } else {
      fetchUsuarios();
      setModalShow(false);
    }
  } catch (err) {
    console.error('❌ Error al actualizar rol:', err.response?.data || err.message);
    setMessage({
      type: 'danger',
      text: 'Error al actualizar rol: ' + (err.response?.data?.message || 'Error inesperado')
    });
  } finally {
    setUpdatingRol(false);
  }
};



  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este usuario?')) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      setMessage({ type: 'success', text: 'Usuario eliminado correctamente' });
      fetchUsuarios();
    } catch {
      setMessage({ type: 'danger', text: 'Error al eliminar usuario' });
    }
  };

  return (
    <Container className="mt-4">
      <h2 className="mb-1">Panel Global de Usuarios</h2>
      <p className="text-muted">
        Gestión global/legacy. Los roles locales de comunidad se administran desde Miembros de la comunidad.
      </p>

      {message.text && <Alert variant={message.type}>{message.text}</Alert>}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <div>Cargando usuarios...</div>
        </div>
      ) : (
        <Table responsive bordered hover>
          <thead className="table-light">
            <tr>
              <th>ID</th>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol global</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>{user.rol_global || user.rol}</td>
                <td>
                  <Button
                    size="sm"
                    variant="warning"
                    onClick={() => openEditModal(user)}
                    className="me-2"
                  >
                    Cambiar rol
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(user.id)}
                  >
                    Eliminar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Modal para editar rol */}
      <Modal show={modalShow} onHide={() => setModalShow(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Editar Rol</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <p>
              Editando usuario: <strong>{selectedUser.email}</strong>
            </p>
          )}
          <Form.Group>
            <Form.Label>Rol global</Form.Label>
            <Form.Select
              value={newRol}
              onChange={(e) => setNewRol(e.target.value)}
            >
              <option value="miembro">Miembro</option>
              <option value="admin_basic">Líder Comunitario</option>
              <option value="admin_total">Admin Total</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setModalShow(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleRolUpdate}
            disabled={updatingRol}
          >
            {updatingRol ? 'Actualizando...' : 'Actualizar Rol'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ConfiguracionPanel;
