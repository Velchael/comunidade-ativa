// src/components/GrupoFormModal.js
import React, { useState, useEffect, useContext } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import axios from 'axios';
import { UserContext } from '../UserContext';

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3000";

const GrupoFormModal = ({ show, handleClose, onSave, grupo }) => {
  const { user } = useContext(UserContext);

  const [formData, setFormData] = useState({
    comunidad_id: '',
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
        colider_nombre: grupo.colider_nombre || '',
        anfitrion_nombre: grupo.anfitrion_nombre || '',
        direccion_grupo: grupo.direccion_grupo || ''
      });
    } else {
      // ---- MODO CREACIÓN ----
      setFormData({
        comunidad_id: user?.comunidad_id || '',
        colider_nombre: '',
        anfitrion_nombre: '',
        direccion_grupo: ''
      });
    }
  }, [grupo, user]);

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
        const { comunidad_id, ...editData } = formData;
        await axios.put(`${API_BASE}/api/grupos/${grupo.id}`, editData, { headers });
      } else {
        // -------- POST: CREAR GRUPO --------
        const { comunidad_id, ...createData } = formData;
        await axios.post(`${API_BASE}/api/grupos`, createData, { headers });
      }

      onSave();
      handleClose();

    } catch (err) {
      console.error("❌ Error al guardar grupo:", err);
      const msg = err?.response?.data?.message || "Erro ao salvar o grupo";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>{grupo ? "✏️ Editar grupo" : "➕ Novo grupo"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Control type="hidden" name="comunidad_id" value={formData.comunidad_id} />

          <Form.Group className="mb-3">
            <Form.Label>Nome do co-líder</Form.Label>
            <Form.Control
              type="text"
              name="colider_nombre"
              value={formData.colider_nombre}
              onChange={handleChange}
              placeholder="Nome do co-líder"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Nome do anfitrião</Form.Label>
            <Form.Control
              type="text"
              name="anfitrion_nombre"
              value={formData.anfitrion_nombre}
              onChange={handleChange}
              placeholder="Nome do anfitrião"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Endereço do grupo</Form.Label>
            <Form.Control
              type="text"
              name="direccion_grupo"
              value={formData.direccion_grupo}
              onChange={handleChange}
              placeholder="Endereço do grupo"
            />
          </Form.Group>

          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? "Salvando..." : (grupo ? "Salvar alterações" : "Criar grupo")}
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default GrupoFormModal;
