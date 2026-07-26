import React from 'react';
import { Button, Spinner } from 'react-bootstrap';

const ICONS = {
  loading: '…',
  info: 'i',
  success: '✓',
  warning: '!',
  error: '×'
};

export default function OnboardingStatusCard({
  status = 'info',
  title,
  children,
  actions = []
}) {
  return (
    <div className={`onboarding-panel onboarding-status onboarding-status--${status}`} aria-live="polite">
      <div className="onboarding-status__icon" aria-hidden="true">
        {status === 'loading' ? <Spinner animation="border" size="sm" /> : ICONS[status]}
      </div>
      {title && <h1>{title}</h1>}
      <div className="onboarding-status__content">{children}</div>
      {actions.length > 0 && (
        <div className="onboarding-actions onboarding-actions--centered">
          {actions.map(({ label, onClick, variant = 'primary', disabled = false }) => (
            <Button key={label} variant={variant} onClick={onClick} disabled={disabled}>
              {label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
