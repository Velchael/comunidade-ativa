// src/userContext.jsx
import { createContext, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "axios";

export const UserContext = createContext();

const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:3000") + "/api";

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);

  // Guarda token + user y sincroniza sesión (axios header + localStorage)
 const saveSession = (jwt, userObj = null) => {
  try {
    const decoded = jwtDecode(jwt);

    const baseUser = userObj || decoded;

    // 🔥 NORMALIZACIÓN CLAVE
    const normalizedUser = {
      ...baseUser,
      comunidadId: baseUser.comunidadId || baseUser.comunidad_id
    };

    setUser(normalizedUser);
    setToken(jwt);

    localStorage.setItem("token", jwt);
    localStorage.setItem("user", JSON.stringify(normalizedUser));

    axios.defaults.headers.common["Authorization"] = `Bearer ${jwt}`;
  } catch (err) {
    console.error("❌ Error al decodificar token:", err.message);
    logout();
  }
};

  // Login desde token
  const login = (jwt, userObj = null) => saveSession(jwt, userObj);

  // Logout global
  const logout = () => {
    delete axios.defaults.headers.common["Authorization"];
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
  };

  // Refresh token con axios (usa endpoint backend: /api/auth/refresh)
  const refreshToken = async () => {
    try {
      if (!token) return;

      const res = await axios.get(`${API_BASE}/auth/refresh`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // esperamos { token, user }
      const { token: newToken, user: refreshedUser } = res.data || {};
      if (newToken) {
        saveSession(newToken, refreshedUser || null);
        console.log("🔁 Token renovado automáticamente");
      } else {
        throw new Error("Refresh no devolvió token");
      }
    } catch (err) {
      console.warn("⚠️ Refresh falló:", err.response?.data?.message || err.message);
      logout();
    }
  };

  // Restaurar sesión desde localStorage al iniciar
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (savedToken && savedUser) {
      // configurar axios header para peticiones inmediatas
      axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
      setToken(savedToken);
      try {
        //setUser(JSON.parse(savedUser));
        const parsed = JSON.parse(savedUser);

       setUser({
        ...parsed,
        comunidadId: parsed.comunidadId || parsed.comunidad_id
       });

      } catch {
        setUser(null);
      }
    }
  }, []);

  // Ejecutar refresh al montar (si hay token) + cada 20 minutos
  useEffect(() => {
    if (!token) return;

    // Intentar refresh al cargar (si el token está cercano a expirar o ya expirado)
    refreshToken();

    const interval = setInterval(refreshToken, 20 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <UserContext.Provider value={{ user, token, login, logout, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

