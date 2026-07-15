import React from 'react';
import { Alert, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import OnboardingLayout from './OnboardingLayout';

export default function OnboardingAccessGuard({
  type,
  step = 3,
  maxWidth = '760px',
  unauthenticatedMessage = 'Você precisa entrar para continuar.'
}) {
  const navigate = useNavigate();
  const isUnauthenticated = type === 'unauthenticated';

  return (
    <OnboardingLayout step={step} maxWidth={maxWidth}>
      <Alert variant={isUnauthenticated ? 'warning' : 'info'}>
        {isUnauthenticated
          ? unauthenticatedMessage
          : 'Seu usuário já tem uma comunidade atribuída.'}
      </Alert>
      <Button
        onClick={() =>
          navigate(isUnauthenticated ? '/Seinscrever' : '/onboarding-confirmacion')
        }
      >
        {isUnauthenticated ? 'Entrar' : 'Continuar'}
      </Button>
    </OnboardingLayout>
  );
}
