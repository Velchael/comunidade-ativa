import React, { useContext, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { UserContext } from "../UserContext";
import { usePwaInstall } from "../PwaInstallContext";
import UserAvatar from "./UserAvatar";

export default function Sidebar({ isOpen, toggle }) {
  const { user, isHydrating, logout } = useContext(UserContext);
  const navigate = useNavigate();
  const {
    isInstalled,
    isManualInstall,
    isPrompting,
    isDismissed,
    canPrompt,
    promptInstall
  } = usePwaInstall();
  const [showManualInstallHelp, setShowManualInstallHelp] = useState(false);
  const showAuthenticatedMenu = !isHydrating && Boolean(user);
  const shouldShowInstallAction =
    showAuthenticatedMenu &&
    !isInstalled &&
    !isDismissed &&
    (canPrompt || isPrompting || isManualInstall);

  const handlePromptInstall = async () => {
    if (!canPrompt || isPrompting) return;
    await promptInstall();
  };

  const handleLogout = () => {
    logout?.();
    toggle();
    navigate("/");
  };

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

        {showAuthenticatedMenu && (
          <NavLink to="/conversas" onClick={toggle}>
            Conversas
          </NavLink>
        )}

        {shouldShowInstallAction && (
          <div className="sidebar-section">
            {(canPrompt || isPrompting) && (
              <button
                type="button"
                className="sidebar-action"
                disabled={isPrompting}
                onClick={handlePromptInstall}
              >
                <span aria-hidden="true">📲</span>
                <span>{isPrompting ? "Instalando..." : "Instalar COMUVA"}</span>
              </button>
            )}

            {isManualInstall && (
              <button
                type="button"
                className="sidebar-action"
                aria-expanded={showManualInstallHelp}
                aria-controls="sidebar-pwa-manual-help"
                onClick={() => setShowManualInstallHelp((currentValue) => !currentValue)}
              >
                <span aria-hidden="true">📲</span>
                <span>Como instalar COMUVA</span>
              </button>
            )}

            {isManualInstall && showManualInstallHelp && (
              <div
                id="sidebar-pwa-manual-help"
                className="sidebar-manual-help"
                role="region"
                aria-label="Instruções para instalar COMUVA"
              >
                <ol>
                  <li>Toque em Compartilhar.</li>
                  <li>Escolha "Adicionar à Tela de Início".</li>
                  <li>Confirme "Adicionar".</li>
                </ol>
              </div>
            )}
          </div>
        )}

        {showAuthenticatedMenu && (
          <div className="sidebar-section sidebar-section--logout">
            <button
              type="button"
              className="sidebar-action sidebar-action--danger"
              onClick={handleLogout}
            >
              <span aria-hidden="true">↪</span>
              <span>Sair</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
