// src/Screens/Seinscrever.js

import React, { useCallback, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Row,
  Col,
  FormCheck
} from 'react-bootstrap';

import { Helmet } from 'react-helmet-async';
import { UserContext } from '../UserContext';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import OnboardingLayout from '../components/OnboardingLayout';
import GoogleAuthStep from '../components/GoogleAuthStep';
import ProfileCompletionForm from '../components/ProfileCompletionForm';
import OnboardingStatusCard from '../components/OnboardingStatusCard';
import { getPendingInvitation } from '../utils/invitationSession';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export default function Seinscrever({ mode = 'direct' }) {

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
  const [startMode, setStartMode] = useState('existente');
  const [pendingInvitation] = useState(() => getPendingInvitation());
  const effectiveMode = mode === 'invitation' || pendingInvitation
    ? 'invitation'
    : 'direct';

  const returnToPendingInvitation = useCallback(() => {
    if (!pendingInvitation) return false;

    navigate(pendingInvitation, { replace: true });
    return true;
  }, [navigate, pendingInvitation]);

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

        // Retira o JWT da query string sem perder o convite da sessão da aba.
        navigate('/Seinscrever', { replace: true });
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

          if (returnToPendingInvitation()) {
            return;
          }

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

  }, [googleUser, navigate, returnToPendingInvitation, setUser]);

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

      if (!returnToPendingInvitation()) {
        setShowCommunityOptions(true);
      }

    } catch (error) {

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

  const handleContinueCommunityChoice = () => {
    if (startMode === 'crear') {
      navigate('/crear-comunidad');
      return;
    }

    navigate('/seleccionar-comunidad');
  };

  // =====================================================
  // 🔹 LOADING
  // =====================================================

  if (checkingProfile) {

    return (

      <OnboardingLayout step={1} className="text-center" maxWidth="600px">

        <Helmet>
          <title>Verificando perfil...</title>
        </Helmet>

        <OnboardingStatusCard status="loading" title="Verificando perfil..." />

      </OnboardingLayout>
    );
  }

  // =====================================================
  // 🔹 LOGIN GOOGLE
  // =====================================================

  if (!googleUser) {

    return (

      <OnboardingLayout step={effectiveMode === 'invitation' ? 2 : 1} maxWidth="600px">

        <Helmet>
          <title>Login</title>
        </Helmet>

        <GoogleAuthStep
          mode={effectiveMode}
          message={message}
          onContinue={() => { window.location.href = `${API_BASE}/api/auth/google`; }}
        />
      </OnboardingLayout>
    );
  }

  // =====================================================
  // 🔹 FORMULARIO PERFIL
  // =====================================================

  if (showProfileForm) {

    return (

      <OnboardingLayout step={effectiveMode === 'invitation' ? 2 : 1} maxWidth="600px">

        <Helmet>
          <title>Completar perfil</title>
        </Helmet>

        <ProfileCompletionForm
          mode={effectiveMode}
          username={googleUser?.username}
          values={formData}
          message={message}
          loading={submitting}
          onChange={handleChange}
          onSubmit={handleCompleteProfile}
        />

      </OnboardingLayout>
    );
  }

  // =====================================================
  // 🔹 NUEVA PANTALLA SOCIAL
  // =====================================================

  if (showCommunityOptions && effectiveMode === 'direct') {

    return (

      <OnboardingLayout step={2} maxWidth="880px">

        <Helmet>
          <title>Bem-vindo ao COMUVA</title>
        </Helmet>

        <div className="onboarding-panel">
          <div className="text-center mb-4">

            <h1>
              Como deseja começar?
            </h1>

            <p>
              Escolha uma opção para configurar sua entrada na COMUVA.
            </p>

          </div>

          <Row className="g-3">

            {/* ========================================= */}
            {/* 🔹 UNIRSE COMUNIDAD */}
            {/* ========================================= */}

            <Col md={6}>

              <Card
                className={`onboarding-choice-card${startMode === 'existente' ? ' is-selected' : ''}`}
                onClick={() => setStartMode('existente')}
              >
                <Card.Body>
                  <FormCheck
                    type="radio"
                    id="start-existing-community"
                    name="startMode"
                    checked={startMode === 'existente'}
                    onChange={() => setStartMode('existente')}
                    label="Entrar em uma comunidade existente"
                  />

                  <p>
                    Encontre sua comunidade e comece a participar.
                  </p>
                </Card.Body>
              </Card>

            </Col>

            {/* ========================================= */}
            {/* 🔹 CREAR COMUNIDAD */}
            {/* ========================================= */}

            <Col md={6}>

              <Card
                className={`onboarding-choice-card${startMode === 'crear' ? ' is-selected' : ''}`}
                onClick={() => setStartMode('crear')}
              >
                <Card.Body>
                  <FormCheck
                    type="radio"
                    id="start-new-community"
                    name="startMode"
                    checked={startMode === 'crear'}
                    onChange={() => setStartMode('crear')}
                    label="Criar uma nova comunidade"
                  />

                  <p>
                    Cadastre uma comunidade e siga como administrador local.
                  </p>
                </Card.Body>
              </Card>

            </Col>

          </Row>

          <div className="onboarding-actions">
            <Button onClick={handleContinueCommunityChoice}>
              Continuar
            </Button>
          </div>
        </div>

      </OnboardingLayout>
    );
  }

  return null;
}

