// src/components/GrupoFormModal.js
import React, { useState, useEffect, useContext } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import axios from 'axios';
import { UserContext } from '../UserContext';

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3000";

const GrupoFormModal = ({ show, handleClose, onSave, grupo, initialLiderId }) => {
  const { user } = useContext(UserContext);

  const [formData, setFormData] = useState({
    comunidad_id: '',
    lider_id: '',
    colider_nombre: '',
    anfitrion_nombre: '',
    direccion_grupo: ''
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (grupo) {
      // ---- MODO EDICIÓN ----
      setFormData({
        comunidad_id: grupo.comunidad_id || user?.comunidad_id || '',
        lider_id: grupo.lider_id || '',
        colider_nombre: grupo.colider_nombre || '',
        anfitrion_nombre: grupo.anfitrion_nombre || '',
        direccion_grupo: grupo.direccion_grupo || ''
      });
    } else {
      // ---- MODO CREACIÓN ----
      setFormData({
        comunidad_id: user?.comunidad_id || '',
        lider_id: initialLiderId || user?.id || '',
        colider_nombre: '',
        anfitrion_nombre: '',
        direccion_grupo: ''
      });
    }
  }, [grupo, user, initialLiderId]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

      if (grupo) {
        // -------- PUT: EDITAR GRUPO --------
        await axios.put(`${API_BASE}/api/grupos/${grupo.id}`, formData, { headers });
      } else {
        // -------- POST: CREAR GRUPO --------
        await axios.post(`${API_BASE}/api/grupos`, formData, { headers });
      }

      onSave();
      handleClose();

    } catch (err) {
      console.error("❌ Error al guardar grupo:", err);
      const msg = err?.response?.data?.message || "Error al guardar el grupo";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>{grupo ? "✏️ Editar Grupo" : "➕ Nuevo Grupo"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={handleSubmit}>

          {/* Campo oculto: comunidad_id */}
          <Form.Control
            type="hidden"
            name="comunidad_id"
            value={formData.comunidad_id}
          />

          <Form.Group className="mb-3">
            <Form.Label>ID del Líder</Form.Label>
            <Form.Control
              type="text"
              name="lider_id"
              value={formData.lider_id}
              onChange={handleChange}
              required
            />
            <Form.Text className="text-muted">
              Si eres admin_total puedes asignar otro líder (ingresa su id).  
              Si no, se usa automáticamente tu id.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Nombre del Co-Líder</Form.Label>
            <Form.Control
              type="text"
              name="colider_nombre"
              value={formData.colider_nombre}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Nombre del Anfitrión</Form.Label>
            <Form.Control
              type="text"
              name="anfitrion_nombre"
              value={formData.anfitrion_nombre}
              onChange={handleChange}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Dirección del Grupo</Form.Label>
            <Form.Control
              type="text"
              name="direccion_grupo"
              value={formData.direccion_grupo}
              onChange={handleChange}
            />
          </Form.Group>

          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? "Guardando..." : (grupo ? "Guardar cambios" : "Crear grupo")}
          </Button>

        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default GrupoFormModal;


