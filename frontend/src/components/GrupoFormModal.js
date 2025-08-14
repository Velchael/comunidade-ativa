// src/components/GrupoFormModal.js
import React, { useState, useEffect, useContext } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import axios from 'axios';
import { UserContext } from '../UserContext';

const GrupoFormModal = ({ show, handleClose, onSave, grupo }) => {
  const { user } = useContext(UserContext);
  const [formData, setFormData] = useState({
    lider_id: '',
    colider_nombre: '',
    anfitrion_nombre: '',
    direccion_grupo: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (grupo) {
      // Modo edición
      setFormData({
        lider_id: grupo.lider_id || '',
        colider_nombre: grupo.colider_nombre || '',
        anfitrion_nombre: grupo.anfitrion_nombre || '',
        direccion_grupo: grupo.direccion_grupo || ''
      });
    } else {
      // Modo creación
      setFormData({
        lider_id: '',
        colider_nombre: '',
        anfitrion_nombre: '',
        direccion_grupo: ''
      });
    }
  }, [grupo]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (grupo) {
        // PUT solo para admins
        await axios.put(`/api/grupos/${grupo.id}`, formData, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
      } else {
        // POST para usuario logado (Google o admin)
        await axios.post('/api/grupos', formData, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
      }
      onSave();
      handleClose();
    } catch (err) {
      console.error('❌ Error al guardar grupo:', err);
      setError('Error al guardar el grupo');
    }
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>{grupo ? '✏️ Editar Grupo' : '➕ Nuevo Grupo'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Líder ID</Form.Label>
            <Form.Control
              type="text"
              name="lider_id"
              value={formData.lider_id}
              onChange={handleChange}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Co-Líder</Form.Label>
            <Form.Control
              type="text"
              name="colider_nombre"
              value={formData.colider_nombre}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Anfitrión</Form.Label>
            <Form.Control
              type="text"
              name="anfitrion_nombre"
              value={formData.anfitrion_nombre}
              onChange={handleChange}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Dirección</Form.Label>
            <Form.Control
              type="text"
              name="direccion_grupo"
              value={formData.direccion_grupo}
              onChange={handleChange}
            />
          </Form.Group>
          <Button variant="primary" type="submit">
            {grupo ? 'Guardar cambios' : 'Crear grupo'}
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default GrupoFormModal;


