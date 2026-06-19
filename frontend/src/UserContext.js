// src/userContext.jsx
import { createContext, useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

export const UserContext = createContext();

const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:3000") + "/api";
const AUTH_USER_REQUIRED_KEYS = [
  "id",
  "username",
  "email",
  "rol",
  "rol_global",
  "comunidad_id",
  "comunidadNombre",
  "rol_comunidad",
  "is_owner",
  "can_manage_comunidad"
];

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [isHydrating, setIsHydrating] = useState(Boolean(localStorage.getItem("token")));
  const [needsInitialRefresh, setNeedsInitialRefresh] = useState(
    Boolean(localStorage.getItem("token"))
  );
  const tokenRef = useRef(token);
  const userRef = useRef(user);
  const refreshInFlightRef = useRef(null);
  const lastRefreshAtRef = useRef(0);

  const AUTH_REFRESH_THROTTLE_MS = 20 * 1000;
  const AUTH_REFRESH_INTERVAL_MS = 60 * 1000;

  const normalizeUser = useCallback((baseUser = {}) => ({
    ...baseUser,
    comunidadId: baseUser.comunidadId || baseUser.comunidad_id,
    rol_global: baseUser.rol_global || baseUser.rol || null,
    rol_comunidad: baseUser.rol_comunidad || null,
    is_owner: baseUser.is_owner === true,
    can_manage_comunidad: baseUser.can_manage_comunidad === true
  }), []);

  const hasCompleteAuthUser = useCallback((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return false;
    }

    return AUTH_USER_REQUIRED_KEYS.every((key) =>
      Object.prototype.hasOwnProperty.call(candidate, key)
    );
  }, []);

  const primeSessionToken = useCallback((jwt) => {
    setToken(jwt);
    tokenRef.current = jwt;
    localStorage.setItem("token", jwt);
    axios.defaults.headers.common["Authorization"] = `Bearer ${jwt}`;
  }, []);

  const persistSessionUser = useCallback((jwt, authUser) => {
    const normalizedUser = normalizeUser(authUser);

    setUser(normalizedUser);
    setToken(jwt);
    tokenRef.current = jwt;

    localStorage.setItem("token", jwt);
    localStorage.setItem("user", JSON.stringify(normalizedUser));

    axios.defaults.headers.common["Authorization"] = `Bearer ${jwt}`;
    setIsHydrating(false);

    return normalizedUser;
  }, [normalizeUser]);

  const fetchAuthSnapshot = useCallback(async (jwt) => {
    const res = await axios.get(`${API_BASE}/auth/refresh`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    return res.data || {};
  }, [API_BASE]);

  // Guarda token + user y sincroniza sesión (axios header + localStorage)
 const logout = useCallback(() => {
    delete axios.defaults.headers.common["Authorization"];
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
    setNeedsInitialRefresh(false);
    setIsHydrating(false);
  }, []);

 const saveSession = useCallback(async (jwt, userObj = null) => {
    try {
      let sessionToken = jwt;
      let authUser = userObj;

      primeSessionToken(jwt);

      if (!hasCompleteAuthUser(authUser)) {
        const refreshed = await fetchAuthSnapshot(jwt);
        sessionToken = refreshed.token || jwt;
        authUser = refreshed.user || authUser;
        primeSessionToken(sessionToken);
      }

      if (!hasCompleteAuthUser(authUser)) {
        throw new Error("No se pudo hidratar el usuario autenticado");
      }

      return persistSessionUser(sessionToken, authUser);
    } catch (err) {
      console.error("❌ Error al guardar sesión:", err.message);
      logout();
      throw err;
    }
  }, [fetchAuthSnapshot, hasCompleteAuthUser, logout, persistSessionUser, primeSessionToken]);

  // Login desde token
  const login = useCallback((jwt, userObj = null) => saveSession(jwt, userObj), [saveSession]);

  const refreshAuthSession = useCallback(async ({ force = false } = {}) => {
    const currentToken = tokenRef.current;
    if (!currentToken) return null;

    const now = Date.now();
    if (!force && now - lastRefreshAtRef.current < AUTH_REFRESH_THROTTLE_MS) {
      return refreshInFlightRef.current || userRef.current;
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    setIsHydrating(true);

    const refreshPromise = (async () => {
      try {
        const res = await axios.get(`${API_BASE}/auth/refresh`, {
          headers: { Authorization: `Bearer ${tokenRef.current}` },
        });

        const { token: newToken, user: refreshedUser } = res.data || {};
        if (!newToken) {
          throw new Error("Refresh no devolvió token");
        }

        lastRefreshAtRef.current = Date.now();
        const nextUser = await saveSession(newToken, refreshedUser || null);
        console.log("🔁 Sesión autenticada sincronizada");
        return nextUser;
      } catch (err) {
        console.warn("⚠️ Refresh falló:", err.response?.data?.message || err.message);
        logout();
        throw err;
      } finally {
        refreshInFlightRef.current = null;
        setIsHydrating(false);
      }
    })();

    refreshInFlightRef.current = refreshPromise;
    return refreshPromise;
  }, [API_BASE, logout, saveSession]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Restaurar sesión desde localStorage al iniciar
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (savedToken) {
      // configurar axios header para peticiones inmediatas
      axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
      setToken(savedToken);

      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          setUser(normalizeUser(parsed));
        } catch {
          setUser(null);
        }
      }
    } else {
      setNeedsInitialRefresh(false);
      setIsHydrating(false);
    }
  }, [normalizeUser]);

  // Ejecutar refresh una vez al hidratar sesión persistida
  useEffect(() => {
    if (!token || !needsInitialRefresh) {
      if (!token) {
        setNeedsInitialRefresh(false);
      }
      return;
    }

    refreshAuthSession({ force: true });
    setNeedsInitialRefresh(false);
  }, [needsInitialRefresh, refreshAuthSession, token]);

  // Mantener sesión sincronizada con source of truth sin refrescos agresivos
  useEffect(() => {
    if (!token) {
      setIsHydrating(false);
      return;
    }

    const handleWindowFocus = () => {
      refreshAuthSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshAuthSession();
      }
    };

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshAuthSession();
      }
    }, AUTH_REFRESH_INTERVAL_MS);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshAuthSession, token]);

  return (
    <UserContext.Provider
      value={{ user, token, login, logout, setUser, isHydrating, refreshAuthSession }}
    >
      {children}
    </UserContext.Provider>
  );
};

