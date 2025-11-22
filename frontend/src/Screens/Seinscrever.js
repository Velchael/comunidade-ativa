// src/Screens/Seinscrever.js
import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Form, Button, Alert } from 'react-bootstrap';
import { Helmet } from 'react-helmet-async';
import { UserContext } from '../UserContext';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode'; // si tu versión usa named export; si falla usa: import jwtDecode from 'jwt-decode';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export default function Seinscrever() {
  const { setUser, login } = useContext(UserContext) || {}; // si tu contexto exporta login preférelos
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    apellido: '',
    telefono: '',
    comunidad_id: ''
  });

  const [comunidades, setComunidades] = useState([]); // lista desde backend
  const [googleUser, setGoogleUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  // Extrae token si viene en query (flow Google)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      // Guardar temporalmente el token en axios header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Decodificar token para obtener datos provisionales
      let decoded = {};
      try {
        decoded = jwtDecode(token);
      } catch (err) {
        console.warn('Token no pudo decodificarse', err);
      }

      const userData = {
        id: decoded.id,
        email: decoded.email,
        rol: decoded.rol,
        username: decoded.username || (decoded.email ? decoded.email.split('@')[0] : ''),
        googleId: decoded.googleId,
        avatar: decoded.avatar || null
      };

      // Guardar provisionalmente en contexto (no final hasta que backend confirme)
      if (typeof setUser === 'function') setUser(userData);
      setGoogleUser(userData);

      // No escribir en localStorage aquí; espera respuesta final del backend.
      // Aun así, si tu contexto no tiene 'login', puedes almacenar provisionalmente:
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', token);

      if (window.location.pathname !== '/seinscrever') {
        navigate('/seinscrever', { replace: true });
      }
    } else {
      // Si ya hay user/token en localStorage, restore al contexto
      const savedUser = localStorage.getItem('user');
      const savedToken = localStorage.getItem('token');
      if (savedUser && savedToken) {
        try {
          const parsedUser = JSON.parse(savedUser);
          axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
          if (typeof setUser === 'function') setUser(parsedUser);
          setGoogleUser(parsedUser);
        } catch (err) {
          console.warn('No se pudo parsear user desde localStorage', err);
        }
      }
    }
  }, [navigate, setUser]);

  // Cargar comunidades desde backend (para el select)
  useEffect(() => {
    const fetchComunidades = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/comunidades`);
        // tu BACKEND devuelve { id, nombre_comunidad, ... }
        setComunidades(res.data || []);
      } catch (error) {
        console.error('❌ Error al cargar comunidades', error);
      }
    };
    fetchComunidades();
  }, []);

  // Verificar si el perfil ya está completado (backend devuelve el user por email)
  useEffect(() => {
    const checkIfProfileCompleted = async () => {
      if (!googleUser?.email) {
        setCheckingProfile(false);
        return;
      }
      try {
        const { data } = await axios.get(`${API_BASE}/api/users/${googleUser.email}`);
        // Si tiene apellido -> perfil completo
        if (data && data.apellido) {
          // Actualizar contexto y localStorage con datos reales desde backend
          if (typeof setUser === 'function') setUser(data);
          localStorage.setItem('user', JSON.stringify(data));
          // Si el backend devolvió token anteriormente, ideal: llamar /auth/me o refresh
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
    };

    checkIfProfileCompleted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleUser]);

  // Manejo de inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Enviar datos mínimos para completar perfil (Google)
  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!formData.apellido || !formData.comunidad_id) {
      setMessage({ type: 'danger', text: 'Por favor completa Apellido y selecciona tu comunidad.' });
      return;
    }

    setSubmitting(true);

    const payload = {
      apellido: formData.apellido.trim(),
      telefono: formData.telefono.trim() || null,
      comunidad_id: formData.comunidad_id,
      email: googleUser?.email,
      googleId: googleUser?.googleId,
      foto_perfil: googleUser?.avatar || null
    };

    try {
      // POST al endpoint que complete perfil y devuelva token + user
      const res = await axios.post(`${API_BASE}/api/users/google/complete`, payload);

      // Esperamos { token, user }
      const { token: newToken, user: savedUser } = res.data || {};

      if (newToken) {
        // Usa la función login del contexto si existe, sino guarda manual
        if (typeof login === 'function') {
          login(newToken); // tu contexto puede decodificar y setear user
        } else {
          localStorage.setItem('token', newToken);
          axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        }
      }

      if (savedUser) {
        if (typeof setUser === 'function') setUser(savedUser);
        localStorage.setItem('user', JSON.stringify(savedUser));
      } else {
        // Si backend no devuelve user, llama a /auth/me para obtener user
        try {
          const me = await axios.get(`${API_BASE}/api/auth/me`);
          if (typeof setUser === 'function') setUser(me.data);
          localStorage.setItem('user', JSON.stringify(me.data));
        } catch (err) {
          console.warn('No se pudo obtener, completar perfil', err);
        }
      }

      setMessage({ type: 'success', text: 'Perfil completado con éxito — redirigiendo...' });
      setTimeout(() => navigate('/dashboard'), 800);

    } catch (error) {
      console.error('Error completando perfil:', error);
      const msg = error?.response?.data?.message || 'Error al guardar perfil';
      setMessage({ type: 'danger', text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingProfile) {
    return (
      <Container className="small-container text-center mt-5">
        <Helmet><title>Verificando perfil...</title></Helmet>
        <h2>Verificando perfil...</h2>
      </Container>
    );
  }

  if (!googleUser) {
    return (
      <Container className="small-container text-center mt-5">
        <Helmet><title>Login</title></Helmet>
        <h2>Inicia sesión con Google</h2>
        <Button onClick={() => window.location.href = `${API_BASE}/api/auth/google`}>
          Login con Google
        </Button>
      </Container>
    );
  }

  if (!showForm) return null;

  return (
    <Container className="small-container">
      <Helmet><title>Completar Perfil</title></Helmet>

      <h1 className="my-3">
        👋 ¡Hola <strong>{googleUser?.username || googleUser?.email.split('@')[0]}</strong>!
      </h1>

      {message.text && <Alert variant={message.type}>{message.text}</Alert>}

      <Form onSubmit={handleCompleteProfile}>
        {/* Apellido (OBLIGATORIO) */}
        <Form.Group className="mb-3" controlId="apellido">
          <Form.Label>Apellido</Form.Label>
          <Form.Control
            type="text"
            required
            name="apellido"
            value={formData.apellido}
            onChange={handleChange}
            placeholder="Ingresa tu apellido"
          />
        </Form.Group>

        {/* Teléfono (OPCIONAL) */}
        <Form.Group className="mb-3" controlId="telefono">
          <Form.Label>Teléfono (opcional)</Form.Label>
          <Form.Control
            type="text"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
            placeholder="Ej: +55 71 9xxxx-xxxx"
          />
        </Form.Group>

        {/* Comunidad (OBLIGATORIO) */}
        <Form.Group className="mb-3" controlId="comunidad_id">
          <Form.Label>Selecciona tu comunidad</Form.Label>
          <Form.Control
            as="select"
            name="comunidad_id"
            value={formData.comunidad_id}
            onChange={handleChange}
            required
          >
            <option value="">-- Selecciona una --</option>
            {comunidades.map(c => (
              <option key={c.id} value={c.id}>
                {c.nombre_comunidad || c.nombre || c.name}
              </option>
            ))}
          </Form.Control>
        </Form.Group>

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando...' : 'Guardar perfil básico'}
        </Button>
      </Form>
    </Container>
  );
}

