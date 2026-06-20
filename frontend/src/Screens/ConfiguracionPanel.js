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
      setMessage({ type: 'danger', text: 'Você precisa entrar como admin_total.' });
      return;
    }

    if (!isAdminTotal) {
      setLoading(false);
      setMessage({ type: 'danger', text: 'Acesso negado' });
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
      setMessage({ type: 'danger', text: 'Erro ao carregar usuários' });
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
    setMessage({ type: 'danger', text: 'Papel inválido selecionado' });
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

    setMessage({ type: 'success', text: 'Papel atualizado com sucesso' });

    if (
      refreshRes.data.user?.rol_global !== 'admin_total' &&
      refreshRes.data.user?.rol !== 'admin_total'
    ) {
      alert('Papel atualizado. Você precisa entrar novamente.');
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
      text: 'Erro ao atualizar papel: ' + (err.response?.data?.message || 'Erro inesperado')
    });
  } finally {
    setUpdatingRol(false);
  }
};



  const handleDelete = async (id) => {
    if (!window.confirm('Excluir este usuário?')) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      setMessage({ type: 'success', text: 'Usuário excluído com sucesso' });
      fetchUsuarios();
    } catch {
      setMessage({ type: 'danger', text: 'Erro ao excluir usuário' });
    }
  };

  return (
    <Container className="mt-4">
      <h2 className="mb-1">Painel global de usuários</h2>
      <p className="text-muted">
        Gestão global/legacy. Os papéis locais da comunidade são administrados em Membros da comunidade.
      </p>

      {message.text && <Alert variant={message.type}>{message.text}</Alert>}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <div>Carregando usuários...</div>
        </div>
      ) : (
        <Table responsive bordered hover>
          <thead className="table-light">
            <tr>
              <th>ID</th>
              <th>Usuário</th>
              <th>Email</th>
              <th>Papel global</th>
              <th>Ações</th>
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
                    Alterar papel
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(user.id)}
                  >
                    Excluir
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
          <Modal.Title>Editar papel</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <p>
              Editando usuário: <strong>{selectedUser.email}</strong>
            </p>
          )}
          <Form.Group>
            <Form.Label>Papel global</Form.Label>
            <Form.Select
              value={newRol}
              onChange={(e) => setNewRol(e.target.value)}
            >
              <option value="miembro">Membro</option>
              <option value="admin_basic">Líder comunitário</option>
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
            {updatingRol ? 'Atualizando...' : 'Atualizar papel'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ConfiguracionPanel;
