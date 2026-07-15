import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';
import OnboardingLayout from '../components/OnboardingLayout';
import OnboardingAccessGuard from '../components/OnboardingAccessGuard';
import { completeOnboardingSession } from '../utils/onboardingSession';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export default function SeleccionarComunidad() {
  const navigate = useNavigate();
  const { user, login } = useContext(UserContext);
  const [comunidades, setComunidades] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const cargarComunidades = useCallback(async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { data } = await axios.get(`${API_BASE}/api/comunidades`);
      setComunidades(data || []);
    } catch (error) {
      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Erro ao carregar comunidades'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarComunidades();
  }, [cargarComunidades]);

  const comunidadesFiltradas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      return comunidades;
    }

    return comunidades.filter((comunidad) =>
      String(comunidad.nombre || '').toLowerCase().includes(term)
    );
  }, [comunidades, searchTerm]);

  const handleUnirse = async (comunidadId) => {
    setSelectedId(comunidadId);
    setJoiningId(comunidadId);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        `${API_BASE}/api/comunidades/${comunidadId}/unirse`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const completedUser = await completeOnboardingSession({ data, login });

      navigate('/onboarding-confirmacion', {
        replace: true,
        state: {
          onboardingCompleted: true,
          completedUser
        }
      });
    } catch (error) {
      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Não foi possível entrar na comunidade'
      });
    } finally {
      setJoiningId(null);
    }
  };

  if (!user) {
    return (
      <OnboardingAccessGuard
        type="unauthenticated"
        step={3}
        maxWidth="760px"
        unauthenticatedMessage="Você precisa entrar para participar de uma comunidade."
      />
    );
  }

  if (user.comunidad_id || user.comunidadId) {
    return (
      <OnboardingAccessGuard type="assigned" step={3} maxWidth="760px" />
    );
  }

  return (
    <OnboardingLayout step={3} maxWidth="1040px">
      <div className="onboarding-panel">
        <div className="mb-4">
          <h1>Entrar em uma comunidade</h1>
          <p>Busque pelo nome e escolha a comunidade em que deseja participar.</p>
        </div>

        {message.text && <Alert variant={message.type}>{message.text}</Alert>}

        <Form.Group className="mb-4" controlId="buscar-comunidade">
          <Form.Label>Buscar comunidade</Form.Label>
          <Form.Control
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Digite o nome da comunidade"
          />
        </Form.Group>

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
            <div>Carregando comunidades...</div>
          </div>
        ) : (
          <Row className="g-3">
            {comunidades.length === 0 && (
              <Col>
                <Alert variant="info">Não há comunidades disponíveis.</Alert>
              </Col>
            )}

            {comunidades.length > 0 && comunidadesFiltradas.length === 0 && (
              <Col>
                <Alert variant="info">Nenhuma comunidade encontrada com esse nome.</Alert>
              </Col>
            )}

            {comunidadesFiltradas.map((comunidad) => {
              const isSelected = selectedId === comunidad.id;
              const isJoining = joiningId === comunidad.id;

              return (
                <Col md={6} lg={4} key={comunidad.id}>
                  <Card
                    className={`community-result-card h-100${isSelected ? ' is-selected' : ''}`}
                    onClick={() => setSelectedId(comunidad.id)}
                  >
                    <Card.Body>
                      <div className="community-result-card__header">
                        <Card.Title>{comunidad.nombre}</Card.Title>
                        {isSelected && (
                          <span className="community-result-card__badge">
                            Selecionada
                          </span>
                        )}
                      </div>

                      <dl className="community-result-card__details">
                        {comunidad.administrador && (
                          <>
                            <dt>Administrador</dt>
                            <dd>{comunidad.administrador}</dd>
                          </>
                        )}
                        {comunidad.direccion && (
                          <>
                            <dt>Endereço</dt>
                            <dd>{comunidad.direccion}</dd>
                          </>
                        )}
                        {comunidad.telefono && (
                          <>
                            <dt>Telefone</dt>
                            <dd>{comunidad.telefono}</dd>
                          </>
                        )}
                        {comunidad.ciudad && (
                          <>
                            <dt>Cidade</dt>
                            <dd>{comunidad.ciudad}</dd>
                          </>
                        )}
                        {comunidad.pais && (
                          <>
                            <dt>País</dt>
                            <dd>{comunidad.pais}</dd>
                          </>
                        )}
                      </dl>

                      <Button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleUnirse(comunidad.id);
                        }}
                        disabled={Boolean(joiningId)}
                      >
                        {isJoining ? 'Entrando...' : 'Entrar nesta comunidade'}
                      </Button>
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </div>
    </OnboardingLayout>
  );
}
