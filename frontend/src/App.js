import React, { useContext } from 'react';
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
import Amo from './Screens/Amo';
import TaskList from './Screens/TaskList';
import ConfiguracionPanel from './Screens/ConfiguracionPanel';
import ComunidadesPanel from './Screens/ComunidadesPanel';
import GruposActivos from './Screens/GruposActivos';
//import Dashboard from './Screens/Dashboard';

// Components
import Fidelidade from './components/Fidelidade';
import Redecao from './components/Redecao';
import Conquista from './components/Conquista';
import Identidad from './components/Identidad';
import Productividade from './components/Productividade';
import Proposito from './components/Proposito';
import Consagracao from './components/Consagracao';
import SocialMediaButtons from './components/SocialMediaButtons';

// Context
import { UserProvider, UserContext } from './UserContext';

function Header() {
  const { user, setUser } = useContext(UserContext);
  const navigate = useNavigate();

  const handleLogin = () => navigate("/Seinscrever");
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/");
  };

  const isAdmin = user?.rol === "admin_total" || user?.rol === "admin_basic";

  return (
    <header>
      {/* Header superior */}
      <Row className="justify-content-end mb-2">
        <Col xs="auto">
          {user ? (
            <div className="d-flex align-items-center" style={{ gap: "10px", fontWeight: "bold" }}>
              {user.comunidadNombre} - Olá: {user.username}

              {isAdmin && (
                <NavDropdown title="⚙️" id="config-dropdown">
                  <NavDropdown.Item as={NavLink} to="/configuracion/panel">
                    Usuarios
                  </NavDropdown.Item>
                  <NavDropdown.Item as={NavLink} to="/configuracion/comunidades">
                    Comunidades
                  </NavDropdown.Item>
                </NavDropdown>
              )}

              <Button variant="outline-danger" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          ) : (
            <Button variant="primary" onClick={handleLogin}>
              Login
            </Button>
          )}
        </Col>
      </Row>

      {/* Navbar principal */}
      <Navbar className="menu-header">
        <Container>
          <LinkContainer to="/">
            <Navbar.Brand>
              <img
                src={logo_large1}
                className="App-logo"
                alt="logo"
                style={{ maxWidth: "100%", maxHeight: "100%" }}
              />
            </Navbar.Brand>
          </LinkContainer>

          <div className="menu">
            <span
              style={{
                textDecoration: "none",
                color: "black",
                marginRight: "13px"
              }}
            >
              Comunidade
            </span>

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
              Grupos_Activos
            </NavLink>
          </div>
        </Container>
      </Navbar>
    </header>
  );
}

export default function App() {
  return (
    <UserProvider>
      <HelmetProvider>
        <BrowserRouter>
          <div className='d-flex flex-column site-container'>
            <Helmet>
              <title>Comunidad Activa</title>
            </Helmet>

            <Header />

            <main
              style={{
                backgroundImage: `url(${logo_large1})`,
                backgroundSize: 'contain',
                backgroundPosition: 'center center',
                backgroundRepeat: 'no-repeat',
                backgroundAttachment: 'fixed',
                minHeight: '100vh',
                position: 'relative'
              }}
            >
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                minHeight: '100vh',
                position: 'relative',
                zIndex: 1
              }}>
                <Container className="mt-3">
                  <Routes>
                  <Route path="/" element={<Casapaz />} />
                  <Route path="/Casapaz" element={<Casapaz />}>
                    <Route path="Fidelidade" element={<Fidelidade />} />
                    <Route path="Redecao" element={<Redecao />} />
                    <Route path="Conquista" element={<Conquista />} />
                    <Route path="Identidad" element={<Identidad />} />
                    <Route path="Productividade" element={<Productividade />} />
                    <Route path="Proposito" element={<Proposito />} />
                    <Route path="Consagracao" element={<Consagracao />} />
                  </Route>
                  <Route path="/Amo" element={<Amo />} />
                  <Route path="/Seinscrever" element={<Seinscrever />} />
                  <Route path="/TaskList" element={<TaskList />} />
                  <Route path="/configuracion">
                    <Route path="panel" element={<ConfiguracionPanel />} />
                    <Route path="comunidades" element={<ComunidadesPanel />} />
                  </Route>
                  <Route path="/GruposActivos" element={<GruposActivos />} />
                  
                </Routes>
              </Container>
              </div>
            </main>

            <footer>
              <Container className="text-center">
                <SocialMediaButtons />
                <p>&copy; 2026 Todos os Dereitos Reservados</p>
              </Container>
            </footer>
          </div>
        </BrowserRouter>
      </HelmetProvider>
    </UserProvider>
  );
}
