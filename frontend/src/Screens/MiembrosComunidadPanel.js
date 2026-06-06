import React, { useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Alert, Badge, Button, Container, Spinner, Table } from 'react-bootstrap';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { UserContext } from '../UserContext';

const API_URL = `${process.env.REACT_APP_API_URL}/api/comunidades`;

const MiembrosComunidadPanel = ({ comunidadId: comunidadIdProp, comunidadNombre: comunidadNombreProp }) => {
  const { user, logout } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const comunidadId = Number(comunidadIdProp || params.id);
  const comunidadNombre =
    comunidadNombreProp ||
    location.state?.comunidadNombre ||
    `Comunidad #${comunidadId}`;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [miembros, setMiembros] = useState([]);
  const [total, setTotal] = useState(0);

  const isAdminTotal =
    user?.rol_global === 'admin_total' ||
    user?.rol === 'admin_total';
  const canManageCommunity = user?.can_manage_comunidad === true;
  const userComunidadId = Number(user?.comunidadId || user?.comunidad_id);
  const currentUserId = Number(user?.id);

  const canRequest = useMemo(() => {
    if (!user) return false;
    if (isAdminTotal) return true;
    if (!canManageCommunity) return false;
    return userComunidadId === comunidadId;
  }, [user, isAdminTotal, canManageCommunity, userComunidadId, comunidadId]);

  useEffect(() => {
    const fetchMiembros = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        setError('Tu sesión expiró. Inicia sesión nuevamente.');
        setLoading(false);
        return;
      }

      if (!Number.isInteger(comunidadId) || comunidadId <= 0) {
        setError('Comunidad inválida');
        setLoading(false);
        return;
      }

      if (!canRequest) {
        setError('No tienes permisos para ver los miembros de esta comunidad');
        setLoading(false);
        return;
      }

      axios.defaults.headers.common.Authorization = `Bearer ${token}`;

      try {
        const res = await axios.get(`${API_URL}/${comunidadId}/miembros`);
        setMiembros(res.data?.miembros || []);
        setTotal(res.data?.total || 0);
        setActionError('');
      } catch (err) {
        const status = err.response?.status;

        if (status === 401) {
          setError('Tu sesión expiró. Inicia sesión nuevamente.');
          logout?.();
          navigate('/Seinscrever');
          return;
        }

        if (status === 403) {
          setError('No tienes permisos para ver los miembros de esta comunidad');
        } else if (status === 404) {
          setError('Comunidad no encontrada');
        } else {
          setError(err.response?.data?.message || 'Error al cargar miembros');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMiembros();
  }, [comunidadId, canRequest, logout, navigate]);

  const renderRol = (miembro) => {
    if (miembro?.is_admin_total_global === true) {
      const localLabel =
        miembro.rol_comunidad === 'admin_total'
          ? 'Admin total'
          : miembro.rol_comunidad === 'admin_basic'
            ? 'Admin local'
            : 'Miembro';

      return (
        <>
          <Badge bg="danger">Admin total global</Badge>
          <div className="text-muted small mt-1">
            Local: {localLabel}
          </div>
        </>
      );
    }

    if (miembro?.rol_comunidad === 'admin_total') {
      return <Badge bg="danger">Admin total</Badge>;
    }

    if (miembro?.rol_comunidad === 'admin_basic') {
      return (
        <Badge bg="warning" text="dark">
          Admin local
        </Badge>
      );
    }

    return <Badge bg="secondary">Miembro</Badge>;
  };

  const renderEstado = (estado) => {
    if (estado === 'activo') {
      return <Badge bg="success">Activo</Badge>;
    }

    return <Badge bg="secondary">{estado || 'Sin estado'}</Badge>;
  };

  const canManageRoles = canRequest;

  const canEditMember = (miembro) => {
    if (!canManageRoles) return false;
    if (!miembro) return false;
    if (Number(miembro.user_id) === currentUserId) return false;
    if (miembro.is_owner === true) return false;
    if (miembro.can_edit_local_role === false) return false;
    if (miembro.is_admin_total_global === true) return false;
    return miembro.rol_comunidad === 'miembro' || miembro.rol_comunidad === 'admin_basic';
  };

  const handleChangeRole = async (miembro, nextRole) => {
    setActionError('');
    setUpdatingUserId(miembro.user_id);

    try {
      const res = await axios.patch(
        `${API_URL}/${comunidadId}/miembros/${miembro.user_id}/rol`,
        { rol_comunidad: nextRole }
      );

      const miembroActualizado = res.data?.miembro;

      if (miembroActualizado) {
        setMiembros((prev) =>
          prev.map((item) =>
            item.user_id === miembro.user_id
              ? { ...item, ...miembroActualizado }
              : item
          )
        );
      } else {
        const refreshed = await axios.get(`${API_URL}/${comunidadId}/miembros`);
        setMiembros(refreshed.data?.miembros || []);
        setTotal(refreshed.data?.total || 0);
      }
    } catch (err) {
      const status = err.response?.status;

      if (status === 401) {
        setActionError('Tu sesión expiró. Inicia sesión nuevamente.');
        logout?.();
        navigate('/Seinscrever');
        return;
      }

      if (status === 403) {
        setActionError(
          err.response?.data?.message || 'No tienes permisos para cambiar este rol'
        );
      } else if (status === 404) {
        setActionError(
          err.response?.data?.message || 'Miembro o comunidad no encontrada'
        );
      } else if (status === 400) {
        setActionError(
          err.response?.data?.message || 'Solicitud inválida para actualizar rol'
        );
      } else {
        setActionError(
          err.response?.data?.message || 'Error al actualizar rol comunitario'
        );
      }
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="mb-1">Miembros de la comunidad</h2>
          <div className="text-muted">{comunidadNombre}</div>
        </div>
        <Button
          variant="outline-secondary"
          onClick={() => navigate('/configuracion/comunidades')}
        >
          Volver
        </Button>
      </div>

      {actionError && <Alert variant="danger">{actionError}</Alert>}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <div>Cargando miembros...</div>
        </div>
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
      ) : miembros.length === 0 ? (
        <Alert variant="info">No hay miembros registrados en esta comunidad.</Alert>
      ) : (
        <>
          <div className="mb-3 text-muted">Total: {total}</div>
          <Table responsive bordered hover>
            <thead className="table-light">
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Rol comunidad</th>
                <th>Estado</th>
                <th>Principal</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {miembros.map((miembro) => (
                <tr key={miembro.user_id}>
                  <td>{miembro.username || '-'}</td>
                  <td>{miembro.email || '-'}</td>
                  <td>{renderRol(miembro)}</td>
                  <td>{renderEstado(miembro.estado)}</td>
                  <td>
                    {miembro.es_principal ? (
                      <Badge bg="primary">Principal</Badge>
                    ) : (
                      <span className="text-muted">No</span>
                    )}
                  </td>
                  <td>
                    {canEditMember(miembro) ? (
                      miembro.rol_comunidad === 'miembro' ? (
                        <Button
                          size="sm"
                          variant="success"
                          disabled={updatingUserId === miembro.user_id}
                          onClick={() => handleChangeRole(miembro, 'admin_basic')}
                        >
                          {updatingUserId === miembro.user_id ? 'Actualizando...' : 'Promover'}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline-warning"
                          disabled={updatingUserId === miembro.user_id}
                          onClick={() => handleChangeRole(miembro, 'miembro')}
                        >
                          {updatingUserId === miembro.user_id ? 'Actualizando...' : 'Quitar admin'}
                        </Button>
                      )
                    ) : (
                      <span className="text-muted">Sin acciones</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </Container>
  );
};

export default MiembrosComunidadPanel;
