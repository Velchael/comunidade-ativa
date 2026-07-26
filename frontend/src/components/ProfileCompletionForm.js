import React from 'react';
import { Alert, Button, Form } from 'react-bootstrap';

export default function ProfileCompletionForm({
  mode = 'direct',
  username,
  values,
  message,
  loading = false,
  onChange,
  onSubmit
}) {
  const isInvitation = mode === 'invitation';

  return (
    <div className="onboarding-panel">
      <h1>{username ? `Bem-vindo, ${username}` : 'Bem-vindo ao COMUVA'}</h1>
      <p>
        {isInvitation
          ? 'Complete seus dados básicos para voltar ao convite e confirmar sua entrada.'
          : 'Complete seus dados básicos para continuar com segurança.'}
      </p>
      {message?.text && (
        <Alert variant={message.type || 'info'} aria-live="polite">{message.text}</Alert>
      )}
      <Form onSubmit={onSubmit}>
        <Form.Group className="mb-3" controlId="profile-apellido">
          <Form.Label>Sobrenome <span className="text-danger">*</span></Form.Label>
          <Form.Control
            type="text"
            required
            name="apellido"
            value={values.apellido}
            onChange={onChange}
            placeholder="Digite seu sobrenome"
          />
        </Form.Group>
        <Form.Group className="mb-3" controlId="profile-telefono">
          <Form.Label>Telefone</Form.Label>
          <Form.Control
            type="tel"
            name="telefono"
            value={values.telefono}
            onChange={onChange}
            placeholder="+55 71 9xxxx-xxxx"
          />
        </Form.Group>
        <div className="onboarding-actions">
          <Button type="submit" disabled={loading}>
            {loading ? 'Salvando...' : isInvitation ? 'Salvar e voltar ao convite' : 'Continuar'}
          </Button>
        </div>
      </Form>
    </div>
  );
}
