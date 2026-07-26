import React from 'react';
import { Alert, Button } from 'react-bootstrap';

export default function GoogleAuthStep({
  mode = 'direct',
  message,
  onContinue,
  embedded = false
}) {
  const isInvitation = mode === 'invitation';

  const content = (
    <>
      <h1>{isInvitation ? 'Identifique-se para continuar' : 'Entrar com Google'}</h1>
      <p>
        {isInvitation
          ? 'Continue com Google para confirmar sua identidade e seguir com o convite.'
          : 'COMUVA conecta pessoas e comunidades reais.'}
      </p>
      {message?.text && (
        <Alert variant={message.type || 'info'} aria-live="polite">
          {message.text}
        </Alert>
      )}
      <div className="onboarding-actions onboarding-actions--centered">
        <Button size="lg" onClick={onContinue}>Continuar com Google</Button>
      </div>
    </>
  );

  if (embedded) return content;

  return <div className="onboarding-panel text-center">{content}</div>;
}
