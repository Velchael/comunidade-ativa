import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Container, Form } from 'react-bootstrap';
import axios from 'axios';
import { UserContext } from '../UserContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export default function CrearComunidad() {
  const navigate = useNavigate();
  const { user, login, setUser } = useContext(UserContext);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    direccion: '',
    telefono: '',
    administrador: user?.username || '',
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
      setMessage({ type: 'danger', text: 'O nome da comunidade é obrigatório.' });
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
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (data.token) {
        if (typeof login === 'function') {
          login(data.token, data.user || null);
        } else {
          localStorage.setItem('token', data.token);
          axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        }
      }

      if (data.user) {
        const normalizedUser = {
          ...data.user,
          comunidadId: data.user.comunidadId || data.user.comunidad_id
        };

        if (typeof setUser === 'function') {
          setUser(normalizedUser);
        }

        localStorage.setItem('user', JSON.stringify(normalizedUser));
      }

      navigate('/interacciones');
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
      <Container className="small-container mt-5" style={{ maxWidth: '640px' }}>
        <Alert variant="warning">Você precisa entrar para criar uma comunidade.</Alert>
        <Button onClick={() => navigate('/Seinscrever')}>Entrar</Button>
      </Container>
    );
  }

  if (user.comunidad_id || user.comunidadId) {
    return (
      <Container className="small-container mt-5" style={{ maxWidth: '640px' }}>
        <Alert variant="info">Seu usuário já tem uma comunidade atribuída.</Alert>
        <Button onClick={() => navigate('/interacciones')}>Continuar</Button>
      </Container>
    );
  }

  return (
    <Container className="small-container mt-5" style={{ maxWidth: '640px' }}>
      <h2 className="mb-4">Criar nova comunidade</h2>

      {message.text && <Alert variant={message.type}>{message.text}</Alert>}

      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>Nome da comunidade</Form.Label>
          <Form.Control
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Descrição</Form.Label>
          <Form.Control
            as="textarea"
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Endereço</Form.Label>
          <Form.Control
            name="direccion"
            value={formData.direccion}
            onChange={handleChange}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Telefone</Form.Label>
          <Form.Control
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Administrador</Form.Label>
          <Form.Control
            name="administrador"
            value={formData.administrador}
            onChange={handleChange}
          />
        </Form.Group>

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Criando...' : 'Criar comunidade'}
        </Button>
      </Form>
    </Container>
  );
}
