import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Col, Form, Row } from 'react-bootstrap';
import axios from 'axios';
import { UserContext } from '../UserContext';
import OnboardingLayout from '../components/OnboardingLayout';
import OnboardingAccessGuard from '../components/OnboardingAccessGuard';
import { completeOnboardingSession } from '../utils/onboardingSession';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export default function CrearComunidad() {
  const navigate = useNavigate();
  const { user, login } = useContext(UserContext);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    direccion: '',
    telefono: '',
    administrador: user?.username || '',
    objetivo: '',
    tipo: '',
    visibilidad: 'publica',
    ciudad: '',
    pais: '',
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!formData.nombre.trim()) {
      setMessage({ type: 'danger', text: 'Informe o nome da comunidade para continuar.' });
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        `${API_BASE}/api/comunidades/onboarding`,
        {
          nombre: formData.nombre.trim(),
          descripcion: formData.descripcion.trim() || null,
          direccion: formData.direccion.trim() || null,
          telefono: formData.telefono.trim() || null,
          administrador: formData.administrador.trim() || user?.username || null,
          objetivo: formData.objetivo.trim() || null,
          tipo: formData.tipo.trim() || null,
          visibilidad: formData.visibilidad || 'publica',
          ciudad: formData.ciudad.trim() || null,
          pais: formData.pais.trim() || null,
        },
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
        text: error.response?.data?.message || 'Erro ao criar comunidade'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <OnboardingAccessGuard
        type="unauthenticated"
        step={3}
        maxWidth="640px"
        unauthenticatedMessage="Você precisa entrar para criar uma comunidade."
      />
    );
  }

  if (user.comunidad_id || user.comunidadId) {
    return (
      <OnboardingAccessGuard type="assigned" step={3} maxWidth="640px" />
    );
  }

  return (
    <OnboardingLayout step={3} maxWidth="860px">
      <div className="onboarding-panel">
        <h1>Criar uma nova comunidade</h1>
        <p>Preencha os dados principais. O backend validará a criação e a associação do usuário.</p>

        {message.text && <Alert variant={message.type}>{message.text}</Alert>}

        <Form onSubmit={handleSubmit} noValidate>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Nome da comunidade <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                  aria-required="true"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Administrador</Form.Label>
                <Form.Control
                  name="administrador"
                  value={formData.administrador}
                  onChange={handleChange}
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Descrição</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Objetivo</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="objetivo"
              value={formData.objetivo}
              onChange={handleChange}
              placeholder="Descreva o propósito da comunidade"
            />
          </Form.Group>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Tipo</Form.Label>
                <Form.Control
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleChange}
                  placeholder="Ex.: bairro, escola, associação"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Visibilidade</Form.Label>
                <Form.Select
                  name="visibilidad"
                  value={formData.visibilidad}
                  onChange={handleChange}
                >
                  <option value="publica">Pública</option>
                  <option value="privada">Privada</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={8}>
              <Form.Group className="mb-3">
                <Form.Label>Endereço</Form.Label>
                <Form.Control
                  name="direccion"
                  value={formData.direccion}
                  onChange={handleChange}
                />
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Telefone</Form.Label>
                <Form.Control
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                />
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Cidade</Form.Label>
                <Form.Control
                  name="ciudad"
                  value={formData.ciudad}
                  onChange={handleChange}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>País</Form.Label>
                <Form.Control
                  name="pais"
                  value={formData.pais}
                  onChange={handleChange}
                />
              </Form.Group>
            </Col>
          </Row>

          <div className="onboarding-actions">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Criando...' : 'Criar comunidade'}
            </Button>
          </div>
        </Form>
      </div>
    </OnboardingLayout>
  );
}
