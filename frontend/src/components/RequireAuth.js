import React, { useContext } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { UserContext } from '../UserContext';

export default function RequireAuth() {
  const { authStatus, logoutPending, retryAuthentication } = useContext(UserContext);
  const location = useLocation();

  if (authStatus === 'hydrating') {
    return (
      <div role="status" aria-live="polite">
        Carregando sessão...
      </div>
    );
  }

  if (authStatus === 'temporarilyUnavailable') {
    return (
      <div role="alert" aria-live="polite">
        <p>Não foi possível restaurar sua sessão agora.</p>
        <button type="button" onClick={retryAuthentication}>Tentar novamente</button>
      </div>
    );
  }

  if (authStatus === 'unauthenticated' && logoutPending) {
    return (
      <div role="alert" aria-live="polite">
        <p>Sua saída local foi concluída, mas o logout remoto não foi confirmado.</p>
        <button type="button" onClick={retryAuthentication}>Tentar logout novamente</button>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <Navigate
        to="/Seinscrever"
        replace
        state={{ from: location }}
      />
    );
  }

  return authStatus === 'authenticated' ? <Outlet /> : null;
}
