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
    foto_perfil: ''
  });

  const [googleUser, setGoogleUser] = useState(null);
  const [showForm, setShowForm] = useState(false); // ⬅️ NUEVO
  const [checkingProfile, setCheckingProfile] = useState(true); // 🟡 estado para control de cargaconst [showForm, setShowForm] = useState(false); // ⬅️ NUEVO
  const [message, setMessage] = useState({ type: '', text: '' });

 useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (token) {
    // 🟡 Guardar token y decodificar
    localStorage.setItem('token', token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    const decoded = jwtDecode(token);
    
    // 🟢 Guardar usuario en contexto y localStorage
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
    // 🟢 Restaurar desde localStorage si no hay token nuevo
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


  // ✅ Verificar si el perfil ya está completo
  useEffect(() => {
    const checkIfProfileCompleted = async () => {
      if (googleUser?.email) {
        try {
          const { data } = await axios.get(`${process.env.REACT_APP_API_URL}/api/users/${googleUser.email}`);
          if (data.apellido && data.fecha_nacimiento) {
            navigate('/dashboard');
          } else {
            setShowForm(true); // incompleto, mostrar formulario
          }
        } catch (error) {
          console.warn('No se pudo verificar perfil:', error);
          setShowForm(true);
        } finally {
          setCheckingProfile(false);
        }
      } else {
      setCheckingProfile(false); // ⬅️ Para evitar bucle infinito
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
      rol: isVelchael ? 'admin_total' : 'miembro'  // ⬅️ Asignación automática
    };

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/users/google/complete`, payload);
      console.log("✅ Perfil completado:", response.data);
      setMessage({ type: 'success', text: 'Perfil completado com sucesso!' });
      navigate('/dashboard');
    } catch (error) {
      console.error('❌ Error al enviar datos:', error.response?.data || error.message);
      setMessage({ type: 'danger', text: error.response?.data?.message || 'Error al guardar perfil' });
    }
  };

  // 🟡 Mostrar cargando mientras se verifica
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

  if (!showForm) return null; // ⬅️ No mostrar el formulario si ya está completo

   // 🧾 Render del formulario
  return (
    <Container className="small-container">
      <Helmet><title>Completar Perfil - Reddevida</title></Helmet>
      <h1 className="my-3">
  👋   ¡Hola <strong>{googleUser?.username || googleUser?.email.split('@')[0]}</strong>!<br />
        Bienvenido a Reddevida. Vamos a ayudarte a completar tu perfil.
      </h1>
      {message.text && <Alert variant={message.type}>{message.text}</Alert>}
      <Form onSubmit={handleCompleteProfile}>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="apellido">
              <Form.Label>Apellido</Form.Label>
              <Form.Control
                type="text"
                required
                name="apellido"
                value={formData.apellido}
                onChange={handleChange}
              />
            </Form.Group>
          </Col>
         
        </Row>

        <Row>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="fecha_nacimiento">
              <Form.Label>Fecha de nacimiento</Form.Label>
              <Form.Control
                type="date"
                name="fecha_nacimiento"
                value={formData.fecha_nacimiento}
                onChange={handleChange}
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="telefono">
              <Form.Label>Teléfono</Form.Label>
              <Form.Control
                type="text"
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
              />
            </Form.Group>
          </Col>
        </Row>

        <Row>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="direccion">
              <Form.Label>Dirección</Form.Label>
              <Form.Control
                type="text"
                name="direccion"
                value={formData.direccion}
                onChange={handleChange}
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3" controlId="nivel_liderazgo">
              <Form.Label>Nivel de liderazgo</Form.Label>
              <Form.Control
                as="select"
                name="nivel_liderazgo"
                value={formData.nivel_liderazgo}
                onChange={handleChange}
              >
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
              <Form.Control
                type="number"
                name="grupo_familiar_id"
                value={formData.grupo_familiar_id}
                onChange={handleChange}
              />
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
      
        <Button type="submit">Guardar Perfil</Button>
      </Form>
    </Container>
  );
}
