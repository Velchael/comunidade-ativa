import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './EmailConfirmation.css'; // Archivo CSS para estilos

const EmailConfirmation = () => {
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [messageColor, setMessageColor] = useState('');
  const location = useLocation();
  const navigate = useNavigate(); // Hook para navegación

  const handleConfirm = useCallback(async () => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');
    if (!token) {
      setConfirmationMessage('Token no encontrado');
      setMessageColor('red');
      return;
    }

    try {
      const response = await fetch(`http://localhost:3307/api/users/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token: token }),
      });

      if (response.ok) {
        const data = await response.json();
        setConfirmationMessage(data.message);
        setMessageColor('blue');
      } else {
        const errorData = await response.json();
        console.error(errorData);
        setConfirmationMessage(errorData.message || 'Error al confirmar el correo');
        setMessageColor('red');
      }
    } catch (error) {
      console.error('Error al parsear JSON:', error);
      setConfirmationMessage(`Error: ${error.message}`);
      setMessageColor('red');
    } finally {
      setTimeout(() => {
        navigate('/Seinscrever'); // Redirige al componente SeInscrever
      }, 4000);
    }
  }, [location.search, navigate]);

  useEffect(() => {
    const confirmButton = document.getElementById('confirmButton');
    confirmButton.addEventListener('click', handleConfirm);
    return () => {
      confirmButton.removeEventListener('click', handleConfirm);
    };
  }, [handleConfirm]);

  return (
    <div className="email-confirmation-container">
      <h1>Confirmação de e-mail</h1>
      <p>Obrigado por se registrar. Clique no botão abaixo para confirmar seu e-mail.</p>
      <button id="confirmButton">Confirmar e-mail</button>
      <p id="confirmationMessage" style={{ display: confirmationMessage ? 'block' : 'none', color: messageColor }}>
        {confirmationMessage}
      </p>
    </div>
  );
};

export default EmailConfirmation;