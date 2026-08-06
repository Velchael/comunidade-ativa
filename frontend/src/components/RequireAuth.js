import React, { useContext } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { UserContext } from '../UserContext';

export default function RequireAuth() {
  const { user, token, isHydrating } = useContext(UserContext);
  const location = useLocation();

  if (isHydrating && (!user || !token)) {
    return (
      <div role="status" aria-live="polite">
        Carregando sessão...
      </div>
    );
  }

  if (!user || !token) {
    return (
      <Navigate
        to="/Seinscrever"
        replace
        state={{ from: location }}
      />
    );
  }

  return <Outlet />;
}
