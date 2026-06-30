import React, { useContext, useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import { BrowserRouter, Route, Routes, NavLink, useNavigate } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { Container, Navbar, NavDropdown, Button, Row, Col } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';

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

// Components
import SocialMediaButtons from './components/SocialMediaButtons';

// Context
import { UserProvider, UserContext } from './UserContext';
import {
  canManageCommunity,
  canViewCommunityMembers,
  isAdminTotalGlobal
} from './utils/permissions';

function Header({ toggleSidebar }) {
  const { user, token, logout, isHydrating, refreshAuthSession } = useContext(UserContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return;
    refreshAuthSession();
  }, [refreshAuthSession, token]);

  const handleLogin = () => navigate("/Seinscrever");

  const handleLogout = () => {
    logout?.();
    navigate("/");
  };
  const isGlobalAdmin = isAdminTotalGlobal(user);
  const canManageLocalCommunity = canManageCommunity(user);
  const canAccessMembersPanel = canViewCommunityMembers(user);
  const userCommunityName = user?.comunidadNombre || 'Sem comunidade';
  const shouldShowConfigMenu =
    !isHydrating &&
    (isGlobalAdmin || canManageLocalCommunity || canAccessMembersPanel);

  return (
    <header>

      {/* Header superior */}

      <Row className="justify-content-between align-items-center mb-2">

        {/* ESQUERDA → LOGO */}

        <Col xs="auto">
          <img
            src={logo_large1}
            alt="logo"
            onClick={() => {
              // toggleSidebar(false);
              navigate("/");
              // window.scrollTo(0, 0);
            }}
            style={{
              height: "50px",
              objectFit: "contain"
            }}
          />
        </Col>

        {/* DIREITA → USUÁRIO */}

        <Col xs="auto">
          {user ? (
            <div
              className="d-flex align-items-center"
              style={{
                gap: "10px",
                fontWeight: "bold"
              }}
            >
              <div className="header-user-summary">
                <span>{userCommunityName} - Olá: {user.username}</span>
                <svg
                  className="header-ecg"
                  viewBox="0 0 360 32"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="
                    M2 20
                    H120
                    L128 20 L133 17 L138 23 L143 20
                    H195
                    L204 20 L212 12 L221 28 L230 20
                    H270
                    L280 20 L292 6 L306 31 L320 20
                    H358
                  "></path>
                </svg>
              </div>

              {shouldShowConfigMenu && (
                <NavDropdown title="⚙️" id="config-dropdown">

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

              <Button
                variant="outline-danger"
                size="sm"
                onClick={handleLogout}
              >
              Sair
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              onClick={handleLogin}
            >
              Entrar
            </Button>
          )}
        </Col>
      </Row>

      {/* Navbar principal */}

      <Navbar className="menu-header">
        <Container>

          <LinkContainer to="/">
            <Navbar.Brand>

              <button
                onClick={toggleSidebar}
                className="sidebar-menu-button"
                aria-label="Abrir menu lateral"
              >
                ☰
              </button>

            </Navbar.Brand>
          </LinkContainer>

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
        </Container>
      </Navbar>

    </header>
  );
}

export default function App() {

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isHome =
    window.location.pathname === "/";

  return (
    <UserProvider>

      <HelmetProvider>

        <BrowserRouter>

          <div className='d-flex flex-column site-container'>

            <Helmet>
              <title>Comunidade Ativa</title>
            </Helmet>

            <Sidebar
              isOpen={sidebarOpen}
              toggle={() => setSidebarOpen(!sidebarOpen)}
            />

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

                <Container className="mt-3">

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
                      element={<Seinscrever />}
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

                </Container>

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

        </BrowserRouter>

      </HelmetProvider>

    </UserProvider>
  );
}
