import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Container, Row, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export default function SeleccionarComunidad() {
  const navigate = useNavigate();
  const { user, login } = useContext(UserContext);
  const [comunidades, setComunidades] = useState([]);
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

  const handleUnirse = async (comunidadId) => {
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

      if (data.token && typeof login === 'function') {
        login(data.token, data.user || null);
      } else if (data.token) {
        localStorage.setItem('token', data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      }

      if (data.user) {
        const normalizedUser = {
          ...data.user,
          comunidadId: data.user.comunidadId || data.user.comunidad_id
        };

        localStorage.setItem('user', JSON.stringify(normalizedUser));
      }

      navigate('/interacciones');
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
      <Container className="small-container mt-5" style={{ maxWidth: '760px' }}>
        <Alert variant="warning">Você precisa entrar para participar de uma comunidade.</Alert>
        <Button onClick={() => navigate('/Seinscrever')}>Entrar</Button>
      </Container>
    );
  }

  if (user.comunidad_id || user.comunidadId) {
    return (
      <Container className="small-container mt-5" style={{ maxWidth: '760px' }}>
        <Alert variant="info">Seu usuário já tem uma comunidade atribuída.</Alert>
        <Button onClick={() => navigate('/interacciones')}>Continuar</Button>
      </Container>
    );
  }

  return (
    <Container className="mt-5">
      <div className="mb-4">
        <h2>Entrar em uma comunidade</h2>
        <p>Escolha uma comunidade existente para começar a participar.</p>
      </div>

      {message.text && <Alert variant={message.type}>{message.text}</Alert>}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
          <div>Carregando comunidades...</div>
        </div>
      ) : (
        <Row>
          {comunidades.length === 0 && (
            <Col>
              <Alert variant="info">Não há comunidades disponíveis.</Alert>
            </Col>
          )}

          {comunidades.map((comunidad) => (
            <Col md={6} lg={4} className="mb-3" key={comunidad.id}>
              <Card className="h-100">
                <Card.Body>
                  <Card.Title>{comunidad.nombre}</Card.Title>
                  <Card.Text>
                    {comunidad.administrador && (
                      <span>Administrador: {comunidad.administrador}<br /></span>
                    )}
                    {comunidad.direccion && (
                      <span>Endereço: {comunidad.direccion}<br /></span>
                    )}
                    {comunidad.telefono && (
                      <span>Telefone: {comunidad.telefono}</span>
                    )}
                  </Card.Text>
                  <Button
                    variant="primary"
                    onClick={() => handleUnirse(comunidad.id)}
                    disabled={joiningId === comunidad.id}
                  >
                    {joiningId === comunidad.id ? 'Entrando...' : 'Entrar'}
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
}
