import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Form, Button, Alert, Row, Col } from 'react-bootstrap';
import { Helmet } from 'react-helmet-async';
import { UserContext } from '../UserContext';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

export default function SeInscrever() {
  const { setUser } = useContext(UserContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    apellido: '',
    rol: 'miembro',
    fecha_nacimiento: '',
    telefono: '',
    direccion: '',
    nivel_liderazgo: 'Nivel1',
    grupo_familiar_id: '',
    estado: 'activo',
    foto_perfil: '',
    comunidad_id: '', // 🆕 Nuevo campo
  });

  const [comunidades, setComunidades] = useState([]); // 🆕 Lista de comunidades
  const [googleUser, setGoogleUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      localStorage.setItem('token', token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      const decoded = jwtDecode(token);
      const userData = {
        id: decoded.id,
        email: decoded.email,
        rol: decoded.rol,
        username: decoded.username || decoded.email.split('@')[0],
        googleId: decoded.googleId,
        avatar: decoded.avatar || null
      };
      setUser(userData);
      setGoogleUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));

      if (window.location.pathname !== '/seinscrever') {
        navigate('/seinscrever', { replace: true });
      }
    } else {
      const savedUser = localStorage.getItem('user');
      const savedToken = localStorage.getItem('token');
      if (savedUser && savedToken) {
        const parsedUser = JSON.parse(savedUser);
        axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
        setUser(parsedUser);
        setGoogleUser(parsedUser);
      }
    }
  }, [navigate, setUser]);

  // ✅ Cargar comunidades al montar
  useEffect(() => {
    const fetchComunidades = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/comunidades`);
        setComunidades(res.data);
      } catch (error) {
        console.error("❌ Error al cargar comunidades", error);
      }
    };
    fetchComunidades();
  }, []);

  // ✅ Verificar perfil completo
  useEffect(() => {
    const checkIfProfileCompleted = async () => {
      if (googleUser?.email) {
        try {
          const { data } = await axios.get(`${process.env.REACT_APP_API_URL}/api/users/${googleUser.email}`);
          if (data.apellido && data.fecha_nacimiento) {
            navigate('/dashboard');
          } else {
            setShowForm(true);
          }
        } catch (error) {
          console.warn('No se pudo verificar perfil:', error);
          setShowForm(true);
        } finally {
          setCheckingProfile(false);
        }
      } else {
        setCheckingProfile(false);
      }
    };

    checkIfProfileCompleted();
  }, [googleUser, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    const isVelchael = googleUser.username === 'Velchael' || googleUser.email === 'velchael@tudominio.com';

    const payload = {
      ...formData,
      email: googleUser.email,
      googleId: googleUser.googleId,
      foto_perfil: googleUser?.avatar,
      rol: isVelchael ? 'admin_total' : 'miembro'
    };

    try {
      //const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/users/google/complete`, payload);
      setMessage({ type: 'success', text: 'Perfil completado com sucesso!' });
      navigate('/dashboard');
    } catch (error) {
      setMessage({ type: 'danger', text: error.response?.data?.message || 'Error al guardar perfil' });
    }
  };

  if (checkingProfile) {
    return (
      <Container className="small-container text-center mt-5">
        <Helmet><title>Verificando...</title></Helmet>
        <h2>Verificando perfil...</h2>
      </Container>
    );
  }

  if (!googleUser) {
    return (
      <Container className="small-container text-center mt-5">
        <Helmet><title>Login</title></Helmet>
        <h2>Inicia sesión con Google</h2>
        <Button onClick={() => window.location.href = `${process.env.REACT_APP_API_URL}/api/auth/google`}>
          Login con Google
        </Button>
      </Container>
    );
  }

  if (!showForm) return null;

  return (
    <Container className="small-container">
      <Helmet><title>Login / Completar Perfil</title></Helmet>
      <h2>Login con Google</h2>

      <h1 className="my-3">
        👋 ¡Hola <strong>{googleUser?.username || googleUser?.email.split('@')[0]}</strong>!<br />
        Bienvenido a Comunidad-ativa Vamos a ayudarte a completar tu perfil.
      </h1>
      {message.text && <Alert variant={message.type}>{message.text}</Alert>}
      <Form onSubmit={handleCompleteProfile}>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="apellido">
              <Form.Label>Apellido</Form.Label>
              <Form.Control type="text" required name="apellido" value={formData.apellido} onChange={handleChange} />
            </Form.Group>
          </Col>
        </Row>

        <Row>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="fecha_nacimiento">
              <Form.Label>Fecha de nacimiento</Form.Label>
              <Form.Control type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleChange} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="telefono">
              <Form.Label>Teléfono</Form.Label>
              <Form.Control type="text" name="telefono" value={formData.telefono} onChange={handleChange} />
            </Form.Group>
          </Col>
        </Row>

        <Row>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="direccion">
              <Form.Label>Dirección</Form.Label>
              <Form.Control type="text" name="direccion" value={formData.direccion} onChange={handleChange} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="nivel_liderazgo">
              <Form.Label>Nivel de liderazgo</Form.Label>
              <Form.Control as="select" name="nivel_liderazgo" value={formData.nivel_liderazgo} onChange={handleChange}>
                <option value="Nivel1">Nivel 1</option>
                <option value="Nivel2">Nivel 2</option>
                <option value="Nivel3">Nivel 3</option>
              </Form.Control>
            </Form.Group>
          </Col>
        </Row>

        <Row>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="grupo_familiar_id">
              <Form.Label>Grupo Familiar ID</Form.Label>
              <Form.Control type="number" name="grupo_familiar_id" value={formData.grupo_familiar_id} onChange={handleChange} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="estado">
              <Form.Label>Estado</Form.Label>
              <Form.Control as="select" name="estado" value={formData.estado} onChange={handleChange}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="pendiente">Pendiente</option>
              </Form.Control>
            </Form.Group>
          </Col>
        </Row>

        {/* 🆕 Selector de comunidad */}
        <Form.Group className="mb-3" controlId="comunidad_id">
          <Form.Label>Selecciona tu comunidad</Form.Label>
          <Form.Control
            as="select"
            name="comunidad_id"
            value={formData.comunidad_id || ''}
            onChange={handleChange}
            required
          >
            <option value="">-- Selecciona una --</option>
            {comunidades.map((comunidad) => (
              <option key={comunidad.id} value={comunidad.id}>
                {comunidad.nombre} - {comunidad.administrador}
              </option>
            ))}
          </Form.Control>
        </Form.Group>

        <Button type="submit">Guardar Perfil</Button>
      </Form>
    </Container>
  );
}

