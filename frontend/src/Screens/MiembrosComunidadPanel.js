import React, { useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Form,
  InputGroup,
  Spinner,
  Table
} from 'react-bootstrap';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { UserContext } from '../UserContext';
import {
  canManageCommunity,
  canViewCommunityMembers,
  isAdminTotalGlobal
} from '../utils/permissions';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const API_URL = `${API_BASE}/api/comunidades`;

const fetchMiembrosComunidad = async (comunidadId, token) => {
  axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  const res = await axios.get(`${API_URL}/${comunidadId}/miembros`);

  return {
    miembros: res.data?.miembros || [],
    total: res.data?.total || 0
  };
};

const getLocalRoleLabel = (rolComunidad) => {
  if (rolComunidad === 'admin_total') return 'Admin total';
  if (rolComunidad === 'admin_basic') return 'Admin local';
  if (rolComunidad === 'moderador') return 'Moderador';
  return 'Membro';
};

const MiembrosComunidadPanel = ({ comunidadId: comunidadIdProp, comunidadNombre: comunidadNombreProp }) => {
  const { user, token: authToken, logout } = useContext(UserContext);
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
  const [creatingInvitation, setCreatingInvitation] = useState(false);
  const [invitationUrl, setInvitationUrl] = useState('');
  const [invitationError, setInvitationError] = useState('');
  const [copyConfirmed, setCopyConfirmed] = useState(false);

  const isAdminTotal = isAdminTotalGlobal(user);
  const canManageLocalCommunity = canManageCommunity(user);
  const canAccessMembersPanel = canViewCommunityMembers(user);
  const userComunidadId = Number(user?.comunidadId || user?.comunidad_id);
  const currentUserId = Number(user?.id);

  const canRequest = useMemo(() => {
    if (!user) return false;
    if (isAdminTotal) return true;
    if (!canAccessMembersPanel) return false;
    return userComunidadId === comunidadId;
  }, [user, isAdminTotal, canAccessMembersPanel, userComunidadId, comunidadId]);

  useEffect(() => {
    const fetchMiembros = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        setError('Sua sessão expirou. Entre novamente.');
        setLoading(false);
        return;
      }

      if (!Number.isInteger(comunidadId) || comunidadId <= 0) {
        setError('Comunidade inválida');
        setLoading(false);
        return;
      }

      if (!canRequest) {
        setError('Você não tem permissão para ver os membros desta comunidade');
        setLoading(false);
        return;
      }

      try {
        const data = await fetchMiembrosComunidad(comunidadId, token);
        setMiembros(data.miembros);
        setTotal(data.total);
        setActionError('');
      } catch (err) {
        const status = err.response?.status;

        if (status === 401) {
          setError('Sua sessão expirou. Entre novamente.');
          logout?.();
          navigate('/Seinscrever');
          return;
        }

        if (status === 403) {
          setError('Você não tem permissão para ver os membros desta comunidade');
        } else if (status === 404) {
          setError('Comunidade não encontrada');
        } else {
          setError(err.response?.data?.message || 'Erro ao carregar membros');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMiembros();
  }, [comunidadId, canRequest, logout, navigate]);

  const renderRol = (miembro) => {
    if (miembro?.is_owner === true) {
      return (
        <>
          <Badge bg="primary">Owner</Badge>
          <div className="text-muted small mt-1">
            Admin local efetivo
          </div>
        </>
      );
    }

    if (miembro?.is_admin_total_global === true) {
      return (
        <>
          <Badge bg="danger">Admin total global</Badge>
          <div className="text-muted small mt-1">
            Local: {getLocalRoleLabel(miembro?.rol_comunidad)}
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

    if (miembro?.rol_comunidad === 'moderador') {
      return <Badge bg="info">Moderador</Badge>;
    }

      return <Badge bg="secondary">Membro</Badge>;
  };

  const renderEstado = (estado) => {
    if (estado === 'activo') {
      return <Badge bg="success">Ativo</Badge>;
    }

    return <Badge bg="secondary">{estado || 'Sem estado'}</Badge>;
  };

  const canManageRoles = useMemo(() => {
    if (!user) return false;
    if (isAdminTotal) return true;
    if (!canManageLocalCommunity) return false;
    return userComunidadId === comunidadId;
  }, [user, isAdminTotal, canManageLocalCommunity, userComunidadId, comunidadId]);

  const canManageInvitations = canManageRoles;

  const canEditMember = (miembro) => {
    if (!canManageRoles) return false;
    if (!miembro) return false;
    if (Number(miembro.user_id) === currentUserId) return false;
    if (miembro.is_owner === true) return false;
    if (miembro.can_edit_local_role === false) return false;
    if (miembro.is_admin_total_global === true) return false;
    return ['miembro', 'moderador', 'admin_basic'].includes(miembro.rol_comunidad);
  };

  const getRoleActions = (miembro) => {
    if (!canEditMember(miembro)) return [];

    if (miembro.rol_comunidad === 'miembro') {
      return [
        { label: 'Tornar moderador', nextRole: 'moderador', variant: 'info' },
        { label: 'Tornar admin local', nextRole: 'admin_basic', variant: 'success' }
      ];
    }

    if (miembro.rol_comunidad === 'moderador') {
      return [
        { label: 'Remover moderação', nextRole: 'miembro', variant: 'outline-secondary' },
        { label: 'Tornar admin local', nextRole: 'admin_basic', variant: 'success' }
      ];
    }

    if (miembro.rol_comunidad === 'admin_basic') {
      return [
        { label: 'Rebaixar para moderador', nextRole: 'moderador', variant: 'outline-warning' }
      ];
    }

    return [];
  };

  const handleChangeRole = async (miembro, nextRole) => {
    setActionError('');
    setUpdatingUserId(miembro.user_id);

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        setActionError('Sua sessão expirou. Entre novamente.');
        logout?.();
        navigate('/Seinscrever');
        return;
      }

      await axios.patch(
        `${API_URL}/${comunidadId}/miembros/${miembro.user_id}/rol`,
        { rol_comunidad: nextRole }
      );

      const data = await fetchMiembrosComunidad(comunidadId, token);
      setMiembros(data.miembros);
      setTotal(data.total);
    } catch (err) {
      const status = err.response?.status;

      if (status === 401) {
        setActionError('Sua sessão expirou. Entre novamente.');
        logout?.();
        navigate('/Seinscrever');
        return;
      }

      if (status === 403) {
        setActionError(
          err.response?.data?.message || 'Você não tem permissão para alterar este papel'
        );
      } else if (status === 404) {
        setActionError(
          err.response?.data?.message || 'Membro ou comunidade não encontrada'
        );
      } else if (status === 400) {
        setActionError(
          err.response?.data?.message || 'Solicitação inválida para atualizar papel'
        );
      } else {
        setActionError(
          err.response?.data?.message || 'Erro ao atualizar papel comunitário'
        );
      }
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleCreateInvitation = async () => {
    if (creatingInvitation || !authToken) return;

    setCreatingInvitation(true);
    setInvitationUrl('');
    setInvitationError('');
    setCopyConfirmed(false);

    try {
      const { data } = await axios.post(
        `${API_URL}/${comunidadId}/invitaciones`,
        { max_usos: 1 },
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      if (!data?.url) {
        throw new Error('missing_invitation_url');
      }

      setInvitationUrl(data.url);
    } catch (err) {
      const status = err.response?.status;

      if (status === 401) {
        setInvitationError('Sua sessão expirou. Entre novamente.');
        logout?.();
        navigate('/Seinscrever');
      } else if (status === 403) {
        setInvitationError('Você não tem permissão para criar convites.');
      } else if (status === 409) {
        setInvitationError(
          err.response?.data?.message || 'A comunidade não está disponível.'
        );
      } else {
        setInvitationError(
          err.response?.data?.message || 'Não foi possível criar o convite.'
        );
      }
    } finally {
      setCreatingInvitation(false);
    }
  };

  const handleCopyInvitation = async () => {
    if (!invitationUrl || creatingInvitation) return;

    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopyConfirmed(true);
    } catch {
      setInvitationError(
        'Não foi possível copiar automaticamente. Selecione o link e copie manualmente.'
      );
    }
  };

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="mb-1">Membros da comunidade</h2>
          <div className="text-muted">{comunidadNombre}</div>
        </div>
        <Button
          variant="outline-secondary"
          onClick={() => navigate('/configuracion/comunidades')}
        >
          Voltar
        </Button>
      </div>

      {actionError && <Alert variant="danger">{actionError}</Alert>}

      {canManageInvitations && (
        <Card className="community-invitation-manager mb-4">
          <Card.Body>
            <div className="community-invitation-manager__header">
              <div>
                <Card.Title>Convidar uma pessoa</Card.Title>
                <Card.Text>
                  Cada link pode ser utilizado uma única vez.
                </Card.Text>
              </div>

              <Button
                disabled={creatingInvitation || !authToken}
                onClick={handleCreateInvitation}
              >
                {creatingInvitation ? 'Gerando...' : 'Gerar convite'}
              </Button>
            </div>

            {invitationError && (
              <Alert variant="danger" aria-live="polite">
                {invitationError}
              </Alert>
            )}

            {invitationUrl && (
              <>
                <InputGroup>
                  <Form.Control
                    readOnly
                    aria-label="Link do convite"
                    value={invitationUrl}
                    onFocus={(event) => event.target.select()}
                  />
                  <Button
                    variant="outline-secondary"
                    disabled={creatingInvitation}
                    onClick={handleCopyInvitation}
                  >
                    {copyConfirmed ? 'Copiado' : 'Copiar'}
                  </Button>
                </InputGroup>

                <div className="small text-muted mt-2" aria-live="polite">
                  {copyConfirmed
                    ? 'Link copiado. Você pode gerar outro convite a qualquer momento.'
                    : 'Você pode gerar outro link individual a qualquer momento.'}
                </div>
              </>
            )}
          </Card.Body>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <div>Carregando membros...</div>
        </div>
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
      ) : miembros.length === 0 ? (
        <Alert variant="info">Não há membros registrados nesta comunidade.</Alert>
      ) : (
        <>
          <div className="mb-3 text-muted">Total: {total}</div>
          <Table responsive bordered hover>
            <thead className="table-light">
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Papel na comunidade</th>
                <th>Estado</th>
                <th>Principal</th>
                <th>Ações</th>
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
                      <span className="text-muted">Não</span>
                    )}
                  </td>
                  <td>
                    {getRoleActions(miembro).length > 0 ? (
                      <div className="d-flex flex-wrap gap-2">
                        {getRoleActions(miembro).map((action) => (
                          <Button
                            key={`${miembro.user_id}-${action.nextRole}`}
                            size="sm"
                            variant={action.variant}
                            disabled={updatingUserId === miembro.user_id}
                            onClick={() => handleChangeRole(miembro, action.nextRole)}
                          >
                            {updatingUserId === miembro.user_id ? 'Atualizando...' : action.label}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">Sem ações</span>
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
