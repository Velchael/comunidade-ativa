// src/Screens/Seinscrever.js

import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Form,
  Button,
  Alert,
  Card,
  Row,
  Col
} from 'react-bootstrap';

import { Helmet } from 'react-helmet-async';
import { UserContext } from '../UserContext';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export default function Seinscrever() {

  const { setUser, login } = useContext(UserContext) || {};
  const navigate = useNavigate();

  // =====================================================
  // 🔹 ESTADOS
  // =====================================================

  const [formData, setFormData] = useState({
    apellido: '',
    telefono: ''
  });

  const [googleUser, setGoogleUser] = useState(null);

  // 🔹 controla si muestra formulario perfil
  const [showProfileForm, setShowProfileForm] = useState(false);

  // 🔹 nuevo flujo social
  const [showCommunityOptions, setShowCommunityOptions] = useState(false);

  const [checkingProfile, setCheckingProfile] = useState(true);

  const [message, setMessage] = useState({
    type: '',
    text: ''
  });

  const [submitting, setSubmitting] = useState(false);

  // =====================================================
  // 🔹 LOGIN GOOGLE
  // =====================================================

  useEffect(() => {
    const syncGoogleSession = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        let decoded = {};

        try {
          decoded = jwtDecode(token);
        } catch (err) {
          console.warn('Token inválido', err);
        }

        const fallbackUser = {
          id: decoded.id,
          email: decoded.email,
          rol: decoded.rol,
          rol_global: decoded.rol_global || decoded.rol,
          username:
            decoded.username ||
            (decoded.email
              ? decoded.email.split('@')[0]
              : ''),
          googleId: decoded.googleId,
          avatar: decoded.avatar || null,
          comunidad_id: decoded.comunidad_id || null
        };

        let sessionUser = fallbackUser;

        if (typeof login === 'function') {
          try {
            const hydratedUser = await login(token, null);
            if (hydratedUser) {
              sessionUser = {
                ...fallbackUser,
                ...hydratedUser
              };
            }
          } catch (err) {
            console.warn('No se pudo hidratar sesión inicial con refresh');
          }
        } else if (typeof setUser === 'function') {
          setUser(fallbackUser);
        }

        setGoogleUser(sessionUser);

        if (window.location.pathname !== '/Seinscrever') {
          navigate('/Seinscrever', { replace: true });
        }
      } else {
        // 🔹 RESTAURA LOGIN SI YA EXISTE
        const savedUser = localStorage.getItem('user');
        const savedToken = localStorage.getItem('token');

        if (savedUser && savedToken) {
          try {
            const parsedUser = JSON.parse(savedUser);

            axios.defaults.headers.common['Authorization'] =
              `Bearer ${savedToken}`;

            if (typeof setUser === 'function') {
              setUser(parsedUser);
            }

            setGoogleUser(parsedUser);
          } catch (err) {
            console.warn('No se pudo restaurar sesión');
          }
        }
      }
    };

    syncGoogleSession();
  }, [login, navigate, setUser]);

  // =====================================================
  // 🔹 VERIFICAR PERFIL COMPLETADO
  // =====================================================

  useEffect(() => {

    const checkIfProfileCompleted = async () => {

      if (!googleUser?.email) {
        setCheckingProfile(false);
        return;
      }

      try {

        const { data } = await axios.get(
          `${API_BASE}/api/users/${googleUser.email}`
        );

        // =================================================
        // 🔹 SI YA TIENE PERFIL COMPLETO
        // =================================================

        if (data && data.apellido) {

          // =============================================
          // 🔹 NUEVA LÓGICA SOCIAL
          // =============================================

          // SI YA TIENE COMUNIDAD → entra directo
          if (data.comunidad_id) {

            navigate('/interacciones');

          } else {

            // SI NO TIENE COMUNIDAD
            // mostrar opciones sociales

            setShowCommunityOptions(true);
          }

        } else {

          // 🔹 MOSTRAR FORMULARIO PERFIL

          setShowProfileForm(true);
        }

      } catch (error) {

        console.warn('No se pudo verificar perfil');

        setShowProfileForm(true);

      } finally {

        setCheckingProfile(false);
      }
    };

    checkIfProfileCompleted();

  }, [googleUser, navigate, setUser]);

  // =====================================================
  // 🔹 MANEJO INPUTS
  // =====================================================

  const handleChange = (e) => {

    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // =====================================================
  // 🔹 COMPLETAR PERFIL BÁSICO
  // =====================================================

  const handleCompleteProfile = async (e) => {

    e.preventDefault();

    setMessage({
      type: '',
      text: ''
    });

    // =================================================
    // 🔹 SOLO APELLIDO OBLIGATORIO
    // =================================================

    if (!formData.apellido) {

      setMessage({
        type: 'danger',
        text: 'Por favor completa tu apellido.'
      });

      return;
    }

    setSubmitting(true);

    // =================================================
    // 🔹 NUEVO PAYLOAD
    // 🔥 comunidad_id REMOVIDO
    // =================================================

    const payload = {

      apellido: formData.apellido.trim(),

      telefono:
        formData.telefono.trim() || null,

      email: googleUser?.email,

      googleId: googleUser?.googleId,

      foto_perfil:
        googleUser?.avatar || null
    };

    try {

      // =================================================
      // 🔹 COMPLETAR PERFIL
      // =================================================

      const res = await axios.post(
        `${API_BASE}/api/users/google/complete`,
        payload
      );

      const { token: newToken, user: savedUser } = res.data || {};

      // =================================================
      // 🔹 LOGIN CONTEXTO
      // =================================================

      const sessionToken = newToken || localStorage.getItem('token');

      if (sessionToken && typeof login === 'function') {
        await login(sessionToken, savedUser || null);
      } else if (newToken) {
        localStorage.setItem('token', newToken);
        axios.defaults.headers.common['Authorization'] =
          `Bearer ${newToken}`;
      }

      if (savedUser) {
        if (typeof setUser === 'function') {
          setUser(savedUser);
        }

        setGoogleUser((prev) => ({
          ...(prev || {}),
          ...savedUser
        }));
      }

      // =================================================
      // 🔹 NUEVO FLUJO SOCIAL
      // =================================================

      setMessage({
        type: 'success',
        text: 'Perfil completado correctamente.'
      });

      // 🔥 mostrar opciones comunidad
      setShowProfileForm(false);

      setShowCommunityOptions(true);

    } catch (error) {

      console.error(error);

      const msg =
        error?.response?.data?.message ||
        'Error guardando perfil';

      setMessage({
        type: 'danger',
        text: msg
      });

    } finally {

      setSubmitting(false);
    }
  };

  // =====================================================
  // 🔹 LOADING
  // =====================================================

  if (checkingProfile) {

    return (

      <Container className="small-container text-center mt-5">

        <Helmet>
          <title>Verificando perfil...</title>
        </Helmet>

        <h2>Verificando perfil...</h2>

      </Container>
    );
  }

  // =====================================================
  // 🔹 LOGIN GOOGLE
  // =====================================================

  if (!googleUser) {

    return (

      <Container className="small-container text-center mt-5">

        <Helmet>
          <title>Login</title>
        </Helmet>

        <h2>Entrar con Google</h2>

        <p>
          COMUVA conecta personas y comunidades reales.
        </p>

        <Button
          size="lg"
          onClick={() =>
            window.location.href =
              `${API_BASE}/api/auth/google`
          }
        >
          Continuar con Google
        </Button>

      </Container>
    );
  }

  // =====================================================
  // 🔹 FORMULARIO PERFIL
  // =====================================================

  if (showProfileForm) {

    return (

      <Container
        className="small-container"
        style={{ maxWidth: '600px' }}
      >

        <Helmet>
          <title>Completar Perfil</title>
        </Helmet>

        <h2 className="my-4">
          👋 Bienvenido a COMUVA
        </h2>

        <p>
          Completa tu perfil básico para continuar.
        </p>

        {message.text && (
          <Alert variant={message.type}>
            {message.text}
          </Alert>
        )}

        <Form onSubmit={handleCompleteProfile}>

          {/* APELLIDO */}

          <Form.Group className="mb-3">

            <Form.Label>
              Apellido
            </Form.Label>

            <Form.Control
              type="text"
              required
              name="apellido"
              value={formData.apellido}
              onChange={handleChange}
              placeholder="Ingresa tu apellido"
            />

          </Form.Group>

          {/* TELÉFONO */}

          <Form.Group className="mb-3">

            <Form.Label>
              Teléfono (opcional)
            </Form.Label>

            <Form.Control
              type="text"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              placeholder="+55 71 9xxxx-xxxx"
            />

          </Form.Group>

          <Button
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? 'Guardando...'
              : 'Continuar'}
          </Button>

        </Form>

      </Container>
    );
  }

  // =====================================================
  // 🔹 NUEVA PANTALLA SOCIAL
  // =====================================================

  if (showCommunityOptions) {

    return (

      <Container style={{ marginTop: '50px' }}>

        <Helmet>
          <title>Bienvenido a COMUVA</title>
        </Helmet>

        <div className="text-center mb-5">

          <h1>
            🌍 Bienvenido a COMUVA
          </h1>

          <p style={{ fontSize: '18px' }}>
            Elige cómo deseas participar
            en la comunidad.
          </p>

        </div>

        <Row>

          {/* ========================================= */}
          {/* 🔹 UNIRSE COMUNIDAD */}
          {/* ========================================= */}

          <Col md={6}>

            <Card
              style={{
                padding: '30px',
                borderRadius: '20px',
                minHeight: '320px',
                boxShadow:
                  '0 0 20px rgba(0,0,0,0.08)',
                border: 'none'
              }}
            >

              <h2>
                🏘️ Unirme a una comunidad
              </h2>

              <p style={{ marginTop: '20px' }}>
                Participa en una comunidad
                existente y comienza a
                ayudar o recibir ayuda.
              </p>

              <Button
                variant="primary"
                style={{ marginTop: 'auto' }}
                onClick={() =>
                  navigate('/seleccionar-comunidad')
                }
              >
                Buscar comunidades
              </Button>

            </Card>

          </Col>

          {/* ========================================= */}
          {/* 🔹 CREAR COMUNIDAD */}
          {/* ========================================= */}

          <Col md={6}>

            <Card
              style={{
                padding: '30px',
                borderRadius: '20px',
                minHeight: '320px',
                boxShadow:
                  '0 0 20px rgba(0,0,0,0.08)',
                border: 'none'
              }}
            >

              <h2>
                🌱 Crear nueva comunidad
              </h2>

              <p style={{ marginTop: '20px' }}>
                Crea una nueva comunidad
                y conviértete en líder
                comunitario.
              </p>

              <div
                style={{
                  marginTop: '20px',
                  fontSize: '14px',
                  color: '#666'
                }}
              >
                🔒 IMPORTANTE:
                <br /><br />

                Crear una comunidad NO
                otorga permisos globales.

                <br /><br />

                El creador recibe rol:
                <strong> admin_basic</strong>

                <br /><br />

                Limitado únicamente
                a su comunidad.
              </div>

              <Button
                variant="success"
                style={{ marginTop: '20px' }}
                onClick={() =>
                  navigate('/crear-comunidad')
                }
              >
                Crear comunidad
              </Button>

            </Card>

          </Col>

        </Row>

      </Container>
    );
  }

  return null;
}

