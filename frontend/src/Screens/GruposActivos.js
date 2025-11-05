// src/Screens/GruposActivos.js
import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { Button, Container, Table, Alert, Form, Row, Col } from 'react-bootstrap';
import GrupoFormModal from '../components/GrupoFormModal';
import ReportesModal from '../components/ReportesModal';
import { UserContext } from '../UserContext';

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3000";

const GruposActivos = () => {
  const [grupos, setGrupos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedGrupo, setSelectedGrupo] = useState(null);
  const [showReportesModal, setShowReportesModal] = useState(false);
  const [selectedGrupoReportes, setSelectedGrupoReportes] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const { user } = useContext(UserContext);
  const [nuevoLiderId, setNuevoLiderId] = useState('')
  // Roles
  const esAdminBasic = user?.rol === 'admin_basic';
  const esAdminTotal = user?.rol === 'admin_total';
  const esAdmin = esAdminBasic || esAdminTotal;

  // filtros para admin_total
  const [filterComunidad, setFilterComunidad] = useState('');
  const [filterLider, setFilterLider] = useState('');

  // función que decide si el usuario puede modificar/eliminar cada grupo
  const puedeModificar = (grupo) => {
    if (!user) return false;
    if (user.rol === 'admin_total') return true;
    if (user.rol === 'admin_basic') return grupo.comunidad_id === user.comunidad_id;
    // Si quieres permitir que el líder pueda editar su propio grupo:
    // if (grupo.lider_id === user.id) return true;
    return false;
  };

  // Cargar grupos (con filtros si admin_total)
  const fetchGrupos = async () => {
    try {
      let res;
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

      if (esAdmin) {
        // admin_total puede pasar filtros por query params
        const params = {};
        if (esAdminTotal) {
          if (filterComunidad) params.comunidad_id = filterComunidad;
          if (filterLider) params.lider_id = filterLider;
        }
        res = await axios.get(`${API_BASE}/api/grupos`, { headers, params });
      } else {
        res = await axios.get(`${API_BASE}/api/grupos/mios`, { headers });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Si admin_total cambia filtros, recargar
  useEffect(() => {
    if (user && esAdminTotal) {
      fetchGrupos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterComunidad, filterLider]);

  const handleDelete = async (id) => {
    if (!user) return;
    if (!window.confirm('¿Seguro que quieres eliminar este grupo?')) return;

    try {
      await axios.delete(`${API_BASE}/api/grupos/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setMessage({ type: 'success', text: 'Grupo eliminado correctamente' });
      fetchGrupos();
    } catch (err) {
      console.error('❌ Error al eliminar grupo:', err);
      setMessage({ type: 'danger', text: 'Error al eliminar grupo' });
    }
  };

  return (
    <Container className="mt-4">
      <h2>📘 Grupos Activos</h2>

      {message.text && <Alert variant={message.type}>{message.text}</Alert>}

      {/* Mostrar filtros SOLO a admin_total */}
      {esAdminTotal && (
        <Form className="mb-3">
          <Row>
            <Col md={3}>
              <Form.Control
                placeholder="Filtrar por comunidad_id"
                value={filterComunidad}
                onChange={(e) => setFilterComunidad(e.target.value)}
              />
            </Col>
            <Col md={3}>
              <Form.Control
                placeholder="Filtrar por lider_id"
                value={filterLider}
                onChange={(e) => setFilterLider(e.target.value)}
              />
            </Col>
            <Col md={2}>
              <Button onClick={() => fetchGrupos()}>Buscar</Button>
            </Col>
          </Row>
        </Form>
      )}

      {/* Nuevo grupo -> permitido a todos logados (como pides) */}

      {user && (
      <Button
        variant="primary"
        onClick={() => {
        setSelectedGrupo(null);
        // si admin_total y hay filtro, usarlo; si no, usar user.id
        setNuevoLiderId(esAdminTotal ? (filterLider || user?.id) : (user?.id || ''));
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
            <th>📄 Reportes</th>
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
                <td>
                  <Button variant="info" size="sm" onClick={() => { setSelectedGrupoReportes(grupo); setShowReportesModal(true); }}>
                    📄 Ver Reportes
                  </Button>
                </td>
                {esAdmin && (
                  <td>
                    {/* Mostrar botones SOLO si puedeModificar para ese grupo */}
                    {puedeModificar(grupo) ? (
                      <>
                        <Button variant="warning" size="sm" onClick={() => { setSelectedGrupo(grupo); setShowModal(true); }}>
                          ✏️ Editar
                        </Button>{' '}
                        <Button variant="danger" size="sm" onClick={() => handleDelete(grupo.id)}>
                          🗑 Eliminar
                        </Button>
                      </>
                    ) : (
                      <small>Sin permisos</small>
                    )}
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={esAdmin ? 6 : 5} className="text-center">No hay grupos disponibles</td>
            </tr>
          )}
        </tbody>
      </Table>

      <GrupoFormModal
        show={showModal}
        handleClose={() => { setShowModal(false); setSelectedGrupo(null); }}
        onSave={() => { fetchGrupos(); setMessage({ type: 'success', text: selectedGrupo ? 'Grupo actualizado' : 'Grupo creado correctamente' }); }}
        grupo={selectedGrupo}
      />

      <ReportesModal show={showReportesModal} handleClose={() => setShowReportesModal(false)} grupo={selectedGrupoReportes} user={user} />
    </Container>
  );
};

export default GruposActivos;

