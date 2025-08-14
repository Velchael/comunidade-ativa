// src/Screens/GruposActivos.js
import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { Button, Container, Table, Modal, Alert } from 'react-bootstrap';
import GrupoFormModal from '../components/GrupoFormModal';
import { UserContext } from '../UserContext';

const GruposActivos = () => {
  const [grupos, setGrupos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedGrupo, setSelectedGrupo] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const { user } = useContext(UserContext);

  const esAdmin = user?.rol === 'admin_basic' || user?.rol === 'admin_total';

  // 🔹 Cargar grupos según rol
  const fetchGrupos = async () => {
    try {
      let res;
      if (esAdmin) {
        res = await axios.get(`/api/grupos`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      } else {
        res = await axios.get(`/api/grupos/mios`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      }
      setGrupos(res.data);
      setMessage({ type: '', text: '' });
    } catch (err) {
      console.error('❌ Error al cargar grupos:', err);
      setMessage({ type: 'danger', text: 'Error al cargar grupos' });
    }
  };

  useEffect(() => {
    if (user) fetchGrupos();
  }, [user]);

  // 🔹 Eliminar grupo (solo admins)
  const handleDelete = async (id) => {
    if (!esAdmin) return;
    if (!window.confirm('¿Seguro que quieres eliminar este grupo?')) return;

    try {
      await axios.delete(`/api/grupos/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setMessage({ type: 'success', text: 'Grupo eliminado correctamente' });
      fetchGrupos();
    } catch (err) {
      console.error('❌ Error al eliminar grupo:', err);
      setMessage({ type: 'danger', text: 'Error al eliminar grupo' });
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedGrupo(null);
  };

  return (
    <Container className="mt-4">
      <h2>📘 Grupos Activos</h2>

      {message.text && (
        <Alert variant={message.type}>{message.text}</Alert>
      )}

      {/* ➕ Crear grupo → permitido a todos los logados */}
      {user && (
        <Button
          variant="primary"
          onClick={() => { 
            setSelectedGrupo(null); 
            setShowModal(true); 
          }}
          className="mb-3"
        >
          ➕ Nuevo Grupo
        </Button>
      )}

      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Líder</th>
            <th>Co-Líder</th>
            <th>Anfitrión</th>
            <th>Dirección</th>
            {esAdmin && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {grupos.length > 0 ? (
            grupos.map(grupo => (
              <tr key={grupo.id}>
                <td>{grupo.lider?.username || 'Sin nombre'}</td>
                <td>{grupo.colider_nombre || '-'}</td>
                <td>{grupo.anfitrion_nombre || '-'}</td>
                <td>{grupo.direccion_grupo || '-'}</td>
                {esAdmin && (
                  <td>
                    <Button
                      variant="warning"
                      size="sm"
                      onClick={() => { setSelectedGrupo(grupo); setShowModal(true); }}
                    >
                      ✏️ Editar
                    </Button>{' '}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(grupo.id)}
                    >
                      🗑 Eliminar
                    </Button>
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={esAdmin ? 5 : 4} className="text-center">
                No hay grupos disponibles
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {/* Modal de creación/edición */}
      <GrupoFormModal
        show={showModal}
        handleClose={handleCloseModal}
        onSave={() => {
          fetchGrupos();
          setMessage({ type: 'success', text: selectedGrupo ? 'Grupo actualizado' : 'Grupo creado correctamente' });
        }}
        grupo={selectedGrupo}
      />
    </Container>
  );
};

export default GruposActivos;

