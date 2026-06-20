import React, { useEffect, useState, useContext, useCallback } from 'react';
import { Modal, Button, Table, Form, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { UserContext } from '../UserContext';
import {
  canManageCommunity,
  isAdminTotalGlobal
} from '../utils/permissions';

const ReportesModal = ({ show, handleClose, grupo }) => {
  const { user } = useContext(UserContext);
  const [reportes, setReportes] = useState([]);
  const [nuevoReporte, setNuevoReporte] = useState({ semana: '', asistencia: '', tema: '', observaciones: '' });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const esAdmin = isAdminTotalGlobal(user) || canManageCommunity(user);
  const esLider = grupo?.lider_id === user?.id;

  // ✅ Base URL centralizada

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";
  // 🔹 Cargar reportes del grupo
  const fetchReportes = useCallback(async () => {
  if (!grupo || !grupo.id) return;
  setLoading(true);
  try {
    const res = await axios.get(`${API_URL}/api/grupos/${grupo.id}/reportes`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    setReportes(res.data);
  } catch (err) {
    console.error('❌ Error al cargar reportes:', err);
    setMessage({ type: 'danger', text: 'Erro ao carregar relatórios' });
  } finally {
    setLoading(false);
  }
}, [grupo, API_URL]);

 useEffect(() => {
  if (show && grupo && grupo.id) {
    setMessage({ type: '', text: '' });
    fetchReportes();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [show, grupo]);

  // 🔹 Crear reporte
  const handleCreate = async () => {
    try {
      const payload = {
        ...nuevoReporte,
        semana: nuevoReporte.semana ? new Date(nuevoReporte.semana).toISOString().split('T')[0] : null
      };

      await axios.post(`${API_URL}/api/grupos/${grupo.id}/reportes`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setMessage({ type: 'success', text: 'Relatório criado com sucesso' });
      fetchReportes();
      setNuevoReporte({ semana: '', asistencia: '', tema: '', observaciones: '' });
    } catch (err) {
      console.error('❌ Error al crear reporte:', err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Não foi possível criar o relatório';

      setMessage({ type: 'danger', text: errorMessage });
    }
  };

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>📄 Relatório: {user?.nombre || user?.username}</Modal.Title>
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
                <th>Presença</th>
                <th>Tema</th>
                <th>Observações</th>
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
                  <td colSpan="4" className="text-center">Não há relatórios</td>
                </tr>
              )}
            </tbody>
          </Table>
        )}

        {/* Formulario solo para líder o admin */}
        {(esAdmin || esLider) && (
          <Form>
            <h5>➕ Novo relatório</h5>
            <Form.Group className="mb-2">
              <Form.Label>Semana (data de início)</Form.Label>
              <Form.Control 
                type="date" 
                value={nuevoReporte.semana} 
                onChange={(e) => setNuevoReporte({ ...nuevoReporte, semana: e.target.value })} />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Presença</Form.Label>
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
              <Form.Label>Observações</Form.Label>
              <Form.Control 
                as="textarea" 
                value={nuevoReporte.observaciones} 
                onChange={(e) => setNuevoReporte({ ...nuevoReporte, observaciones: e.target.value })} />
            </Form.Group>
            <Button variant="primary" onClick={handleCreate}>Salvar relatório</Button>
          </Form>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default ReportesModal;
