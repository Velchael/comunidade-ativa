import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
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

const getShortCommunityName = (nome) => {
  const normalizedName = String(nome || '').trim().replace(/\s+/g, ' ');
  if (!normalizedName) return 'COMUVA';

  const selectedWords = normalizedName.split(' ').slice(0, 2);
  const shortName = selectedWords.join(' ');

  if (shortName.length <= 20) {
    return shortName;
  }

  if (selectedWords.length > 1 && selectedWords[0].length <= 20) {
    return selectedWords[0];
  }

  return shortName.slice(0, 20).trim();
};

const normalizeCommunityName = (nome) => String(nome || '').trim().replace(/\s+/g, ' ');

const getCommunityNameFromPayload = (payload = {}) => {
  const source = payload || {};

  return normalizeCommunityName(
    source.comunidadNombre ||
    source.nombreComunidad ||
    source.nomeComunidade ||
    source.communityName ||
    source.nombre ||
    source.nome ||
    source.nombre_comunidad ||
    source.comunidad?.nombre ||
    source.comunidad?.nome ||
    source.comunidad?.nombre_comunidad
  );
};

const getFallbackCommunityName = (comunidadId) => (
  Number.isInteger(comunidadId) && comunidadId > 0
    ? `Comunidade #${comunidadId}`
    : 'Comunidade'
);

const getCommunitySlug = (nome) => {
  const normalizedName = String(nome || 'comunidade')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalizedName || 'comunidade';
};

const getMostRecentActiveInvitation = (invitaciones = []) => (
  invitaciones.find((invitacion) => (
    invitacion?.estado === 'activa' && invitacion?.estado_efectivo === 'activa'
  )) || null
);

const MiembrosComunidadPanel = ({ comunidadId: comunidadIdProp, comunidadNombre: comunidadNombreProp }) => {
  const { user, token: authToken, logout } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const comunidadId = Number(comunidadIdProp || params.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [miembros, setMiembros] = useState([]);
  const [total, setTotal] = useState(0);
  const [creatingInvitation, setCreatingInvitation] = useState(false);
  const [loadingInvitation, setLoadingInvitation] = useState(false);
  const [revokingInvitation, setRevokingInvitation] = useState(false);
  const [activeInvitation, setActiveInvitation] = useState(null);
  const [invitationUrl, setInvitationUrl] = useState('');
  const [invitationToken, setInvitationToken] = useState('');
  const [invitationError, setInvitationError] = useState('');
  const [copyConfirmed, setCopyConfirmed] = useState(false);
  const [invitationNotice, setInvitationNotice] = useState('');
  const [fetchedCommunityName, setFetchedCommunityName] = useState('');
  const qrCanvasRef = useRef(null);

  const isAdminTotal = isAdminTotalGlobal(user);
  const canManageLocalCommunity = canManageCommunity(user);
  const canAccessMembersPanel = canViewCommunityMembers(user);
  const userComunidadId = Number(user?.comunidadId || user?.comunidad_id);
  const currentUserId = Number(user?.id);
  const communityNameCandidate = useMemo(() => {
    const sessionCommunityName = userComunidadId === comunidadId
      ? getCommunityNameFromPayload(user)
      : '';

    return [
      comunidadNombreProp,
      location.state?.comunidadNombre,
      location.state?.nombreComunidad,
      location.state?.nomeComunidade,
      location.state?.communityName,
      location.state?.comunidad,
      sessionCommunityName
    ].map((candidate) => (
      typeof candidate === 'object'
        ? getCommunityNameFromPayload(candidate)
        : normalizeCommunityName(candidate)
    )).find(Boolean) || '';
  }, [comunidadId, comunidadNombreProp, location.state, user, userComunidadId]);
  const comunidadNombre =
    communityNameCandidate ||
    fetchedCommunityName ||
    getFallbackCommunityName(comunidadId);

  const canRequest = useMemo(() => {
    if (!user) return false;
    if (isAdminTotal) return true;
    if (!canAccessMembersPanel) return false;
    return userComunidadId === comunidadId;
  }, [user, isAdminTotal, canAccessMembersPanel, userComunidadId, comunidadId]);

  useEffect(() => {
    if (
      communityNameCandidate ||
      !Number.isInteger(comunidadId) ||
      comunidadId <= 0
    ) {
      setFetchedCommunityName('');
      return;
    }

    let isCurrentRequest = true;

    axios.get(`${API_URL}/${comunidadId}`)
      .then(({ data }) => {
        if (!isCurrentRequest) return;
        setFetchedCommunityName(getCommunityNameFromPayload(data));
      })
      .catch(() => {
        if (!isCurrentRequest) return;
        setFetchedCommunityName('');
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [communityNameCandidate, comunidadId]);

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
  const shortCommunityName = useMemo(
    () => getShortCommunityName(comunidadNombre),
    [comunidadNombre]
  );
  const communitySlug = useMemo(
    () => getCommunitySlug(comunidadNombre),
    [comunidadNombre]
  );

  useEffect(() => {
    const fetchActiveInvitation = async () => {
      if (!authToken || !Number.isInteger(comunidadId) || comunidadId <= 0 || !canManageInvitations) {
        setActiveInvitation(null);
        return;
      }

      setLoadingInvitation(true);
      setInvitationError('');

      try {
        const { data } = await axios.get(
          `${API_URL}/${comunidadId}/invitaciones`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`
            }
          }
        );

        setActiveInvitation(getMostRecentActiveInvitation(data?.invitaciones));
      } catch (err) {
        const status = err.response?.status;

        if (status === 401) {
          setInvitationError('Sua sessão expirou. Entre novamente.');
          logout?.();
          navigate('/Seinscrever');
        } else if (status === 403) {
          setInvitationError('Você não tem permissão para ver convites.');
        } else {
          setInvitationError(
            err.response?.data?.message || 'Não foi possível carregar o convite ativo.'
          );
        }
      } finally {
        setLoadingInvitation(false);
      }
    };

    fetchActiveInvitation();
  }, [authToken, comunidadId, canManageInvitations, logout, navigate]);

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
    setInvitationToken('');
    setInvitationError('');
    setCopyConfirmed(false);
    setInvitationNotice('');

    try {
      const { data } = await axios.post(
        `${API_URL}/${comunidadId}/invitaciones`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      if (!data?.url || !data?.token) {
        throw new Error('missing_invitation_url');
      }

      setInvitationUrl(data.url);
      setInvitationToken(data.token || '');
      setActiveInvitation({
        id: data.id,
        comunidad_id: data.comunidad_id,
        estado: data.estado,
        estado_efectivo: data.estado,
        expires_at: data.expires_at,
        max_usos: data.max_usos,
        usos_actuales: data.usos_actuales,
        created_at: data.created_at
      });
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

    if (!navigator.clipboard) {
      setInvitationError(
        'Não foi possível copiar automaticamente. Selecione o link e copie manualmente.'
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopyConfirmed(true);
      setInvitationNotice('Link copiado!');
    } catch {
      setInvitationError(
        'Não foi possível copiar automaticamente. Selecione o link e copie manualmente.'
      );
    }
  };

  const drawQrLabel = (context, canvasSize) => {
    const lines = shortCommunityName.split(' ');
    const labelLines = lines.length > 1
      ? [lines[0], lines.slice(1).join(' ')]
      : [shortCommunityName];
    const fontSize = Math.max(12, Math.floor(canvasSize * 0.055));
    const lineHeight = Math.floor(fontSize * 1.15);
    const paddingX = Math.floor(canvasSize * 0.035);
    const paddingY = Math.floor(canvasSize * 0.025);
    const labelWidth = Math.floor(canvasSize * 0.42);
    const labelHeight = (labelLines.length * lineHeight) + (paddingY * 2);
    const x = Math.floor((canvasSize - labelWidth) / 2);
    const y = Math.floor((canvasSize - labelHeight) / 2);

    context.fillStyle = '#fff';
    context.fillRect(x, y, labelWidth, labelHeight);
    context.fillStyle = '#1f2933';
    context.font = `700 ${fontSize}px Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    labelLines.slice(0, 2).forEach((line, index) => {
      context.fillText(
        line,
        canvasSize / 2,
        y + paddingY + (lineHeight / 2) + (index * lineHeight),
        labelWidth - (paddingX * 2)
      );
    });
  };

  const handleDownloadQr = () => {
    const sourceCanvas = qrCanvasRef.current?.querySelector('canvas');
    if (!sourceCanvas || !invitationUrl) return;

    const downloadCanvas = document.createElement('canvas');
    const canvasSize = sourceCanvas.width;
    downloadCanvas.width = canvasSize;
    downloadCanvas.height = canvasSize;

    const context = downloadCanvas.getContext('2d');
    context.drawImage(sourceCanvas, 0, 0);
    drawQrLabel(context, canvasSize);

    const link = document.createElement('a');
    link.href = downloadCanvas.toDataURL('image/png');
    link.download = `comuva-convite-${communitySlug}.png`;
    link.click();
  };

  const handleRevokeInvitation = async () => {
    if (!activeInvitation?.id || revokingInvitation || !authToken) return;

    setRevokingInvitation(true);
    setInvitationError('');
    setInvitationNotice('');

    try {
      await axios.patch(
        `${API_BASE}/api/invitaciones/${activeInvitation.id}/revocar`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      setInvitationUrl('');
      setInvitationToken('');
      setActiveInvitation(null);
      setCopyConfirmed(false);
      setInvitationNotice('Convite revogado.');
    } catch (err) {
      const status = err.response?.status;

      if (status === 401) {
        setInvitationError('Sua sessão expirou. Entre novamente.');
        logout?.();
        navigate('/Seinscrever');
      } else if (status === 403) {
        setInvitationError('Você não tem permissão para revogar este convite.');
      } else if (status === 404) {
        setInvitationError('Convite não encontrado.');
      } else {
        setInvitationError(
          err.response?.data?.message || 'Não foi possível revogar o convite.'
        );
      }
    } finally {
      setRevokingInvitation(false);
    }
  };

  const hasRecoverableInvitationUrl = Boolean(invitationUrl && invitationToken);
  const hasActiveInvitationWithoutUrl = Boolean(activeInvitation && !hasRecoverableInvitationUrl);

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
                <Card.Title>
                  {activeInvitation
                    ? 'Convite ativo'
                    : 'Convide pessoas para sua comunidade'}
                </Card.Title>
                <Card.Text>
                  {activeInvitation
                    ? 'Já existe um convite permanente ativo para esta comunidade.'
                    : 'Crie um convite permanente para compartilhar com várias pessoas.'}
                </Card.Text>
              </div>

              {!activeInvitation && (
                <Button
                  disabled={creatingInvitation || loadingInvitation || !authToken}
                  onClick={handleCreateInvitation}
                >
                  {creatingInvitation ? 'Gerando...' : 'Gerar convite'}
                </Button>
              )}
            </div>

            {invitationError && (
              <Alert variant="danger" aria-live="polite">
                {invitationError}
              </Alert>
            )}

            {invitationNotice && (
              <Alert variant="success" aria-live="polite">
                {invitationNotice}
              </Alert>
            )}

            {loadingInvitation && (
              <div className="text-muted small">Carregando convite ativo...</div>
            )}

            {hasActiveInvitationWithoutUrl && (
              <div className="community-invitation-manager__active">
                <div className="community-invitation-manager__metadata">
                  <div>
                    <span className="text-muted">Estado</span>
                    <strong>Ativo</strong>
                  </div>
                  <div>
                    <span className="text-muted">Usos</span>
                    <strong>{activeInvitation.usos_actuales || 0}</strong>
                  </div>
                </div>

                <p className="small text-muted mb-0">
                  Já existe um convite ativo. Por segurança, o link só é exibido no momento
                  em que é gerado. Se precisar compartilhá-lo novamente, gere um novo convite.
                </p>

                <div className="community-invitation-manager__actions">
                  <Button
                    disabled={creatingInvitation || revokingInvitation || !authToken}
                    onClick={handleCreateInvitation}
                  >
                    {creatingInvitation ? 'Gerando...' : 'Gerar novo convite'}
                  </Button>
                  <Button
                    variant="outline-danger"
                    disabled={revokingInvitation || creatingInvitation || !authToken}
                    onClick={handleRevokeInvitation}
                  >
                    {revokingInvitation ? 'Revogando...' : 'Revogar convite'}
                  </Button>
                </div>
              </div>
            )}

            {hasRecoverableInvitationUrl && (
              <>
                <p className="small text-muted">
                  Este convite não expira e pode ser compartilhado com várias pessoas.
                  Você pode revogá-lo a qualquer momento.
                </p>

                <div className="community-invitation-manager__share">
                  <InputGroup className="community-invitation-manager__link">
                    <div
                      className="community-invitation-manager__url"
                      role="textbox"
                      aria-label="Link do convite"
                      tabIndex={0}
                    >
                      {invitationUrl}
                    </div>
                    <Button
                      variant="outline-secondary"
                      disabled={creatingInvitation}
                      onClick={handleCopyInvitation}
                    >
                      {copyConfirmed ? 'Link copiado!' : 'Copiar link'}
                    </Button>
                  </InputGroup>

                  <div className="community-invitation-manager__qr" ref={qrCanvasRef}>
                    <QRCodeCanvas
                      value={invitationUrl}
                      size={232}
                      level="H"
                      includeMargin
                    />
                    <div className="community-invitation-manager__qr-label" aria-hidden="true">
                      {shortCommunityName}
                    </div>
                  </div>

                  <div className="community-invitation-manager__actions">
                    <Button
                      variant="outline-secondary"
                      disabled={!invitationUrl}
                      onClick={handleDownloadQr}
                    >
                      Baixar QR
                    </Button>
                    <Button
                      variant="outline-danger"
                      disabled={revokingInvitation || !activeInvitation?.id || !authToken}
                      onClick={handleRevokeInvitation}
                    >
                      {revokingInvitation ? 'Revogando...' : 'Revogar convite'}
                    </Button>
                  </div>
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
