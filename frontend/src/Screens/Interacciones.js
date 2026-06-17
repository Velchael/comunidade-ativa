import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import { Container, Button, Form, Card, Alert } from "react-bootstrap";
import axios from "axios";
import { UserContext } from "../UserContext";

export default function Interacciones() {
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';
  const pollingIntervalRef = useRef(null);
  const isFetchingRef = useRef(false);

  const { user } = useContext(UserContext);
  const userId = user?.id || null;
  const comunidadId = user?.comunidadId || user?.comunidad_id || null;

  const [tipo, setTipo] = useState("necesidad");
  const [categoria, setCategoria] = useState("servicio");
  const [texto, setTexto] = useState("");
  const [visibilidad, setVisibilidad] = useState("global");
  const [lista, setLista] = useState([]);
  const [urgencia, setUrgencia] = useState("normal");
  const [estadoErrorGeneral, setEstadoErrorGeneral] = useState("");
  const [estadoErroresPorId, setEstadoErroresPorId] = useState({});
  const [estadoErroresRespuestaPorId, setEstadoErroresRespuestaPorId] = useState({});
  const [accionEstadoRespuestaId, setAccionEstadoRespuestaId] = useState(null);
  const [accionEstadoId, setAccionEstadoId] = useState(null);
  const [interaccionesAuth, setInteraccionesAuth] = useState(null);

  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");

  const puedeModerar =
    interaccionesAuth?.can_moderate_interacciones === true;
  const esAdminTotalGlobal =
    interaccionesAuth?.is_admin_total_global === true;
  const rolComunidadAuth =
    interaccionesAuth?.rol_comunidad || null;
  const comunidadAuthId = Number(interaccionesAuth?.comunidad_id || 0);
  const tieneRolModeradorLocal =
    ["admin_total", "admin_basic", "moderador"].includes(rolComunidadAuth);

  const puedeModerarInteraccion = (item) => {
    if (!puedeModerar) return false;
    if (esAdminTotalGlobal) return true;

    return (
      tieneRolModeradorLocal &&
      Number(item?.comunidad?.id || item?.comunidad_id || 0) === comunidadAuthId
    );
  };

  // 🔄 CARGAR INTERACCIONES
  const cargarInteracciones = useCallback(async () => {
    if (!userId || !comunidadId) return;
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      const token = localStorage.getItem("token");

      const res = await axios.get(
        `${API_BASE}/api/interacciones/${comunidadId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (Array.isArray(res.data)) {
        setLista(res.data);
        setInteraccionesAuth(null);
      } else {
        setLista(res.data?.items || []);
        setInteraccionesAuth(res.data?.auth || null);
      }
      setEstadoErrorGeneral("");
    } catch (error) {
      console.error("Error cargando interacciones", error);
      setEstadoErrorGeneral(
        "No se pudieron cargar las interacciones."
      );
    } finally {
      isFetchingRef.current = false;
    }
  }, [API_BASE, comunidadId, userId]);

  useEffect(() => {
    if (userId && comunidadId) {
      cargarInteracciones();
    }
  }, [cargarInteracciones, comunidadId, userId]);

  useEffect(() => {
    if (!userId || !comunidadId) return undefined;

    const stopPolling = () => {
      if (pollingIntervalRef.current !== null) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    const startPolling = () => {
      if (document.visibilityState !== "visible" || pollingIntervalRef.current !== null) {
        return;
      }

      pollingIntervalRef.current = window.setInterval(() => {
        cargarInteracciones();
      }, 10000);
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        cargarInteracciones();
        startPolling();
        return;
      }

      stopPolling();
    };

    const handleWindowFocus = () => {
      if (document.visibilityState === "visible") {
        cargarInteracciones();
        startPolling();
      }
    };

    startPolling();

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      stopPolling();
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [cargarInteracciones, comunidadId, userId]);

  // 🔥 PUBLICAR
  const publicar = async () => {
    if (!texto || !user) return;

    const comunidadId = user.comunidadId || user.comunidad_id;

    if (!comunidadId) {
      alert("Usuario sin comunidad asignada");
      return;
    }

    // ✅ Si es ayuda, urgencia siempre normal
    const urgenciaFinal =
      tipo === "ayuda" ? "normal" : urgencia;

    const nueva = {
      id: Date.now(),
      tipo,
      categoria,
      descripcion: texto,
      visibilidad,
      urgencia: urgenciaFinal,
      usuario: { username: user.username },
      comunidad: {
        nombre_comunidad: user.comunidadNombre
      },
      respuestas: []
    };

    // ⚡ UI optimista
    setLista(prev => [nueva, ...prev]);

    try {
      const token = localStorage.getItem("token");

      await axios.post(
        `${API_BASE}/api/interacciones`,
        {
          user_id: user.id,
          comunidad_id: comunidadId,
          tipo,
          categoria,
          descripcion: texto,
          visibilidad,
          urgencia: urgenciaFinal
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setTexto("");

      // reset opcional
      setUrgencia("normal");

      cargarInteracciones();

    } catch (error) {
      console.error("Error publicando", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        alert(error.response?.data?.message || error.response?.data?.error || "No autorizado");
      }
    }
  };

  // 💬 RESPONDER
  const responder = async (id, mensaje) => {
    if (!mensaje || !user) return;

    try {
      const token = localStorage.getItem("token");

      await axios.post(
        `${API_BASE}/api/respuestas`,
        {
          interaccion_id: id,
          user_id: user.id,
          mensaje
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      cargarInteracciones();

    } catch (error) {
      console.error("Error respondiendo", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        alert(error.response?.data?.message || error.response?.data?.error || "No autorizado");
      }
    }
  };

  // 🎨 ESTILO BOTONES ACTIVOS
  const getActiveStyle = (activo) => {
    return activo
      ? {
          //transform: "scale(1.05)",
          //boxShadow: "0 0 10px rgba(0,0,0,0.2)",
          //border: "2px solid #000"
        transform: "scale(1.10)",
        boxShadow: "0 0 13px rgba(0,0,0,0.50)",
        border: "2px solid #000",
        transition: "all 0.2s ease"

        }
      : {
        transition: "all 0.2s ease"
        };
  };

  // 🎨 COLOR TARJETA
  const getCardColor = (tipo) => {
    if (tipo === "necesidad") return "#fff5f5";
    if (tipo === "ayuda") return "#f0fff4";

    return "#fff";
  };

  const getEstadoLabel = (estado) => {
    if (estado === "cerrado") return "Cerrado";
    if (estado === "oculto") return "Oculto";
    if (estado === "en_proceso") return "En proceso";

    return "Abierto";
  };

  const getModerationActions = (estado) => {
    if (estado === "cerrado") {
      return [
        {
          label: "Reabrir",
          nextEstado: "abierto",
          variant: "outline-success"
        },
        {
          label: "Ocultar",
          nextEstado: "oculto",
          variant: "outline-secondary"
        }
      ];
    }

    if (estado === "oculto") {
      return [
        {
          label: "Reabrir",
          nextEstado: "abierto",
          variant: "outline-success"
        }
      ];
    }

    if (estado === "abierto") {
      return [
        {
          label: "Cerrar",
          nextEstado: "cerrado",
          variant: "outline-warning"
        },
        {
          label: "Ocultar",
          nextEstado: "oculto",
          variant: "outline-secondary"
        }
      ];
    }

    return [];
  };

  const cambiarEstadoInteraccion = async (
    interaccionId,
    nuevoEstado
  ) => {
    try {
      setEstadoErrorGeneral("");
      setEstadoErroresPorId((prev) => ({
        ...prev,
        [interaccionId]: ""
      }));
      setAccionEstadoId(interaccionId);

      const token = localStorage.getItem("token");

      await axios.patch(
        `${API_BASE}/api/interacciones/${interaccionId}/estado`,
        { estado: nuevoEstado },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      await cargarInteracciones();
    } catch (error) {
      console.error("Error cambiando estado", error);

      const status = error.response?.status;
      const backendMessage =
        error.response?.data?.message ||
        error.response?.data?.error;

      if (status === 401) {
        setEstadoErroresPorId((prev) => ({
          ...prev,
          [interaccionId]:
            backendMessage ||
            "No autorizado para cambiar el estado."
        }));
      } else if (status === 403) {
        setEstadoErroresPorId((prev) => ({
          ...prev,
          [interaccionId]:
            backendMessage ||
            "No tienes permisos para moderar esta interacción."
        }));
      } else if (status === 400) {
        setEstadoErroresPorId((prev) => ({
          ...prev,
          [interaccionId]:
            backendMessage ||
            "Estado inválido para esta interacción."
        }));
      } else {
        setEstadoErrorGeneral(
          "No se pudo actualizar el estado de la interacción."
        );
      }
    } finally {
      setAccionEstadoId(null);
    }
  };

  const cambiarEstadoRespuesta = async (
    respuestaId,
    nuevoEstado
  ) => {
    try {
      setEstadoErrorGeneral("");
      setEstadoErroresRespuestaPorId((prev) => ({
        ...prev,
        [respuestaId]: ""
      }));
      setAccionEstadoRespuestaId(respuestaId);

      const token = localStorage.getItem("token");

      await axios.patch(
        `${API_BASE}/api/respuestas/${respuestaId}/estado`,
        { estado: nuevoEstado },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      await cargarInteracciones();
    } catch (error) {
      console.error("Error cambiando estado de respuesta", error);

      const status = error.response?.status;
      const backendMessage =
        error.response?.data?.message ||
        error.response?.data?.error;

      if ([400, 401, 403, 404].includes(status)) {
        setEstadoErroresRespuestaPorId((prev) => ({
          ...prev,
          [respuestaId]:
            backendMessage ||
            "No se pudo actualizar el estado de la respuesta."
        }));
      } else {
        setEstadoErrorGeneral(
          "No se pudo actualizar el estado de la respuesta."
        );
      }
    } finally {
      setAccionEstadoRespuestaId(null);
    }
  };

  // 🔍 FILTROS
  const listaFiltrada = lista.filter(item => {
    return (
      (filtroTipo === "todos" ||
        item.tipo === filtroTipo) &&

      (filtroCategoria === "todos" ||
        item.categoria === filtroCategoria)
    );
  });

  return (
    <Container>

      <h2>Interacción</h2>

      {/* ========================= */}
      {/* 📝 CREAR PUBLICACIÓN */}
      {/* ========================= */}

      <div style={{ marginBottom: "20px" }}>
        <h5>Crear publicación</h5>
      </div>

      {/* TIPO */}
      <div style={{ marginBottom: "10px" }}>
        <strong>Tipo:</strong>

        <Button
          variant={
            tipo === "necesidad"
              ? "primary"
              : "outline-primary"
          }
          style={{
            marginLeft: 10,
            ...getActiveStyle(tipo === "necesidad")
          }}
          onClick={() => setTipo("necesidad")}
        >
          Necesidad
        </Button>

        <Button
          variant={
            tipo === "ayuda"
              ? "success"
              : "outline-success"
          }
          style={{
            marginLeft: 10,
            ...getActiveStyle(tipo === "ayuda")
          }}
          onClick={() => setTipo("ayuda")}
        >
          Ayuda
        </Button>
      </div>

      {/* URGENCIA */}
      {tipo === "necesidad" && (
        <div style={{ marginBottom: "10px" }}>
          <strong>Urgencia:</strong>

          <Button
            variant={
              urgencia === "normal"
                ? "success"
                : "outline-success"
            }
            //style={{ marginLeft: 10 }}

            style={{
             marginLeft: 10,
             ...getActiveStyle(urgencia === "normal")
             }}

            onClick={() => setUrgencia("normal")}
          >
            🟢 Normal
          </Button>

          <Button
            variant={
              urgencia === "alta"
                ? "warning"
                : "outline-warning"
            }
           // style={{ marginLeft: 10 }}
           style={{
            marginLeft: 10,
           ...getActiveStyle(urgencia === "alta")
           }}

            onClick={() => setUrgencia("alta")}
          >
            🟠 Alta
          </Button>

          <Button
            variant={
              urgencia === "critica"
                ? "danger"
                : "outline-danger"
            }
            //style={{ marginLeft: 10 }}
               style={{
                marginLeft: 10,
                ...getActiveStyle(urgencia === "critica")
               }}

            onClick={() => setUrgencia("critica")}
          >
            🔴 Crítica
          </Button>
        </div>
      )}

      {/* CATEGORIA */}
      <div style={{ marginBottom: "10px" }}>
        <strong>Categoría:</strong>

        <Button
          variant={
            categoria === "servicio"
              ? "warning"
              : "outline-warning"
          }
          style={{
            marginLeft: 10,
            ...getActiveStyle(categoria === "servicio")
          }}
          onClick={() => setCategoria("servicio")}
        >
          🛠️ Servicio
        </Button>

        <Button
          variant={
            categoria === "producto"
              ? "info"
              : "outline-info"
          }
          style={{
            marginLeft: 10,
            ...getActiveStyle(categoria === "producto")
          }}
          onClick={() => setCategoria("producto")}
        >
          📦 Producto
        </Button>
      </div>

      {/* VISIBILIDAD */}
      <div style={{ marginBottom: "10px" }}>
        <strong>Visibilidad:</strong>

        <Button
          variant={
            visibilidad === "global"
              ? "dark"
              : "outline-dark"
          }
          style={{
            marginLeft: 10,
            ...getActiveStyle(visibilidad === "global")
          }}
          onClick={() => setVisibilidad("global")}
        >
          🌍 Global
        </Button>

        <Button
          variant={
            visibilidad === "comunidad"
              ? "secondary"
              : "outline-secondary"
          }
          style={{
            marginLeft: 10,
            ...getActiveStyle(
              visibilidad === "comunidad"
            )
          }}
          onClick={() => setVisibilidad("comunidad")}
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

      {/* BOTON */}
      <Button
        onClick={publicar}
        style={{ marginTop: "10px" }}
      >
        Publicar
      </Button>

     
 
{/* ========================= */}
{/* 🔍 FILTROS */}
{/* ========================= */}

<div style={{ marginTop: "30px", marginBottom: "15px" }}>
  
  <h5>Explorar</h5>

  {/* 🔵 FILTRO TIPO */}
  <div style={{ marginBottom: "10px" }}>
    
    <strong>Tipo:</strong>

    <Button
      variant={
        filtroTipo === "todos"
          ? "primary"
          : "outline-primary"
      }
      style={{
        marginLeft: 5,
        ...getActiveStyle(filtroTipo === "todos")
      }}
      onClick={() => {
        setFiltroTipo("todos");
        setFiltroCategoria("todos");
      }}
    >
      Todos
    </Button>

    <Button
      variant={
        filtroTipo === "necesidad"
          ? "primary"
          : "outline-primary"
      }
      style={{
        marginLeft: 5,
        ...getActiveStyle(
          filtroTipo === "necesidad"
        )
      }}
      onClick={() => setFiltroTipo("necesidad")}
    >
      Necesidades
    </Button>

    <Button
      variant={
        filtroTipo === "ayuda"
          ? "success"
          : "outline-success"
      }
      style={{
        marginLeft: 5,
        ...getActiveStyle(
          filtroTipo === "ayuda"
        )
      }}
      onClick={() => setFiltroTipo("ayuda")}
    >
      Ayuda
    </Button>

  </div>

  {/* 🟠 FILTRO CATEGORIA */}
  <div>

    <strong>Categoría:</strong>

    <Button
      variant={
        filtroCategoria === "servicio"
          ? "warning"
          : "outline-warning"
      }
      style={{
        marginLeft: 10,
        ...getActiveStyle(
          filtroCategoria === "servicio"
        )
      }}
      onClick={() => setFiltroCategoria("servicio")}
    >
      Servicios
    </Button>

    <Button
      variant={
        filtroCategoria === "producto"
          ? "info"
          : "outline-info"
      }
      style={{
        marginLeft: 5,
        ...getActiveStyle(
          filtroCategoria === "producto"
        )
      }}
      onClick={() => setFiltroCategoria("producto")}
    >
      Productos
    </Button>

  </div>

</div>

      {/* ========================= */}
      {/* 📋 LISTA */}
      {/* ========================= */}

      {estadoErrorGeneral && (
        <Alert
          variant="danger"
          style={{ marginTop: "15px" }}
        >
          {estadoErrorGeneral}
        </Alert>
      )}

      {listaFiltrada.map((item) => (

        <Card
          key={item.id}
          style={{
            marginTop: "15px",
            backgroundColor: getCardColor(item.tipo),

            // 🔥 borde urgencia crítica
            border:
              item.urgencia === "critica"
                ? "2px solid red"
                : "1px solid #ddd"
          }}
        >
          <Card.Body>

            {/* ALERTAS */}
            <div>

              {item.urgencia === "critica" && (
                <span style={{
                  color: "red",
                  fontWeight: "bold"
                }}>
                  🚨 URGENTE
                </span>
              )}

              {item.urgencia === "alta" && (
                <span style={{
                  color: "orange",
                  fontWeight: "bold"
                }}>
                  ⚠️ Alta prioridad
                </span>
              )}

            </div>

            {/* HEADER */}
            <strong>
              {item.tipo?.toUpperCase()}
              {" | "}
              {item.categoria?.toUpperCase()}
            </strong>

            {/* USUARIO */}
            <div
              style={{
                fontSize: "13px",
                color: "#555"
              }}
            >
              👤 {item.usuario?.username}
              {" - "}
              🏘️ {item.comunidad?.nombre_comunidad}
            </div>

            {/* ESTADO SOCIAL */}
            <div>

              {item.respuestas?.length === 0 && (
                <span style={{ color: "red" }}>
                  🆘 Sin respuestas
                </span>
              )}

              {item.respuestas?.length > 0 && (
                <span style={{ color: "green" }}>
                  🤝 Con ayuda
                </span>
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
              <small
                style={{
                  color: "#555",
                  fontWeight: "bold"
                }}
              >
                Estado: {getEstadoLabel(item.estado)}
              </small>
            </div>

            {/* URGENCIA TEXTO */}
            <div>
              <small
                style={{
                  color:
                    item.urgencia === "critica"
                      ? "red"
                      : item.urgencia === "alta"
                      ? "orange"
                      : "green"
                }}
              >
                ⚡{" "}
                {item.urgencia?.toUpperCase()
                  || "NORMAL"}
              </small>
            </div>

            {/* TEXTO */}
            <p style={{ marginTop: "10px" }}>
              {item.descripcion}
            </p>

            {puedeModerarInteraccion(item) &&
              getModerationActions(item.estado).length > 0 && (
                <div style={{ marginBottom: "10px" }}>
                  {getModerationActions(item.estado).map(
                    (action) => (
                      <Button
                        key={`${item.id}-${action.nextEstado}`}
                        size="sm"
                        variant={action.variant}
                        style={{
                          marginRight: "8px",
                          marginBottom: "8px"
                        }}
                        disabled={accionEstadoId === item.id}
                        onClick={() =>
                          cambiarEstadoInteraccion(
                            item.id,
                            action.nextEstado
                          )
                        }
                      >
                        {action.label}
                      </Button>
                    )
                  )}
                </div>
              )}

            {estadoErroresPorId[item.id] && (
              <div
                style={{
                  color: "#b02a37",
                  fontSize: "14px",
                  marginBottom: "10px"
                }}
              >
                {estadoErroresPorId[item.id]}
              </div>
            )}

            {/* RESPUESTAS */}
            {item.respuestas?.map((r) => (
              <div
                key={r.id}
                style={{
                  fontSize: "14px",
                  color: "gray",
                  marginBottom: "8px"
                }}
              >
                <p style={{ marginBottom: "4px" }}>
                  ↳
                  {" "}
                  <strong>
                    {r.usuario?.username}:
                  </strong>
                  {" "}
                  {r.mensaje}
                  {r.estado === "oculta" && (
                    <small style={{ marginLeft: "8px", color: "#b02a37" }}>
                      Oculta
                    </small>
                  )}
                </p>

                {puedeModerarInteraccion(item) && (
                  <div style={{ marginBottom: "6px" }}>
                    <Button
                      size="sm"
                      variant={r.estado === "oculta" ? "outline-success" : "outline-secondary"}
                      disabled={accionEstadoRespuestaId === r.id}
                      onClick={() =>
                        cambiarEstadoRespuesta(
                          r.id,
                          r.estado === "oculta" ? "activa" : "oculta"
                        )
                      }
                    >
                      {r.estado === "oculta" ? "Activar" : "Ocultar"}
                    </Button>
                  </div>
                )}

                {estadoErroresRespuestaPorId[r.id] && (
                  <div style={{ color: "#b02a37", fontSize: "13px" }}>
                    {estadoErroresRespuestaPorId[r.id]}
                  </div>
                )}
              </div>
            ))}

            {/* INPUT RESPUESTA */}
            <Form.Control
              placeholder="Responder..."
              onKeyDown={(e) => {

                if (e.key === "Enter") {

                  responder(
                    item.id,
                    e.target.value
                  );

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
