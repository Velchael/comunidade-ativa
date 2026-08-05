import React, { useContext } from "react";
import { NavLink } from "react-router-dom";
import { UserContext } from "../UserContext";

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
          <NavLink to="/meu-perfil" onClick={toggle}>
            Meu Perfil
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
