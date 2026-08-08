import React, { useContext } from "react";
import { Navbar, Container, Button } from "react-bootstrap";
import { NavLink, useNavigate } from "react-router-dom";
import { UserContext } from "../UserContext";
import UserAvatar from "./UserAvatar";

export default function Header({ toggleSidebar }) {
  const { user, setUser } = useContext(UserContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    navigate("/");
  };

  return (
    <>
      {/* MOBILE TOPBAR */}
      <div className="mobile-topbar d-md-none">
        <button onClick={toggleSidebar}>☰</button>
        <span>COMUVA</span>
      </div>

      {/* DESKTOP NAVBAR (BOOTSTRAP) */}
      <Navbar className="menu-header d-none d-md-flex">
        <Container>
          <Navbar.Brand>COMUVA</Navbar.Brand>

          <div className="d-flex align-items-center gap-3">
            <NavLink to="/TaskList">Agenda</NavLink>
            <NavLink to="/GruposActivos">Grupos</NavLink>

            {user && (
              <>
                <UserAvatar
                  src={user.foto_perfil}
                  name={user.username || user.email}
                  size="publication"
                />
                <span>{user.username}</span>
                <Button size="sm" onClick={handleLogout}>
                  Sair
                </Button>
              </>
            )}
          </div>
        </Container>
      </Navbar>
    </>
  );
}
