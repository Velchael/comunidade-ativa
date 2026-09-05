import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import { BrowserRouter, Route, Routes, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { Container, Navbar, NavDropdown, Button } from 'react-bootstrap';

import logo_large1 from './logo_large1.png';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';

// Screens
import Casapaz from './Screens/Casapaz';
import Seinscrever from './Screens/Seinscrever';
import TaskList from './Screens/TaskList';
import ConfiguracionPanel from './Screens/ConfiguracionPanel';
import ComunidadesPanel from './Screens/ComunidadesPanel';
import MiembrosComunidadPanel from './Screens/MiembrosComunidadPanel';
import GruposActivos from './Screens/GruposActivos';
import Interacciones from './Screens/Interacciones';
import CrearComunidad from './Screens/CrearComunidad';
import SeleccionarComunidad from './Screens/SeleccionarComunidad';
import OnboardingConfirmacion from './Screens/OnboardingConfirmacion';
import Convite from './Screens/Convite';
import MeuPerfil from './Screens/MeuPerfil';

// Components
import SocialMediaButtons from './components/SocialMediaButtons';
import RequireAuth from './components/RequireAuth';
import UserAvatar from './components/UserAvatar';

// Context
import { UserProvider, UserContext } from './UserContext';
import { PwaInstallProvider } from './PwaInstallContext';
import {
  canManageCommunity,
  canViewCommunityMembers,
  isAdminTotalGlobal
} from './utils/permissions';
import authClient from './services/authClient';

export const formatCommunityDisplayName = (name) => {
  const trimmed = typeof name === 'string' ? name.trim() : '';

  if (!trimmed) return '';

  const hasLetters = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(trimmed);
  const isAllUppercase =
    hasLetters &&
    trimmed === trimmed.toLocaleUpperCase('pt-BR');

  if (!isAllUppercase) {
    return trimmed;
  }

  const lower = trimmed.toLocaleLowerCase('pt-BR');

  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
};

export function Header({ toggleSidebar }) {
  const {
    user,
    token,
    logoutPending,
    retryAuthentication,
    isHydrating,
    refreshAuthSession
  } = useContext(UserContext);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isInvitationRoute = pathname.startsWith('/convite/');
  const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3000";
  const notificationsPanelId = "header-notifications-panel";
  const notificationsIntervalRef = useRef(null);
  const notificationsRef = useRef(null);
  const [notificacoes, setNotificacoes] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");

  useEffect(() => {
    if (!token) return;
    refreshAuthSession();
  }, [refreshAuthSession, token]);

  const carregarNotificacoes = useCallback(async () => {
    if (!user || !token || isHydrating) return;

    try {
      setNotificationsLoading(true);
      setNotificationsError("");

      const response = await authClient.request({
        method: 'get',
        url: `${API_BASE}/api/notificaciones?limit=10`
      });
      const data = response.data;
      setNotificacoes(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(Number.isInteger(data.unread_count) ? data.unread_count : 0);
    } catch (error) {
      console.error("Erro ao carregar notificações", error);
      setNotificationsError("Não foi possível carregar notificações.");
    } finally {
      setNotificationsLoading(false);
    }
  }, [API_BASE, isHydrating, token, user]);

  useEffect(() => {
    if (!user || !token || isHydrating) {
      setNotificacoes([]);
      setUnreadCount(0);
      setNotificationsOpen(false);
      return undefined;
    }

    carregarNotificacoes();

    const stopPolling = () => {
      if (notificationsIntervalRef.current !== null) {
        window.clearInterval(notificationsIntervalRef.current);
        notificationsIntervalRef.current = null;
      }
    };

    const startPolling = () => {
      if (
        document.visibilityState !== "visible" ||
        notificationsIntervalRef.current !== null
      ) {
        return;
      }

      notificationsIntervalRef.current = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          carregarNotificacoes();
        }
      }, 30000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        carregarNotificacoes();
        startPolling();
        return;
      }

      stopPolling();
    };

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        carregarNotificacoes();
        startPolling();
      }
    };

    startPolling();

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [carregarNotificacoes, isHydrating, token, user]);

  useEffect(() => {
    setNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!notificationsOpen) return undefined;

    const handlePointerDown = (event) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target)
      ) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [notificationsOpen]);

  const getNotificationText = (notification) => {
    if (notification?.tipo === "respuesta_interaccion") {
      const username = notification.actor?.username;
      return `💬 ${username || "Alguém"} respondeu à sua publicação`;
    }

    return "💬 Nova notificação";
  };

  const formatNotificationTime = (value) => {
    const createdAt = new Date(value);

    if (Number.isNaN(createdAt.getTime())) {
      return "";
    }

    const diffMs = Date.now() - createdAt.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMinutes < 1) return "agora";
    if (diffMinutes < 60) return `há ${diffMinutes} min`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `há ${diffHours} h`;
    if (diffHours < 48) return "ontem";

    return createdAt.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const handleNotificationsToggle = () => {
    setNotificationsOpen((prev) => {
      const nextOpen = !prev;
      if (nextOpen) {
        carregarNotificacoes();
      }
      return nextOpen;
    });
  };

  const handleNotificationClick = async (notification) => {
    if (!notification?.id || !notification?.interaccion_id) return;

    if (!notification.leida) {
      try {
        setNotificationsError("");

        await authClient.request({
          method: 'patch',
          url: `${API_BASE}/api/notificaciones/${notification.id}/leida`
        });

        setNotificacoes((prev) =>
          prev.map((item) =>
            item.id === notification.id
              ? { ...item, leida: true }
              : item
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error("Erro ao marcar notificação como lida", error);
      }
    }

    setNotificationsOpen(false);
    navigate(`/interacciones?interaccionId=${notification.interaccion_id}`);
  };

  const handleLogin = () => navigate("/Seinscrever");

  const isGlobalAdmin = isAdminTotalGlobal(user);
  const canManageLocalCommunity = canManageCommunity(user);
  const canAccessMembersPanel = canViewCommunityMembers(user);
  const rawCommunityName =
    typeof user?.comunidadNombre === 'string'
      ? user.comunidadNombre.trim()
      : '';
  const communityDisplayName = formatCommunityDisplayName(rawCommunityName);
  const hasCommunityName = Boolean(rawCommunityName);
  const userDisplayName = user?.username || user?.email || 'Usuário';
  const firstName =
    typeof userDisplayName === 'string'
      ? userDisplayName.trim().split(/\s+/)[0]
      : '';
  const shouldShowConfigMenu =
    !isHydrating &&
    (isGlobalAdmin || canManageLocalCommunity || canAccessMembersPanel);

  if (isInvitationRoute) {
    return (
      <header className="invitation-header">
        <img
          src={logo_large1}
          alt="COMUVA"
          className="invitation-header__logo"
        />
      </header>
    );
  }

  return (
    <header className="community-header">

      {logoutPending && (
        <div className="alert alert-warning m-2" role="alert">
          Sua saída local foi concluída, mas o logout remoto não foi confirmado.{' '}
          <Button size="sm" variant="outline-dark" onClick={retryAuthentication}>
            Tentar novamente
          </Button>
        </div>
      )}

      {hasCommunityName && (
        <div className="community-header-title-row">
          <div
            className="community-header-title"
            title={communityDisplayName}
            aria-label={`Comunidade atual: ${communityDisplayName}`}
          >
            {communityDisplayName}
          </div>
        </div>
      )}

      <div className="community-header-controls-row">
        <div className="community-header-brand-menu">
          <img
            src={logo_large1}
            alt="COMUVA"
            className="header-logo"
            onClick={() => {
              // toggleSidebar(false);
              navigate("/");
              // window.scrollTo(0, 0);
            }}
          />

          <button
            onClick={toggleSidebar}
            className="sidebar-menu-button"
            aria-label="Abrir menu lateral"
          >
            ☰
          </button>
        </div>

        <Navbar className="menu-header community-header-nav">
          <div className="menu">

            <NavLink
              to="/interacciones"
              style={({ isActive }) => ({
                textDecoration: "none",
                color: isActive ? "white" : "black",
                marginRight: "13px"
              })}
            >
              Interações
            </NavLink>

            <NavLink
              to="/TaskList"
              style={({ isActive }) => ({
                textDecoration: "none",
                color: isActive ? "white" : "black",
                marginRight: "13px"
              })}
            >
              Agenda
            </NavLink>

            <NavLink
              to="/GruposActivos"
              style={({ isActive }) => ({
                textDecoration: "none",
                color: isActive ? "white" : "black",
                marginRight: "13px"
              })}
            >
              Grupos
            </NavLink>

          </div>
        </Navbar>

        <div className="community-header-user-actions">
          {user ? (
            <div className="header-session">
              <div className="header-user-summary">
                <span
                  className="header-user-greeting"
                  title={userDisplayName}
                  aria-label={`Olá, ${userDisplayName}`}
                >
                  <UserAvatar
                    src={user.foto_perfil}
                    name={userDisplayName}
                    size="publication"
                    className="header-user-avatar"
                  />
                  <span className="header-user-greeting-text">
                    <span className="header-user-name-full" aria-hidden="true">
                      Olá, {userDisplayName}
                    </span>
                    <span className="header-user-name-mobile" aria-hidden="true">
                      {firstName}
                    </span>
                  </span>
                </span>
              </div>

              <div className="header-actions">
                <div className="notifications-menu" ref={notificationsRef}>
                  <button
                    type="button"
                    className="notifications-button"
                    aria-label="Abrir notificações"
                    aria-expanded={notificationsOpen}
                    aria-controls={notificationsPanelId}
                    onClick={handleNotificationsToggle}
                  >
                    <span aria-hidden="true">🔔</span>
                    {unreadCount > 0 && (
                      <span className="notifications-badge">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {notificationsOpen && (
                    <div
                      id={notificationsPanelId}
                      className="notifications-panel"
                      role="region"
                      aria-label="Notificações"
                    >
                      <div className="notifications-panel__header">
                        <strong>Notificações</strong>
                        {notificationsLoading && (
                          <span>Carregando...</span>
                        )}
                      </div>

                      {notificationsError && (
                        <div className="notifications-panel__error">
                          {notificationsError}
                        </div>
                      )}

                      {!notificationsLoading && notificacoes.length === 0 && (
                        <div className="notifications-panel__empty">
                          Sem notificações recentes.
                        </div>
                      )}

                      {notificacoes.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          className={`notification-item ${notification.leida ? "" : "is-unread"}`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <span className="notification-item__text">
                            {getNotificationText(notification)}
                          </span>
                          <span className="notification-item__time">
                            {formatNotificationTime(notification.created_at)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {shouldShowConfigMenu && (
                  <NavDropdown title="⚙" id="config-dropdown">

                    {isGlobalAdmin && (
                      <NavDropdown.Item
                        as={NavLink}
                        to="/configuracion/panel"
                      >
                        Usuários
                      </NavDropdown.Item>
                    )}

                    {canManageLocalCommunity && (
                      <NavDropdown.Item
                        as={NavLink}
                        to="/configuracion/comunidades"
                      >
                        Comunidade
                      </NavDropdown.Item>
                    )}

                    {canAccessMembersPanel && (user?.comunidadId || user?.comunidad_id) && (
                      <NavDropdown.Item
                        as={NavLink}
                        to={`/configuracion/comunidades/${user?.comunidadId || user?.comunidad_id}/miembros`}
                      >
                        Membros
                      </NavDropdown.Item>
                    )}

                  </NavDropdown>
                )}

              </div>
            </div>
          ) : (
            <Button
              variant="primary"
              onClick={handleLogin}
            >
              Entrar
            </Button>
          )}
        </div>
      </div>

    </header>
  );
}

function AppRoutes() {
  const { pathname } = useLocation();
  const isOnboardingRoute =
    [
      '/Seinscrever',
      '/crear-comunidad',
      '/seleccionar-comunidad',
      '/onboarding-confirmacion'
    ].includes(pathname) || pathname.startsWith('/convite/');

  const routes = (
    <Routes>

      <Route
        path="/"
        element={<Casapaz />}
      />

      <Route
        path="/Casapaz"
        element={<Casapaz />}
      />

      <Route
        path="/Seinscrever"
        element={<Seinscrever mode="direct" />}
      />

      <Route
        path="/convite/:token"
        element={<Convite />}
      />

      <Route
        path="/crear-comunidad"
        element={<CrearComunidad />}
      />

      <Route
        path="/seleccionar-comunidad"
        element={<SeleccionarComunidad />}
      />

      <Route
        path="/onboarding-confirmacion"
        element={<OnboardingConfirmacion />}
      />

      <Route element={<RequireAuth />}>
        <Route path="/meu-perfil" element={<MeuPerfil />} />
      </Route>

      <Route
        path="/TaskList"
        element={<TaskList />}
      />

      <Route path="/configuracion">

        <Route
          path="panel"
          element={<ConfiguracionPanel />}
        />

        <Route
          path="comunidades"
          element={<ComunidadesPanel />}
        />

        <Route
          path="comunidades/:id/miembros"
          element={<MiembrosComunidadPanel />}
        />

      </Route>

      <Route
        path="/GruposActivos"
        element={<GruposActivos />}
      />

      <Route
        path="/interacciones"
        element={<Interacciones />}
      />

    </Routes>
  );

  if (isOnboardingRoute) {
    return routes;
  }

  return (
    <Container className="mt-3">
      {routes}
    </Container>
  );
}

export default function App() {

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <UserProvider>

      <HelmetProvider>

        <PwaInstallProvider>

          <BrowserRouter>

            <AppLayout
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
            />

          </BrowserRouter>

        </PwaInstallProvider>

      </HelmetProvider>

    </UserProvider>
  );
}

function AppLayout({ sidebarOpen, setSidebarOpen }) {
  const { pathname } = useLocation();
  const isInvitationRoute = pathname.startsWith('/convite/');
  const isHome = pathname === "/";

  return (

          <div className='d-flex flex-column site-container'>

            <Helmet>
              <title>Comunidade Ativa</title>
            </Helmet>

            {!isInvitationRoute && (
              <Sidebar
                isOpen={sidebarOpen}
                toggle={() => setSidebarOpen(!sidebarOpen)}
              />
            )}

            <Header
              toggleSidebar={() =>
                setSidebarOpen(!sidebarOpen)
              }
            />

            <main
              style={{
                // backgroundImage: `url(${logo_large1})`,
                backgroundImage: isHome
                  ? `url(${logo_large1})`
                  : "none",

                backgroundSize: 'contain',
                backgroundPosition: 'center center',
                backgroundRepeat: 'no-repeat',
                minHeight: '100vh',
                position: 'relative'
              }}
            >

              <div
                style={{
                  backgroundColor: 'rgba(255,255,255,0.90)',
                  minHeight: '100vh',
                  position: 'relative',
                  zIndex: 1
                }}
              >
                <AppRoutes />

              </div>

            </main>

            <footer>
              <Container className="text-center">

                <SocialMediaButtons />

                <p>
                  &copy; 2026 Todos os Direitos Reservados
                </p>

              </Container>
            </footer>

          </div>
  );
}
