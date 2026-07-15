import React from 'react';
import { Container } from 'react-bootstrap';
import OnboardingStepper from './OnboardingStepper';

export default function OnboardingLayout({
  step,
  children,
  className = '',
  maxWidth = '760px'
}) {
  return (
    <Container
      className={`onboarding-layout ${className}`.trim()}
      style={{ maxWidth }}
    >
      <OnboardingStepper currentStep={step} />
      {children}
    </Container>
  );
}
