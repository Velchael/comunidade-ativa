import React, { useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';
import UserAvatar from '../components/UserAvatar';

const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:3000') + '/api';
const NOT_INFORMED = 'Não informado';

const displayValue = (value) => {
  if (value === null || value === undefined) return NOT_INFORMED;

  const normalizedValue = String(value).trim();
  return normalizedValue || NOT_INFORMED;
};

const formatDate = (value) => {
  if (!value) return NOT_INFORMED;

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : displayValue(value);
};

const ROLE_LABELS = {
  admin_total: 'Administrador total',
  admin_basic: 'Administrador da comunidade',
  moderador: 'Moderador',
  miembro: 'Membro'
};

export default function MeuPerfil() {
  const { token } = useContext(UserContext);
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const loadProfile = useCallback(async (signal) => {
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await axios.get(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal
      });

      setProfile(response.data);
      setStatus('success');
    } catch (error) {
      if (error.code === 'ERR_CANCELED') return;

      setProfile(null);
      setErrorMessage(error.response?.data?.message || '');

      if (error.response?.status === 401) {
        setStatus('unauthorized');
      } else if (error.response?.status === 404) {
        setStatus('not-found');
      } else {
        setStatus('error');
      }
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    loadProfile(controller.signal);

    return () => controller.abort();
  }, [loadProfile]);

  if (status === 'loading') {
    return (
      <section className="meu-perfil meu-perfil--state" role="status" aria-live="polite">
        <div className="meu-perfil__spinner" aria-hidden="true" />
        <p className="meu-perfil__state-text">Carregando perfil...</p>
      </section>
    );
  }

  if (status === 'unauthorized') {
    return (
      <section className="meu-perfil meu-perfil--state" role="alert">
        <h1>Sessão expirada</h1>
        <p className="meu-perfil__state-text">Entre novamente para acessar seu perfil.</p>
        <Button type="button" onClick={() => navigate('/Seinscrever')}>
          Entrar novamente
        </Button>
      </section>
    );
  }

  if (status === 'not-found') {
    return (
      <section className="meu-perfil meu-perfil--state" role="alert">
        <h1>Perfil não encontrado</h1>
        <p className="meu-perfil__state-text">{errorMessage || 'Não foi possível localizar seu perfil.'}</p>
        <Button type="button" onClick={() => loadProfile()}>
          Tentar novamente
        </Button>
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className="meu-perfil meu-perfil--state" role="alert">
        <h1>Não foi possível carregar o perfil</h1>
        <p className="meu-perfil__state-text">{errorMessage || 'Verifique sua conexão e tente novamente.'}</p>
        <Button type="button" onClick={() => loadProfile()}>
          Tentar novamente
        </Button>
      </section>
    );
  }

  const avatarName = [profile.username, profile.apellido]
    .filter(Boolean)
    .join(' ') || profile.email;

  const fields = [
    ['Nome', displayValue(profile.username)],
    ['Sobrenome', displayValue(profile.apellido)],
    ['Email', displayValue(profile.email)],
    ['Data de nascimento', formatDate(profile.fecha_nacimiento)],
    ['Telefone', displayValue(profile.telefono)],
    ['Endereço', displayValue(profile.direccion)],
    ['Comunidade', displayValue(profile.comunidad?.nombre)]
  ];

  if (profile.rol_comunidad) {
    fields.push([
      'Papel na comunidade',
      ROLE_LABELS[profile.rol_comunidad] || displayValue(profile.rol_comunidad)
    ]);
  }

  return (
    <section className="meu-perfil" aria-labelledby="meu-perfil-title">
      <header className="meu-perfil__header">
        <UserAvatar
          src={profile.foto_perfil}
          name={avatarName}
          size="profile"
        />
        <div className="meu-perfil__heading">
          <p className="meu-perfil__eyebrow">Conta pessoal</p>
          <h1 id="meu-perfil-title">Meu Perfil</h1>
          <p>Seus dados cadastrados na Comunidade Ativa.</p>
        </div>
      </header>

      <dl className="meu-perfil__data">
        {fields.map(([label, value]) => (
          <div className="meu-perfil__field" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
