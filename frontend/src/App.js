import React, { useContext, useState } from 'react';
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
import GruposActivos from './Screens/GruposActivos';
import Interacciones from './Screens/Interacciones';

// Components
import SocialMediaButtons from './components/SocialMediaButtons';

// Context
import { UserProvider, UserContext } from './UserContext';

function Header({ toggleSidebar }) {
  const { user, setUser } = useContext(UserContext);
  const navigate = useNavigate();

  const handleLogin = () => navigate("/Seinscrever");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/");
  };

  const isAdmin =
    user?.rol === "admin_total" ||
    user?.rol === "admin_basic";

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
              {user.comunidadNombre} - Olá: {user.username}

              {isAdmin && (
                <NavDropdown title="⚙️" id="config-dropdown">

                  <NavDropdown.Item
                    as={NavLink}
                    to="/configuracion/panel"
                  >
                    Usuários
                  </NavDropdown.Item>

                  <NavDropdown.Item
                    as={NavLink}
                    to="/configuracion/comunidades"
                  >
                    Comunidade
                  </NavDropdown.Item>

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
                style={{
                  marginRight: "10px",
                  fontSize: "20px",
                  background: "none",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Explorar ☰
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