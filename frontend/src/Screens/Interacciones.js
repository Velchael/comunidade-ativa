import React, { useState, useEffect, useContext, useCallback } from "react";
import { Container, Button, Form, Card } from "react-bootstrap";
import axios from "axios";
import { UserContext } from "../UserContext";

export default function Interacciones() {
  const { user } = useContext(UserContext);

  const [tipo, setTipo] = useState("necesidad");
  const [categoria, setCategoria] = useState("servicio");
  const [texto, setTexto] = useState("");
  const [visibilidad, setVisibilidad] = useState("global");
  const [lista, setLista] = useState([]);

  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [urgencia, setUrgencia] = useState("normal");
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

  // 🔁 AUTO REFRESH
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      cargarInteracciones();
    }, 5000);

    return () => clearInterval(interval);
  }, [user, cargarInteracciones]);

  // 🔥 PUBLICAR (optimista)
  const publicar = async () => {
    if (!texto || !user) return;

    const comunidadId = user.comunidadId || user.comunidad_id;

    if (!comunidadId) {
      alert("Usuario sin comunidad asignada");
      return;
    }

    const nueva = {
      id: Date.now(),
      tipo,
      categoria,
      descripcion: texto,
      visibilidad,
      urgencia,
      usuario: { username: user.username },
      comunidad: { nombre_comunidad: user.comunidadNombre },
      respuestas: []
    };

    // UI inmediata
    setLista(prev => [nueva, ...prev]);

    try {
      await axios.post("http://localhost:3000/api/interacciones", {
        user_id: user.id,
        comunidad_id: comunidadId,
        tipo,
        categoria,
        descripcion: texto,
        visibilidad,
        urgencia
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

  // 🎨 ESTILO BOTONES ACTIVOS
  const getActiveStyle = (activo) => {
    return activo
      ? {
          transform: "scale(1.05)",
          boxShadow: "0 0 10px rgba(0,0,0,0.2)",
          border: "2px solid #000"
        }
      : {};
  };

  // 🎨 COLOR TARJETA
  const getCardColor = (tipo) => {
    if (tipo === "necesidad") return "#fff5f5";
    if (tipo === "ayuda") return "#f0fff4";
    return "#fff";
  };

  // 🔍 FILTROS
  const listaFiltrada = lista.filter(item => {
    return (
      (filtroTipo === "todos" || item.tipo === filtroTipo) &&
      (filtroCategoria === "todos" || item.categoria === filtroCategoria)
    );
  });

  return (
    <Container>
      <h2>Interacción</h2>

      {/* 🔍 FILTROS */}
      <div style={{ marginBottom: "15px" }}>
        <strong>Filtrar:</strong>

        <Button onClick={() => setFiltroTipo("todos")} style={{ marginLeft: 5 }}>
          Todos
        </Button>
        <Button onClick={() => setFiltroTipo("necesidad")} style={{ marginLeft: 5 }}>
          Necesidade
        </Button>
        <Button onClick={() => setFiltroTipo("ayuda")} style={{ marginLeft: 5 }}>
          Ayuda
        </Button>

        <Button onClick={() => setFiltroCategoria("servicio")} style={{ marginLeft: 10 }}>
          Servicios
        </Button>
        <Button onClick={() => setFiltroCategoria("producto")} style={{ marginLeft: 5 }}>
          Productos
        </Button>
      </div>

      {/* TIPO */}
      <div style={{ marginBottom: "10px" }}>
        <strong>Tipo: </strong>
        <Button
          variant={tipo === "necesidad" ? "primary" : "outline-primary"}
          style={getActiveStyle(tipo === "necesidad")}
          onClick={() => setTipo("necesidad")}
          
        >
          Necesidade
        </Button>

        <Button
          variant={tipo === "ayuda" ? "success" : "outline-success"}
          style={{ marginLeft: 10, ...getActiveStyle(tipo === "ayuda") }}
          onClick={() => setTipo("ayuda")}
        >
          Ayuda
        </Button>
        
      </div>
  {tipo === "necesidad" && (
  <div style={{ marginBottom: "10px" }}>
    <strong>Urgencia:</strong>

    <Button
      variant={urgencia === "normal" ? "success" : "outline-success"}
      style={{ marginLeft: 10 }}
      onClick={() => setUrgencia("normal")}
    >
      🟢 Normal
    </Button>

    <Button
      variant={urgencia === "alta" ? "warning" : "outline-warning"}
      style={{ marginLeft: 10 }}
      onClick={() => setUrgencia("alta")}
    >
      🟠 Alta
    </Button>

    <Button
      variant={urgencia === "critica" ? "danger" : "outline-danger"}
      style={{ marginLeft: 10 }}
      onClick={() => setUrgencia("critica")}
    >
      🔴 Crítica
    </Button>
  </div>
  )}
      {/* VISIBILIDAD */}
      <div style={{ marginBottom: "10px" }}>
        <strong>Visibilidad:</strong>

        <Button
          variant={visibilidad === "global" ? "dark" : "outline-dark"}
          style={{ marginLeft: 10, ...getActiveStyle(visibilidad === "global") }}
          onClick={() => setVisibilidad("global")}
        >
          🌍 Global
        </Button>

        <Button
          variant={visibilidad === "comunidad" ? "secondary" : "outline-secondary"}
          style={{ marginLeft: 10, ...getActiveStyle(visibilidad === "comunidad") }}
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
          style={{ marginLeft: 10, ...getActiveStyle(categoria === "servicio") }}
          onClick={() => setCategoria("servicio")}
        >
          🛠️ Servicio
        </Button>

        <Button
          variant={categoria === "producto" ? "info" : "outline-info"}
          style={{ marginLeft: 10, ...getActiveStyle(categoria === "producto") }}
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
      {listaFiltrada.map((item) => (
        <Card
          key={item.id}
          style={{
            marginTop: "15px",
            backgroundColor: getCardColor(item.tipo)
          }}
        >
          <Card.Body>

            {/* HEADER */}
            <div>
             {item.urgencia === "critica" && (
              <span style={{ color: "red" }}>🚨 URGENTE</span>
             )}
             {item.urgencia === "alta" && (
              <span style={{ color: "orange" }}>⚠️ Alta prioridad</span>
             )}
            </div>
            <strong>
              {item.tipo?.toUpperCase()} | {item.categoria?.toUpperCase()}
            </strong>

            {/* USUARIO */}
            <div style={{ fontSize: "13px", color: "#555" }}>
              👤 {item.usuario?.username} - 🏘️ {item.comunidad?.nombre_comunidad}
            </div>

            {/* ESTADO SOCIAL */}
            <div>
              {item.respuestas?.length === 0 && (
                <span style={{ color: "red" }}>🆘 Sin respuestas</span>
              )}
              {item.respuestas?.length > 0 && (
                <span style={{ color: "green" }}>🤝 Con ayuda</span>
              )}
            </div>

            {/* VISIBILIDAD */}

            <div>
              <small style={{ color: "gray" }}>
                {item.visibilidad === "global"
                  ? "🌍 Global"
                  : "🏘️ Comunidad"}
              </small>
            </div>

             <div>
            <small style={{
              color:
                item.urgencia === "critica"
                ? "red"
                : item.urgencia === "alta"
                ? "orange"
                : "green"
               }}>
               ⚡ {item.urgencia?.toUpperCase() || "NORMAL"}
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