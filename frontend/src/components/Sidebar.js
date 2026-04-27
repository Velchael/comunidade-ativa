import React from "react";
import { NavLink } from "react-router-dom";

export default function Sidebar({ isOpen, toggle }) {
  return (
    <>
      {/* Fondo oscuro */}
      {isOpen && <div className="overlay" onClick={toggle}></div>}

      {/* Sidebar */}
      <div className={`sidebar ${isOpen ? "open" : ""}`}>
        <button className="close-btn" onClick={toggle}>✖</button>

        <h4>Menú</h4>

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