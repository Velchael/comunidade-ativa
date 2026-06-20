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
          console.warn('Não foi possível hidratar a sessão inicial com refresh');
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
            console.warn('Não foi possível restaurar a sessão');
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

        console.warn('Não foi possível verificar o perfil');

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
        text: 'Por favor, preencha seu sobrenome.'
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
        text: 'Perfil concluído com sucesso.'
      });

      // 🔥 mostrar opciones comunidad
      setShowProfileForm(false);

      setShowCommunityOptions(true);

    } catch (error) {

      console.error(error);

      const msg =
        error?.response?.data?.message ||
        'Erro ao salvar o perfil';

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

        <h2>Entrar com Google</h2>

        <p>
          COMUVA conecta pessoas e comunidades reais.
        </p>

        <Button
          size="lg"
          onClick={() =>
            window.location.href =
              `${API_BASE}/api/auth/google`
          }
        >
          Continuar com Google
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
          <title>Completar perfil</title>
        </Helmet>

        <h2 className="my-4">
          👋 Bem-vindo ao COMUVA
        </h2>

        <p>
          Complete seu perfil básico para continuar.
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
              Sobrenome
            </Form.Label>

            <Form.Control
              type="text"
              required
              name="apellido"
              value={formData.apellido}
              onChange={handleChange}
              placeholder="Digite seu sobrenome"
            />

          </Form.Group>

          {/* TELÉFONO */}

          <Form.Group className="mb-3">

            <Form.Label>
              Telefone (opcional)
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
              ? 'Salvando...'
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
          <title>Bem-vindo ao COMUVA</title>
        </Helmet>

        <div className="text-center mb-5">

          <h1>
            🌍 Bem-vindo ao COMUVA
          </h1>

          <p style={{ fontSize: '18px' }}>
            Escolha como deseja participar
            da comunidade.
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
                🏘️ Entrar em uma comunidade
              </h2>

              <p style={{ marginTop: '20px' }}>
                Participe de uma comunidade
                existente e comece a
                ajudar ou receber ajuda.
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
                🌱 Criar nova comunidade
              </h2>

              <p style={{ marginTop: '20px' }}>
                Crie uma nova comunidade
                e torne-se líder
                comunitário.
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

                Criar uma comunidade NÃO
                concede permissões globais.

                <br /><br />

                O criador recebe o papel:
                <strong> admin_basic</strong>

                <br /><br />

                Limitado apenas
                à sua comunidade.
              </div>

              <Button
                variant="success"
                style={{ marginTop: '20px' }}
                onClick={() =>
                  navigate('/crear-comunidad')
                }
              >
                Criar comunidade
              </Button>

            </Card>

          </Col>

        </Row>

      </Container>
    );
  }

  return null;
}

