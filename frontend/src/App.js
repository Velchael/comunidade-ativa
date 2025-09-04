import React, { useContext } from 'react';
import { BrowserRouter, Route, Routes, NavLink, useNavigate } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { Container, Navbar, NavDropdown, Button, Row, Col } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';

import logo_large1 from './logo_large1.png';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css'; // CSS personalizado

// Screens
import Casapaz from './Screens/Casapaz';
import Seinscrever from './Screens/Seinscrever';
import Amo from './Screens/Amo';
import TaskList from './Screens/TaskList';
import ConfiguracionPanel from './Screens/ConfiguracionPanel';
import ComunidadesPanel from './Screens/ComunidadesPanel';
import GruposActivos from './Screens/GruposActivos';

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

  const handleLogin = () => {
    navigate("/Seinscrever"); // va al login con Google
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/");
  };

  return (
    <header>
      <Row className="justify-content-end">
        <Col xs="auto">
          {user ? (
            <span className="text-muted" style={{ fontWeight: "bold" }}>
              Somos {user.comunidadNombre} - Bienvenido: {user.username}{" "}
              <Button
                variant="outline-danger"
                size="sm"
                onClick={handleLogout}
                style={{ marginLeft: "10px" }}
              >
                Logout
              </Button>
            </span>
          ) : (
            <Button variant="primary" onClick={handleLogin}>
              Login
            </Button>
          )}
        </Col>
      </Row>

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
            <NavLink to="/Casapaz" style={({ isActive }) => ({
              textDecoration: "none",
              color: isActive ? "white" : "black",
              marginRight: "13px"
            })}>
              Casapaz
            </NavLink>

            <NavLink to="/Amo" style={({ isActive }) => ({
              textDecoration: "none",
              color: isActive ? "white" : "black",
              marginRight: "13px"
            })}>
              A.M.O
            </NavLink>

            {/* 🔴 Eliminamos el NavLink a Registro/Seinscrever */}
            
            <NavLink to="/TaskList" style={({ isActive }) => ({
              textDecoration: "none",
              color: isActive ? "white" : "black",
              marginRight: "13px"
            })}>
              Agenda
            </NavLink>

           <NavDropdown
              title="Configuração"
              id="configuracion-dropdown"
              className="custom-dropdown"
            >
              <NavDropdown.Item as={NavLink} to="/configuracion/panel">
                ⚙️ Usuarios
              </NavDropdown.Item>
              <NavDropdown.Item as={NavLink} to="/configuracion/comunidades">
                🏘️ Comunidades
              </NavDropdown.Item>
            </NavDropdown>


            <NavLink to="/GruposActivos" style={({ isActive }) => ({
              textDecoration: "none",
              color: isActive ? "white" : "black",
              marginRight: "13px",
              marginLeft: "13px"   // 👈 esto lo mueve a la derecha
            })}>
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
            <title>Comunidad Ativa</title>
          </Helmet>
          <Header />
          <main>
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
                <Route path="/TaskList" element={<TaskList />} /> {/* Nueva Ruta */}
                <Route path="/configuracion">
                    <Route path="panel" element={<ConfiguracionPanel />} />
                    <Route path="comunidades" element={<ComunidadesPanel />} />
                </Route>
                <Route path="/GruposActivos" element={<GruposActivos />} /> {/* Nueva Ruta */}
              </Routes>
            </Container>
          </main>
          <footer>
            {/* Contenido del footer */}
            <Container className="text-center">
              {/* Agregar los botones de redes sociales */}
              <SocialMediaButtons />
              <p>
                &copy; 2025 Todos os Dereitos Reservados
              </p>
            </Container>
          </footer>
        </div>
      </BrowserRouter>
      </HelmetProvider>
    </UserProvider>
  );
}