import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Button, Form } from 'react-bootstrap';
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

const createProfileDraft = (profile) => ({
  username: profile.username ?? '',
  apellido: profile.apellido ?? '',
  fecha_nacimiento: profile.fecha_nacimiento ?? '',
  telefono: profile.telefono ?? '',
  direccion: profile.direccion ?? ''
});

const getLocalToday = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const validateDraft = (draft) => {
  const errors = {};

  if (draft.apellido.length > 255) {
    errors.apellido = 'O sobrenome deve ter no máximo 255 caracteres.';
  }

  if (draft.telefono.length > 30) {
    errors.telefono = 'O telefone deve ter no máximo 30 caracteres.';
  }

  if (draft.direccion.length > 255) {
    errors.direccion = 'O endereço deve ter no máximo 255 caracteres.';
  }

  if (draft.fecha_nacimiento && draft.fecha_nacimiento > getLocalToday()) {
    errors.fecha_nacimiento = 'A data de nascimento não pode ser futura.';
  }

  return errors;
};

const PROFILE_EDITABLE_FIELDS = [
  'username',
  'apellido',
  'fecha_nacimiento',
  'telefono',
  'direccion'
];

const getBackendFieldErrors = (data) => {
  const backendErrors = data?.fieldErrors || data?.errors;
  const errors = {};

  if (backendErrors && !Array.isArray(backendErrors) && typeof backendErrors === 'object') {
    PROFILE_EDITABLE_FIELDS.forEach((field) => {
      if (typeof backendErrors[field] === 'string' && backendErrors[field]) {
        errors[field] = backendErrors[field];
      }
    });
  }

  if (Array.isArray(backendErrors)) {
    backendErrors.forEach((error) => {
      if (
        PROFILE_EDITABLE_FIELDS.includes(error?.field)
        && typeof error?.message === 'string'
        && error.message
      ) {
        errors[error.field] = error.message;
      }
    });
  }

  return errors;
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
  const profileRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const isEditingRef = useRef(false);
  const [draft, setDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleEdit = () => {
    setDraft(createProfileDraft(profile));
    setFieldErrors({});
    setSaveError('');
    setSuccessMessage('');
    isEditingRef.current = true;
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraft(null);
    setFieldErrors({});
    setSaveError('');
    isEditingRef.current = false;
    setIsEditing(false);
  };

  const handleChange = ({ target: { name, value } }) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [name]: value
    }));
    setFieldErrors((currentErrors) => {
      if (!currentErrors[name]) return currentErrors;

      const nextErrors = { ...currentErrors };
      delete nextErrors[name];
      return nextErrors;
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextFieldErrors = validateDraft(draft);
    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length > 0) {
      setSuccessMessage('');
      setSaveError('');
      return;
    }

    if (isSaving) return;

    const payload = {
      username: draft.username,
      apellido: draft.apellido,
      fecha_nacimiento: draft.fecha_nacimiento,
      telefono: draft.telefono,
      direccion: draft.direccion
    };

    setIsSaving(true);
    setSaveError('');
    setSuccessMessage('');

    axios.patch(`${API_BASE}/users/me`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    }).then((response) => {
      setProfile(response.data);
      setDraft(null);
      setFieldErrors({});
      setSaveError('');
      setSuccessMessage('Perfil atualizado com sucesso.');
      isEditingRef.current = false;
      setIsEditing(false);
    }).catch((error) => {
      const backendFieldErrors = getBackendFieldErrors(error.response?.data);
      if (Object.keys(backendFieldErrors).length > 0) {
        setFieldErrors(backendFieldErrors);
      }
      setSaveError(
        error.response?.data?.message
        || 'Não foi possível atualizar o perfil. Tente novamente.'
      );
    }).finally(() => {
      setIsSaving(false);
    });
  };

  const loadProfile = useCallback(async (signal) => {
    const isInitialLoad = profileRef.current === null;

    if (isInitialLoad) {
      setStatus('loading');
    }
    setErrorMessage('');

    try {
      const response = await axios.get(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal
      });

      profileRef.current = response.data;
      setProfile(response.data);
      setStatus('success');
    } catch (error) {
      if (error.code === 'ERR_CANCELED') return;

      if (!isInitialLoad && isEditingRef.current) return;

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

  const readOnlyFields = [
    ['Email', displayValue(profile.email)],
    ['Comunidade', displayValue(profile.comunidad?.nombre)]
  ];

  if (profile.rol_comunidad) {
    readOnlyFields.push([
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

      <div className="meu-perfil__messages" aria-live="polite" aria-atomic="true">
        {successMessage && (
          <div className="meu-perfil__message meu-perfil__message--success">
            {successMessage}
          </div>
        )}
        {saveError && (
          <div className="meu-perfil__message meu-perfil__message--error" role="alert">
            {saveError}
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="meu-perfil__editor" aria-labelledby="meu-perfil-edit-title">
          <h2 id="meu-perfil-edit-title">Edição do perfil</h2>
          <dl className="meu-perfil__data meu-perfil__readonly">
            {readOnlyFields.map(([label, value]) => (
              <div className="meu-perfil__field" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <Form className="meu-perfil__form" onSubmit={handleSubmit}>
            <div className="meu-perfil__row">
              <Form.Group controlId="meu-perfil-username">
                <Form.Label>Nome</Form.Label>
                <Form.Control
                  type="text"
                  name="username"
                  value={draft.username}
                  onChange={handleChange}
                  disabled={isSaving}
                  isInvalid={Boolean(fieldErrors.username)}
                  aria-invalid={Boolean(fieldErrors.username)}
                  aria-describedby={fieldErrors.username ? 'meu-perfil-username-error' : undefined}
                />
                <Form.Control.Feedback type="invalid" id="meu-perfil-username-error">
                  {fieldErrors.username}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group controlId="meu-perfil-apellido">
                <Form.Label>Sobrenome</Form.Label>
                <Form.Control
                  type="text"
                  name="apellido"
                  value={draft.apellido}
                  onChange={handleChange}
                  disabled={isSaving}
                  maxLength={255}
                  isInvalid={Boolean(fieldErrors.apellido)}
                  aria-invalid={Boolean(fieldErrors.apellido)}
                  aria-describedby={fieldErrors.apellido ? 'meu-perfil-apellido-error' : undefined}
                />
                <Form.Control.Feedback type="invalid" id="meu-perfil-apellido-error">
                  {fieldErrors.apellido}
                </Form.Control.Feedback>
              </Form.Group>
            </div>

            <div className="meu-perfil__row">
              <Form.Group controlId="meu-perfil-fecha-nacimiento">
                <Form.Label>Data de nascimento</Form.Label>
                <Form.Control
                  type="date"
                  name="fecha_nacimiento"
                  value={draft.fecha_nacimiento}
                  onChange={handleChange}
                  disabled={isSaving}
                  max={getLocalToday()}
                  isInvalid={Boolean(fieldErrors.fecha_nacimiento)}
                  aria-invalid={Boolean(fieldErrors.fecha_nacimiento)}
                  aria-describedby={fieldErrors.fecha_nacimiento ? 'meu-perfil-fecha-nascimento-error' : undefined}
                />
                <Form.Control.Feedback type="invalid" id="meu-perfil-fecha-nascimento-error">
                  {fieldErrors.fecha_nacimiento}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group controlId="meu-perfil-telefono">
                <Form.Label>Telefone</Form.Label>
                <Form.Control
                  type="tel"
                  name="telefono"
                  value={draft.telefono}
                  onChange={handleChange}
                  disabled={isSaving}
                  maxLength={30}
                  isInvalid={Boolean(fieldErrors.telefono)}
                  aria-invalid={Boolean(fieldErrors.telefono)}
                  aria-describedby={fieldErrors.telefono ? 'meu-perfil-telefono-error' : undefined}
                />
                <Form.Control.Feedback type="invalid" id="meu-perfil-telefono-error">
                  {fieldErrors.telefono}
                </Form.Control.Feedback>
              </Form.Group>
            </div>

            <Form.Group className="meu-perfil__textarea" controlId="meu-perfil-direccion">
              <Form.Label>Endereço</Form.Label>
              <Form.Control
                as="textarea"
                name="direccion"
                value={draft.direccion}
                onChange={handleChange}
                disabled={isSaving}
                maxLength={255}
                isInvalid={Boolean(fieldErrors.direccion)}
                aria-invalid={Boolean(fieldErrors.direccion)}
                aria-describedby={fieldErrors.direccion ? 'meu-perfil-direccion-error' : undefined}
              />
              <Form.Control.Feedback type="invalid" id="meu-perfil-direccion-error">
                {fieldErrors.direccion}
              </Form.Control.Feedback>
            </Form.Group>

            <div className="meu-perfil__actions">
              <Button type="submit" disabled={isSaving}>
                Salvar
              </Button>
              <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSaving}>
                Cancelar
              </Button>
            </div>
          </Form>
        </div>
      ) : (
        <>
          <dl className="meu-perfil__data">
            {fields.map(([label, value]) => (
              <div className="meu-perfil__field" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="meu-perfil__actions meu-perfil__actions--reading">
            <Button type="button" onClick={handleEdit}>
              Editar
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
