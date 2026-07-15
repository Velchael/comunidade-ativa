import React, { useContext, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import { Helmet } from 'react-helmet-async';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';
import OnboardingLayout from '../components/OnboardingLayout';
import { hasAssignedCommunity } from '../utils/onboardingSession';

export default function OnboardingConfirmacion() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isHydrating } = useContext(UserContext);
  const completedUser = location.state?.completedUser;
  const confirmedUser = hasAssignedCommunity(user)
    ? user
    : location.state?.onboardingCompleted && hasAssignedCommunity(completedUser)
      ? completedUser
      : null;

  useEffect(() => {
    if (!isHydrating && !confirmedUser) {
      navigate('/Seinscrever', { replace: true });
    }
  }, [confirmedUser, isHydrating, navigate]);

  if (isHydrating || !confirmedUser) {
    return (
      <OnboardingLayout step={3} className="text-center" maxWidth="640px">
        <Helmet>
          <title>Verificando comunidade</title>
        </Helmet>
        <div className="onboarding-panel">
          <h1>Verificando comunidade...</h1>
        </div>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout step={3} className="text-center" maxWidth="640px">
      <Helmet>
        <title>Bem-vindo à COMUVA</title>
      </Helmet>

      <div className="onboarding-panel onboarding-confirmation">
        <h1>🎉 Bem-vindo à COMUVA</h1>
        <p>Sua comunidade está pronta.</p>
        <Button onClick={() => navigate('/interacciones')}>
          Entrar
        </Button>
      </div>
    </OnboardingLayout>
  );
}
