import React, { useState, useEffect, useContext } from "react";
import { Container, Button, Form, Card } from "react-bootstrap";
import axios from "axios";
import { UserContext } from "../UserContext";
import { useCallback } from "react";
export default function Interacciones() {
  const { user } = useContext(UserContext);

  const [tipo, setTipo] = useState("necesidad");
  const [texto, setTexto] = useState("");
  const [visibilidad, setVisibilidad] = useState("global");
  const [lista, setLista] = useState([]);

  // 🔄 CARGAR INTERACCIONES
const cargarInteracciones = useCallback(async () => {
  const comunidadId = user?.comunidadId || user?.comunidad_id;

  if (!user || !comunidadId) return;

  try {
    const res = await axios.get(`http://localhost:3000/api/interacciones/${comunidadId}`);
    setLista(res.data);
  } catch (error) {
    console.error("Error cargando interacciones", error);
  }
}, [user]);

  useEffect(() => {
  const comunidadId = user?.comunidadId || user?.comunidad_id;

  if (user && comunidadId) {
    cargarInteracciones();
  }
  }, [user, cargarInteracciones]);

  useEffect(() => {
  if (!user) return;

  const interval = setInterval(() => {
    cargarInteracciones();
  }, 5000); // cada 5 segundos

  return () => clearInterval(interval);
}, [user, cargarInteracciones]);

   //  console.log("USER:", user);
  // 🔥 PUBLICAR
  const publicar = async () => {
    if (!texto || !user) return;

    try {

      if (!user || !(user.comunidadId || user.comunidad_id)) {
        alert("Usuario sin comunidad asignada");
        return;
      }
      await axios.post("http://localhost:3000/api/interacciones", {
        user_id: user.id,
        comunidad_id: user.comunidadId || user.comunidad_id,
        tipo,
        descripcion: texto,
        visibilidad
      });
      //console.log("USER:", user);
      setTexto("");
      cargarInteracciones();

    } catch (error) {
      console.error("Error publicando", error);
    }
  };

  // 💬 RESPONDER
  const responder = async (id, mensaje) => {
    if (!mensaje || !user) return;

    try {
      await axios.post("http://localhost:3000/api/respuestas", {
        interaccion_id: id,
        user_id: user.id,
        mensaje
      });

      cargarInteracciones();

    } catch (error) {
      console.error("Error respondiendo", error);
    }
  };

  return (
    <Container>
      <h2>Interacción</h2>

      {/* TIPO */}
      <div style={{ marginBottom: "10px" }}>
        <Button
          variant={tipo === "necesidad" ? "primary" : "outline-primary"}
          onClick={() => setTipo("necesidad")}
        >
          Necesito ayuda
        </Button>

        <Button
          variant={tipo === "ayuda" ? "success" : "outline-success"}
          onClick={() => setTipo("ayuda")}
          style={{ marginLeft: "10px" }}
        >
          Quiero ayudar
        </Button>
      </div>

      {/* VISIBILIDAD */}
      <div style={{ marginBottom: "10px" }}>
        <strong>Visibilidad:</strong>

        <Button
          variant={visibilidad === "global" ? "dark" : "outline-dark"}
          onClick={() => setVisibilidad("global")}
          style={{ marginLeft: "10px" }}
        >
          🌍 Global
        </Button>

        <Button
          variant={visibilidad === "comunidad" ? "secondary" : "outline-secondary"}
          onClick={() => setVisibilidad("comunidad")}
          style={{ marginLeft: "10px" }}
        >
          🏘️ Comunidad
        </Button>
      </div>

      {/* INPUT */}
      <Form.Control
        placeholder="¿Qué necesitas o puedes ofrecer?"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />

      <Button onClick={publicar} style={{ marginTop: "10px" }}>
        Publicar
      </Button>

      {/* LISTA */}
      {lista.map(item => (
        <Card key={item.id} style={{ marginTop: "15px" }}>
          <Card.Body>

            <strong>{item.tipo.toUpperCase()}</strong>
            <div style={{ fontSize: "13px", color: "#555" }}>
            👤 {item.usuario?.username} 
             {" - "}
             🏘️ {item.comunidad?.nombre_comunidad}
            </div>
            <div>
              <small style={{ color: "gray" }}>
                {item.visibilidad === "global"
                  ? "🌍 Global"
                  : "🏘️ Comunidad"}
              </small>
            </div>

            <p>{item.descripcion}</p>

            {/* RESPUESTAS */}
            {item.respuestas && item.respuestas.map((r) => (
              <p key={r.id} style={{ fontSize: "14px", color: "gray" }}>
                ↳ <strong>{r.usuario?.username}:</strong> {r.mensaje}
              </p>
            ))}

            {/* INPUT RESPUESTA */}
            <Form.Control
              placeholder="Responder..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  responder(item.id, e.target.value);
                  e.target.value = "";
                }
              }}
            />

          </Card.Body>
        </Card>
      ))}
    </Container>
  );
}