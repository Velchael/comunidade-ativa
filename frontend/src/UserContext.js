import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const fetchComunidadNombre = async (comunidadId) => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/comunidades/${comunidadId}`);
      return res.data?.nombre_comunidad || '';
    } catch (error) {
      console.error('❌ Error al obtener nombre de comunidad:', error);
      return '';
    }
  };

  const loadUser = async () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    try {
      const decoded = jwtDecode(token);
      console.log("🎯 Token decodificado:", decoded);

      const now = Math.floor(Date.now() / 1000);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      if (decoded.exp && decoded.exp > now) {
        const comunidadNombre = await fetchComunidadNombre(decoded.comunidad_id);

        const userData = {
          id: decoded.id,
          email: decoded.email,
          username: decoded.username || decoded.name || decoded.email?.split('@')[0] || 'Usuario',
          rol: decoded.rol || 'miembro',
          googleId: decoded.googleId,
          comunidad_id: decoded.comunidad_id,
          comunidadNombre
        };

        setUser(userData);
      } else {
        console.warn("⚠️ Token expirado.");
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
      }
    } catch (error) {
      console.error('❌ Error al decodificar token:', error);
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};
