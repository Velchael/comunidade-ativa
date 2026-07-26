import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';
import { UserContext } from '../UserContext';
import {
  clearPendingInvitation,
  savePendingInvitation
} from '../utils/invitationSession';
import GoogleAuthStep from '../components/GoogleAuthStep';
import OnboardingLayout from '../components/OnboardingLayout';
import OnboardingStatusCard from '../components/OnboardingStatusCard';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export default function Convite({
  openExternal = (url) => { window.location.href = url; }
}) {
  const { token: invitationToken } = useParams();
  const navigate = useNavigate();
  const {
    user,
    token: authToken,
    isHydrating,
    refreshAuthSession
  } = useContext(UserContext);

  const invitationPath = `/convite/${encodeURIComponent(invitationToken || '')}`;
  const [validation, setValidation] = useState(null);
  const [validationState, setValidationState] = useState('loading');
  const [validating, setValidating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptanceError, setAcceptanceError] = useState('');
  const [inactiveMembership, setInactiveMembership] = useState(false);
  const [acceptanceOutcome, setAcceptanceOutcome] = useState(null);
  const [refreshingAfterAcceptance, setRefreshingAfterAcceptance] = useState(false);
  const [refreshAfterAcceptanceFailed, setRefreshAfterAcceptanceFailed] = useState(false);
  const mountedRef = useRef(false);
  const currentTokenRef = useRef(invitationToken);
  const validationRequestSequenceRef = useRef(0);
  const latestValidationRequestRef = useRef(0);
  const validationInFlightByTokenRef = useRef(new Map());
  const acceptingRef = useRef(false);
  const acceptanceRequestSequenceRef = useRef(0);
  const activeAcceptanceRef = useRef(null);
  const acceptanceOutcomeContextRef = useRef(null);
  const acceptanceRouteGenerationRef = useRef(0);
  const acceptanceRouteTokenRef = useRef(invitationToken);
  const [validatedToken, setValidatedToken] = useState(null);

  currentTokenRef.current = invitationToken;
  if (acceptanceRouteTokenRef.current !== invitationToken) {
    acceptanceRouteTokenRef.current = invitationToken;
    acceptanceRouteGenerationRef.current += 1;
  }

  const isCurrentAcceptance = useCallback((acceptance) => (
    mountedRef.current &&
    activeAcceptanceRef.current?.requestId === acceptance.requestId &&
    acceptanceRouteGenerationRef.current === acceptance.routeGeneration &&
    currentTokenRef.current === acceptance.token
  ), []);

  const isCurrentAcceptanceContext = useCallback((acceptance) => (
    Boolean(acceptance) &&
    mountedRef.current &&
    acceptanceRouteGenerationRef.current === acceptance.routeGeneration &&
    currentTokenRef.current === acceptance.token &&
    (
      activeAcceptanceRef.current?.requestId === acceptance.requestId ||
      acceptanceOutcomeContextRef.current?.requestId === acceptance.requestId
    )
  ), []);

  const validateInvitation = useCallback(async ({
    preserveTemporaryError = false,
    token = invitationToken
  } = {}) => {
    const capturedToken = token;
    if (validationInFlightByTokenRef.current.has(capturedToken)) return;

    const requestId = validationRequestSequenceRef.current + 1;
    validationRequestSequenceRef.current = requestId;
    latestValidationRequestRef.current = requestId;
    validationInFlightByTokenRef.current.set(capturedToken, requestId);

    if (mountedRef.current && currentTokenRef.current === capturedToken) {
      setValidating(true);
      if (!preserveTemporaryError) setValidationState('loading');
      setAcceptanceError('');
      setInactiveMembership(false);
    }

    try {
      const { data } = await axios.get(
        `${API_BASE}/api/invitaciones/validar/${encodeURIComponent(capturedToken || '')}`
      );

      const mayUpdateCurrentValidation =
        mountedRef.current &&
        currentTokenRef.current === capturedToken &&
        latestValidationRequestRef.current === requestId;

      if (!mayUpdateCurrentValidation) return;

      if (data?.valid !== true) {
        clearPendingInvitation();
        setValidation(null);
        setValidatedToken(null);
        setValidationState('invalid');
        return;
      }

      setValidation(data);
      setValidatedToken(capturedToken);
      setValidationState('valid');
    } catch {
      if (
        mountedRef.current &&
        currentTokenRef.current === capturedToken &&
        latestValidationRequestRef.current === requestId
      ) {
        setValidation(null);
        setValidatedToken(null);
        setValidationState('temporary-error');
      }
    } finally {
      if (validationInFlightByTokenRef.current.get(capturedToken) === requestId) {
        validationInFlightByTokenRef.current.delete(capturedToken);
      }

      if (
        mountedRef.current &&
        currentTokenRef.current === capturedToken &&
        latestValidationRequestRef.current === requestId
      ) {
        setValidating(false);
      }
    }
  }, [invitationToken]);

  useEffect(() => {
    const validationInFlightByToken = validationInFlightByTokenRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      validationRequestSequenceRef.current += 1;
      latestValidationRequestRef.current = validationRequestSequenceRef.current;
      validationInFlightByToken.clear();
      activeAcceptanceRef.current = null;
      acceptanceOutcomeContextRef.current = null;
      acceptingRef.current = false;
    };
  }, []);

  useEffect(() => {
    validationRequestSequenceRef.current += 1;
    latestValidationRequestRef.current = validationRequestSequenceRef.current;
    validationInFlightByTokenRef.current.delete(invitationToken);
    setValidation(null);
    setValidatedToken(null);
    setValidationState('loading');
    setValidating(false);
    setAcceptanceError('');
    setInactiveMembership(false);
    setAcceptanceOutcome(null);
    acceptanceOutcomeContextRef.current = null;
    setRefreshAfterAcceptanceFailed(false);
    validateInvitation({ token: invitationToken });
  }, [invitationToken, validateInvitation]);

  const refreshAcceptedSession = useCallback(async ({
    acceptance,
    navigateAfterRefresh
  }) => {
    if (!isCurrentAcceptanceContext(acceptance)) return;

    setRefreshingAfterAcceptance(true);
    setRefreshAfterAcceptanceFailed(false);

    try {
      const refreshedUser = await refreshAuthSession({ force: true });
      if (!isCurrentAcceptanceContext(acceptance)) return;

      if (!refreshedUser) {
        throw new Error('missing_refreshed_user');
      }

      if (navigateAfterRefresh) {
        navigate('/interacciones', {
          replace: true
        });
      }
    } catch {
      if (isCurrentAcceptanceContext(acceptance)) {
        setRefreshAfterAcceptanceFailed(true);
      }
    } finally {
      if (isCurrentAcceptanceContext(acceptance)) {
        setRefreshingAfterAcceptance(false);
      }
    }
  }, [isCurrentAcceptanceContext, navigate, refreshAuthSession]);

  const handleContinueToAuthentication = () => {
    savePendingInvitation(invitationPath);
    openExternal(`${API_BASE}/api/auth/google`);
  };

  const handleAccept = async () => {
    const acceptanceToken = invitationToken;

    if (
      acceptingRef.current ||
      !authToken ||
      acceptanceToken !== currentTokenRef.current
    ) return;

    if (validation?.valid !== true || validatedToken !== acceptanceToken) {
      validateInvitation({ token: acceptanceToken });
      return;
    }

    const acceptanceRequestId = acceptanceRequestSequenceRef.current + 1;
    acceptanceRequestSequenceRef.current = acceptanceRequestId;
    const acceptance = {
      requestId: acceptanceRequestId,
      token: acceptanceToken,
      routeGeneration: acceptanceRouteGenerationRef.current
    };

    activeAcceptanceRef.current = acceptance;
    acceptanceOutcomeContextRef.current = null;
    acceptingRef.current = true;
    setAccepting(true);
    setAcceptanceError('');
    setInactiveMembership(false);

    try {
      const { data } = await axios.post(
        `${API_BASE}/api/invitaciones/${encodeURIComponent(acceptanceToken || '')}/aceptar`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      if (!isCurrentAcceptance(acceptance)) return;

      if (data?.accepted !== true) {
        throw new Error('unexpected_acceptance_response');
      }

      clearPendingInvitation();
      acceptanceOutcomeContextRef.current = acceptance;

      if (data.already_member === true) {
        setAcceptanceOutcome('already-member');
        await refreshAcceptedSession({ acceptance, navigateAfterRefresh: false });
        return;
      }

      setAcceptanceOutcome('new-member');
      await refreshAcceptedSession({ acceptance, navigateAfterRefresh: false });
    } catch (requestError) {
      if (!isCurrentAcceptance(acceptance)) return;

      const status = requestError.response?.status;
      const reason = requestError.response?.data?.reason;

      if (status === 401) {
        savePendingInvitation(invitationPath);
        navigate('/Seinscrever', { replace: true });
        return;
      }

      if (status === 404 && reason === 'invalid_or_unavailable') {
        clearPendingInvitation();
        setValidation(null);
        setValidationState('invalid');
        return;
      }

      if (status === 409 && reason === 'membership_inactive') {
        clearPendingInvitation();
        setInactiveMembership(true);
        return;
      }

      if (status === 409 && reason === 'already_has_community') {
        clearPendingInvitation();
        setAcceptanceOutcome('already-has-community');
        return;
      }

      setAcceptanceError('Não foi possível aceitar o convite. Tente novamente.');
    } finally {
      if (activeAcceptanceRef.current?.requestId === acceptance.requestId) {
        activeAcceptanceRef.current = null;
        acceptingRef.current = false;
        if (mountedRef.current) {
          setAccepting(false);
        }
      }
    }
  };

  const handleRetryRefresh = () => {
    if (!acceptanceOutcome || refreshingAfterAcceptance || !authToken) return;
    refreshAcceptedSession({
      acceptance: acceptanceOutcomeContextRef.current,
      navigateAfterRefresh: acceptanceOutcome === 'new-member'
    });
  };

  const handleLoginAgain = () => {
    clearPendingInvitation();
    navigate('/Seinscrever');
  };

  const handleCancel = () => {
    clearPendingInvitation();
    navigate('/', { replace: true });
  };

  let content;

  const communityName = validation?.comunidad?.nombre || 'esta comunidade';
  const isAcceptingCurrentInvitation =
    accepting && activeAcceptanceRef.current?.token === invitationToken;
  const isAcceptanceGloballyBlocked = acceptingRef.current;

  if (acceptanceOutcome === 'already-member') {
    content = refreshingAfterAcceptance ? (
      <OnboardingStatusCard status="loading" title="Atualizando sua sessão..." />
    ) : (
      <OnboardingStatusCard
        status="info"
        title="Você já faz parte desta comunidade."
        actions={refreshAfterAcceptanceFailed
          ? [{ label: authToken ? 'Tentar atualizar sessão' : 'Entrar novamente', onClick: authToken ? handleRetryRefresh : handleLoginAgain }]
          : [{ label: 'Ir para a comunidade', onClick: () => navigate('/interacciones', { replace: true }) }]}
      >
        <p>Nenhuma alteração foi necessária.</p>
        {refreshAfterAcceptanceFailed && <p>Não foi possível atualizar sua sessão agora.</p>}
      </OnboardingStatusCard>
    );
  } else if (acceptanceOutcome === 'already-has-community') {
    content = (
      <OnboardingStatusCard
        status="warning"
        title="Sua conta já participa de outra comunidade."
        actions={[{ label: 'Voltar para minha comunidade', onClick: () => navigate('/interacciones', { replace: true }) }]}
      >
        <p>Na versão atual da COMUVA, cada pessoa pode participar de apenas uma comunidade ativa.</p>
        <p>Sua comunidade atual não foi alterada e este convite não foi utilizado.</p>
      </OnboardingStatusCard>
    );
  } else if (acceptanceOutcome === 'new-member') {
    content = refreshingAfterAcceptance ? (
      <OnboardingStatusCard status="loading" title="Atualizando sua sessão..." />
    ) : (
      <OnboardingStatusCard
        status={refreshAfterAcceptanceFailed ? 'warning' : 'success'}
        title="Tudo certo!"
        actions={refreshAfterAcceptanceFailed
          ? [{ label: authToken ? 'Tentar atualizar sessão' : 'Entrar novamente', onClick: authToken ? handleRetryRefresh : handleLoginAgain }]
          : [{ label: 'Ir para a comunidade', onClick: () => navigate('/interacciones', { replace: true }) }]}
      >
        <p>Você agora faz parte de {communityName}.</p>
        {refreshAfterAcceptanceFailed && (
          <p>Sua entrada foi confirmada, mas não foi possível atualizar sua sessão agora.</p>
        )}
      </OnboardingStatusCard>
    );
  }

  else if (validationState === 'loading' || isHydrating) {
    content = (
      <OnboardingStatusCard status="loading" title="Verificando convite..." />
    );
  } else if (validationState === 'invalid') {
    content = (
      <OnboardingStatusCard status="error" title="Este convite não está mais disponível."
        actions={[{ label: 'Voltar para a COMUVA', onClick: handleCancel }]}>
        <p>Ele pode ter expirado, sido cancelado ou já utilizado.</p>
      </OnboardingStatusCard>
    );
  } else if (inactiveMembership) {
    content = (
      <OnboardingStatusCard status="warning" title="Participação inativa"
        actions={[{ label: 'Voltar ao início', onClick: handleCancel }]}>
        <p>Sua participação nesta comunidade está inativa.</p>
        <p>Entre em contato com a administração da comunidade.</p>
      </OnboardingStatusCard>
    );
  } else if (validationState === 'temporary-error') {
    content = (
      <OnboardingStatusCard status="error" title="Não foi possível verificar o convite"
        actions={[
          { label: 'Voltar ao início', variant: 'outline-secondary', onClick: handleCancel },
          { label: validating ? 'Verificando...' : 'Tentar novamente', disabled: validating, onClick: () => validateInvitation({ preserveTemporaryError: true }) }
        ]}>
        <p>Ocorreu um erro temporário. Verifique sua conexão e tente novamente.</p>
      </OnboardingStatusCard>
    );
  } else if (validationState === 'valid' && validation?.valid === true) {
    content = user && authToken ? (
      <div className="onboarding-panel">
        <div className="invitation-eyebrow">Conta confirmada</div>
        <h1>Comunidade:<br />{communityName}</h1>
        <p>Você entrará como membro.</p>
        {acceptanceError && <p className="onboarding-inline-error" aria-live="polite">{acceptanceError}</p>}
        <div className="onboarding-actions">
          <button
            className="btn btn-primary"
            disabled={isAcceptanceGloballyBlocked}
            onClick={handleAccept}
          >
            {isAcceptingCurrentInvitation ? 'Entrando...' : 'Entrar na comunidade'}
          </button>
        </div>
      </div>
    ) : (
      <div className="onboarding-panel invitation-intro">
          <div className="invitation-eyebrow">Você recebeu um convite</div>
          <h1>{communityName}</h1>
          <p>Entre na comunidade para cooperar, compartilhar e participar das atividades da COMUVA.</p>
          <div className="onboarding-actions">
            <button className="btn btn-outline-secondary" onClick={handleCancel}>Agora não</button>
          </div>
          <GoogleAuthStep
            mode="invitation"
            embedded
            onContinue={handleContinueToAuthentication}
          />
      </div>
    );
  }

  const invitationStep = ['new-member', 'already-member'].includes(acceptanceOutcome)
    ? 3
    : 2;

  return (
    <OnboardingLayout step={invitationStep} maxWidth="760px" className="invitation-page">
      <Helmet>
        <title>Convite para comunidade</title>
      </Helmet>
      <div className="invitation-stage-labels" aria-hidden="true">
        <span>Convite recebido</span><span>Identificação</span><span>Entrada na comunidade</span>
      </div>
      {content}
    </OnboardingLayout>
  );
}
