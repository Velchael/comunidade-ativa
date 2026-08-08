import React, { useContext } from "react";
import { NavLink } from "react-router-dom";
import { UserContext } from "../UserContext";
import UserAvatar from "./UserAvatar";

export default function Sidebar({ isOpen, toggle }) {
  const { user, isHydrating } = useContext(UserContext);
  const showAuthenticatedMenu = !isHydrating && Boolean(user);

  return (
    <>
      {/* Fondo oscuro */}
      {isOpen && <div className="overlay" onClick={toggle}></div>}

      {/* Sidebar */}
      <div className={`sidebar ${isOpen ? "open" : ""}`}>
        <button className="close-btn" onClick={toggle}>✖</button>

        <h4>Menu</h4>

        {showAuthenticatedMenu && (
          <NavLink className="sidebar-profile-link" to="/meu-perfil" onClick={toggle}>
            <UserAvatar
              src={user.foto_perfil}
              name={user.username || user.email}
              size="publication"
            />
            <span>Meu Perfil</span>
          </NavLink>
        )}

        <NavLink to="/TaskList" onClick={toggle}>
          Agenda
        </NavLink>

        <NavLink to="/GruposActivos" onClick={toggle}>
          Grupos
        </NavLink>
      </div>
    </>
  );
}
