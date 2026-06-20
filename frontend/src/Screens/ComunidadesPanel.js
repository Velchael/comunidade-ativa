import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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
import {
  canManageCommunity,
  canViewCommunityMembers,
  isAdminTotalGlobal
} from '../utils/permissions';

const API_URL = `${process.env.REACT_APP_API_URL}/api/comunidades`;

const normalizeComunidad = (comunidad = {}) => ({
  ...comunidad,
  nombre: comunidad.nombre || comunidad.nombre_comunidad || '',
  administrador: comunidad.administrador || comunidad.nombre_administrador || '',
  descripcion: comunidad.descripcion || '',
  direccion: comunidad.direccion || '',
  telefono: comunidad.telefono || '',
});

const ComunidadesPanel = () => {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
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
  const sessionUser = user;
  const isAdminTotal = isAdminTotalGlobal(sessionUser);
  const canManageLocalCommunity = canManageCommunity(sessionUser);
  const canAccessMembersPanel = canViewCommunityMembers(sessionUser);
  const comunidadId = sessionUser?.comunidadId || sessionUser?.comunidad_id;

  const canViewMembers = (comunidad) => {
    if (isAdminTotal) return true;
    if (!canAccessMembersPanel) return false;
    return Number(comunidad?.id) === Number(comunidadId);
  };

  const handleViewMembers = (comunidad) => {
    navigate(`/configuracion/comunidades/${comunidad.id}/miembros`, {
      state: {
        comunidadNombre: comunidad.nombre || `Comunidad #${comunidad.id}`
      }
    });
  };

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      setLoading(false);
      return;
    }

    if (!sessionUser) {
      return;
    }

    if (!isAdminTotal && !canManageLocalCommunity && !canAccessMembersPanel) {
      setMessage({ type: 'danger', text: 'Acesso negado' });
      setLoading(false);
      return;
    }

    if (!isAdminTotal && !comunidadId) {
      setMessage({ type: 'danger', text: 'Você não tem comunidade atribuída' });
      setLoading(false);
      return;
    }

    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    if (isAdminTotal) {
      fetchComunidades();
      return;
    }

    fetchComunidadLocal(comunidadId);
  }, [sessionUser, isAdminTotal, canAccessMembersPanel, canManageLocalCommunity, comunidadId]);

  const fetchComunidades = async () => {
    try {
      const res = await axios.get(API_URL);
      setComunidades(res.data.map(normalizeComunidad));
    } catch (err) {
      setMessage({ type: 'danger', text: 'Erro ao carregar comunidades' });
    } finally {
      setLoading(false);
    }
  };

  const fetchComunidadLocal = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/${id}`);
      setComunidades([normalizeComunidad(res.data)]);
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err.response?.data?.message || 'Erro ao carregar sua comunidade'
      });
    } finally {
      setLoading(false);
    }
  };

  const openModal = (comunidad = null) => {
    const normalizedComunidad = normalizeComunidad(comunidad || {});
    setEditingComunidad(comunidad);
    setFormData(
      comunidad
        ? {
            nombre: normalizedComunidad.nombre,
            descripcion: normalizedComunidad.descripcion,
            direccion: normalizedComunidad.direccion,
            telefono: normalizedComunidad.telefono,
            administrador: normalizedComunidad.administrador,
          }
        : {
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
        setMessage({ type: 'success', text: 'Comunidade atualizada' });
      } else {
        console.log('📤 Enviando datos comunidad:', formData);
        if (!formData.nombre.trim()) {
        return setMessage({ type: 'danger', text: 'O nome da comunidade é obrigatório.' });
        }
        await axios.post(API_URL, formData);
        setMessage({ type: 'success', text: 'Comunidade criada' });
      }

      if (isAdminTotal) {
        await fetchComunidades();
      } else {
        await fetchComunidadLocal(comunidadId);
      }

      setModalShow(false);
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err.response?.data?.message || 'Erro ao salvar comunidade',
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir esta comunidade?')) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      setMessage({ type: 'success', text: 'Comunidade excluída' });

      if (isAdminTotal) {
        await fetchComunidades();
      } else {
        await fetchComunidadLocal(comunidadId);
      }
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err.response?.data?.message || 'Erro ao excluir comunidade'
      });
    }
  };

  return (
    <Container className="mt-4">
      <h2 className="mb-3">🏘️ Painel de Gestão de Comunidades</h2>

      {message.text && <Alert variant={message.type}>{message.text}</Alert>}

     {isAdminTotal && (
       <Button variant="primary" className="mb-3" onClick={() => openModal()}>
        ➕ Criar nova comunidade
       </Button>
     )}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <div>Carregando comunidades...</div>
        </div>
      ) : (
        <Table responsive bordered hover>
          <thead className="table-light">
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>Administrador</th>
              <th>Telefone</th>
              <th>Endereço</th>
              <th>Ações</th>
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
                  {canViewMembers(com) && (
                    <Button
                      size="sm"
                      variant="info"
                      className="me-2"
                      onClick={() => handleViewMembers(com)}
                    >
                      Ver membros
                    </Button>
                  )}
                  {((isAdminTotal || canManageLocalCommunity) &&
                    (isAdminTotal || Number(com.id) === Number(comunidadId))) && (
                    <>
                      <Button
                        size="sm"
                        variant="warning"
                        className="me-2"
                        onClick={() => openModal(com)}
                      >
                        Editar
                      </Button>
                      {isAdminTotal && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(com.id)}
                        >
                          Excluir
                        </Button>
                      )}
                    </>
                  )}
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
            {editingComunidad ? 'Editar comunidade' : 'Nova comunidade'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-2">
            <Form.Label>Nome</Form.Label>
            <Form.Control
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Descrição</Form.Label>
            <Form.Control
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              as="textarea"
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Endereço</Form.Label>
            <Form.Control
              name="direccion"
              value={formData.direccion}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Telefone</Form.Label>
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
          disabled={!isAdminTotal && !canManageCommunity}
         >
          {editingComunidad ? 'Salvar alterações' : 'Criar comunidade'}
         </Button>

        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ComunidadesPanel;
