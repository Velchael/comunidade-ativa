import React from 'react';

export default function OnboardingStepper({ currentStep = 1 }) {
  const totalSteps = 3;
  const safeStep = Math.min(Math.max(Number(currentStep) || 1, 1), totalSteps);

  return (
    <div className="onboarding-stepper" aria-label={`Passo ${safeStep} de ${totalSteps}`}>
      <div className="onboarding-stepper__label">
        Passo {safeStep} de {totalSteps}
      </div>
      <ol className="onboarding-stepper__track" aria-hidden="true">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const step = index + 1;
          const isComplete = step <= safeStep;

          return (
            <li
              className={`onboarding-stepper__item${isComplete ? ' is-complete' : ''}`}
              key={step}
            >
              <span className="onboarding-stepper__dot" />
              {step < totalSteps && <span className="onboarding-stepper__line" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
