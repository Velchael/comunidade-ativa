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
  const [categoria, setCategoria] = useState("servicio");

  // 🔄 CARGAR INTERACCIONES
  const cargarInteracciones = useCallback(async () => {
    const comunidadId = user?.comunidadId || user?.comunidad_id;

    if (!user || !comunidadId) return;

    try {
      const res = await axios.get(
        `http://localhost:3000/api/interacciones/${comunidadId}`
      );
      setLista(res.data);
    } catch (error) {
      console.error("Error cargando interacciones", error);
    }
  }, [user]);

  useEffect(() => {
    if (user) cargarInteracciones();
  }, [user, cargarInteracciones]);

  // 🔁 AUTO-REFRESH
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      cargarInteracciones();
    }, 5000);

    return () => clearInterval(interval);
  }, [user, cargarInteracciones]);

  // 🔥 PUBLICAR
  const publicar = async () => {
    if (!texto || !user) return;

    try {
      const comunidadId = user.comunidadId || user.comunidad_id;

      if (!comunidadId) {
        alert("Usuario sin comunidad asignada");
        return;
      }

      await axios.post("http://localhost:3000/api/interacciones", {
        user_id: user.id,
        comunidad_id: comunidadId,
        tipo,
        categoria, // ✅ IMPORTANTE
        descripcion: texto,
        visibilidad
      });

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

const getActiveStyle = (activo) => {
  return activo
    ? {
        transform: "scale(1.05)",
        boxShadow: "0 0 10px rgba(0,0,0,0.2)",
        border: "2px solid #000"
      }
    : {};
};

  return (
    <Container>
      <h2>Interacción</h2>

      {/* TIPO */}
      <div style={{ marginBottom: "10px" }}>
        <Button
          variant={tipo === "necesidad" ? "primary" : "outline-primary"}
          style={getActiveStyle(tipo === "necesidad")}
          onClick={() => setTipo("necesidad")}
        >
          Necesito ayuda
        </Button>

        <Button
          variant={tipo === "ayuda" ? "success" : "outline-success"}
          style={{
            marginLeft: "10px",
            ...getActiveStyle(tipo === "ayuda")
          }}
          onClick={() => setTipo("ayuda")}
        >
          Quiero ayudar
        </Button>
      </div>

      {/* VISIBILIDAD */}
      <div style={{ marginBottom: "10px" }}>
        <strong>Visibilidad:</strong>
        
       <Button
         variant={visibilidad === "global" ? "dark" : "outline-dark"}
         style={{
         marginLeft: "10px",
         ...getActiveStyle(visibilidad === "global")
         }}
         onClick={() => setVisibilidad("global")}
       >
        🌍 Global
       </Button>

       <Button
         variant={visibilidad === "comunidad" ? "secondary" : "outline-secondary"}
         style={{
           marginLeft: "10px",
           ...getActiveStyle(visibilidad === "comunidad")
         }}
        onClick={() => setVisibilidad("comunidad")}
       >
        🏘️ Comunidad
       </Button>
      </div>

      {/* CATEGORIA */}
      <div style={{ marginBottom: "10px" }}>
        <strong>Categoría:</strong>
      <Button
        variant={categoria === "servicio" ? "warning" : "outline-warning"}
        style={{
          marginLeft: "10px",
          ...getActiveStyle(categoria === "servicio")
        }}
          onClick={() => setCategoria("servicio")}
      >
        🛠️ Servicio
      </Button>

      <Button
        variant={categoria === "producto" ? "info" : "outline-info"}
        style={{
        marginLeft: "10px",
        ...getActiveStyle(categoria === "producto")
        }}
        onClick={() => setCategoria("producto")}
      >
       📦 Producto
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
      {lista.map((item) => (
        <Card key={item.id} style={{ marginTop: "15px" }}>
          <Card.Body>

            {/* HEADER */}
            <strong>
              {item.tipo.toUpperCase()} {" | "}
              {item.categoria?.toUpperCase() || "GENERAL"}
            </strong>

            {/* USUARIO */}
            <div style={{ fontSize: "13px", color: "#555" }}>
              👤 {item.usuario?.username} {" - "}
              🏘️ {item.comunidad?.nombre_comunidad}
            </div>

            {/* VISIBILIDAD */}
            <div>
              <small style={{ color: "gray" }}>
                {item.visibilidad === "global"
                  ? "🌍 Global"
                  : "🏘️ Comunidad"}
              </small>
            </div>

            {/* TEXTO */}
            <p>{item.descripcion}</p>

            {/* RESPUESTAS */}
            {item.respuestas?.map((r) => (
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