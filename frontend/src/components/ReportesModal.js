// src/components/ReportesModal.js
import React, { useEffect, useState, useContext } from 'react';
import { Modal, Button, Table, Form, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { UserContext } from '../UserContext';

const ReportesModal = ({ show, handleClose, grupo }) => {
  const { user } = useContext(UserContext);
  const [reportes, setReportes] = useState([]);
  const [nuevoReporte, setNuevoReporte] = useState({ semana: '', asistencia: '', tema: '', observaciones: '' });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const esAdmin = user?.rol === 'admin_basic' || user?.rol === 'admin_total';
  const esLider = grupo?.lider_id === user?.id;

  // 🔹 Cargar reportes del grupo
  const fetchReportes = async () => {
    if (!grupo) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/grupos/${grupo.id}/reportes`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setReportes(res.data);
    } catch (err) {
      console.error('❌ Error al cargar reportes:', err);
      setMessage({ type: 'danger', text: 'Error al cargar reportes' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show && grupo) {
      setMessage({ type: '', text: '' }); // limpiar mensajes previos
      fetchReportes();
    }
  }, [show, grupo]);

  // 🔹 Crear reporte
  const handleCreate = async () => {
    try {
      // formatear fecha (asegurarse que sea YYYY-MM-DD)
      const payload = {
        ...nuevoReporte,
        semana: nuevoReporte.semana ? new Date(nuevoReporte.semana).toISOString().split('T')[0] : null
      };

      await axios.post(`/api/grupos/${grupo.id}/reportes`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setMessage({ type: 'success', text: 'Reporte creado correctamente' });
      fetchReportes();
      setNuevoReporte({ semana: '', asistencia: '', tema: '', observaciones: '' });
    } catch (err) {
      console.error('❌ Error al crear reporte:', err);
      setMessage({ type: 'danger', text: 'Error al crear reporte' });
    }
  };

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>📄 Reportes del grupo: {grupo?.direccion_grupo}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {message.text && <Alert variant={message.type}>{message.text}</Alert>}

        {/* Loader */}
        {loading && <div className="text-center"><Spinner animation="border" /></div>}

        {/* Tabla de reportes */}
        {!loading && (
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Semana</th>
                <th>Asistencia</th>
                <th>Tema</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {reportes.length > 0 ? (
                reportes.map(rep => (
                  <tr key={rep.id}>
                    <td>{new Date(rep.semana).toLocaleDateString()}</td>
                    <td>{rep.asistencia ?? '-'}</td>
                    <td>{rep.tema}</td>
                    <td>{rep.observaciones || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center">No hay reportes</td>
                </tr>
              )}
            </tbody>
          </Table>
        )}

        {/* Formulario solo para líder o admin */}
        {(esAdmin || esLider) && (
          <Form>
            <h5>➕ Nuevo Reporte</h5>
            <Form.Group className="mb-2">
              <Form.Label>Semana (fecha de inicio)</Form.Label>
              <Form.Control 
                type="date" 
                value={nuevoReporte.semana} 
                onChange={(e) => setNuevoReporte({ ...nuevoReporte, semana: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Asistencia</Form.Label>
              <Form.Control 
                type="number" 
                value={nuevoReporte.asistencia} 
                onChange={(e) => setNuevoReporte({ ...nuevoReporte, asistencia: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Tema</Form.Label>
              <Form.Control 
                type="text" 
                value={nuevoReporte.tema} 
                onChange={(e) => setNuevoReporte({ ...nuevoReporte, tema: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Observaciones</Form.Label>
              <Form.Control 
                as="textarea" 
                value={nuevoReporte.observaciones} 
                onChange={(e) => setNuevoReporte({ ...nuevoReporte, observaciones: e.target.value })} />
            </Form.Group>
            <Button variant="primary" onClick={handleCreate}>Guardar Reporte</Button>
          </Form>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default ReportesModal;
