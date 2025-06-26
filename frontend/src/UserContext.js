import React, { createContext, useState, useEffect } from 'react';
import {jwtDecode} from 'jwt-decode'; // Corrige la importación sin llaves

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkTokenValidity = (token) => {
      try {
        const decodedToken = jwtDecode(token);
        const currentTime = Math.floor(Date.now() / 1000); // Tiempo actual en segundos
        if (decodedToken.exp > currentTime) {
          const username = decodedToken.username || 'Usuario';
          setUser({ username });
        } else {
          console.warn('Expiro');
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
        }
      } catch (error) {
        console.error('Token inválido:', error);
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
      }
    };

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      checkTokenValidity(token);
    }
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};