import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    try {
      const decoded = jwtDecode(token); // ✅ Nombre correcto
      console.log("🎯 Token decodificado:", decoded);

      const now = Math.floor(Date.now() / 1000);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      if (decoded.exp && decoded.exp > now) {
        const userData = {
          id: decoded.id,
          email: decoded.email,
          username: decoded.username || decoded.name || decoded.email?.split('@')[0] || 'Usuario', // ✅ Usamos `decoded`, no `decodedToken`
          rol: decoded.rol || 'miembro',
          googleId: decoded.googleId
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
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};
