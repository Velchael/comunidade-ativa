import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import { Container, Button, Form, Card, Alert } from "react-bootstrap";
import axios from "axios";
import { UserContext } from "../UserContext";

export default function Interacciones() {
  const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3000";
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
        "Não foi possível carregar as interações."
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

    const comunidadIdActual = user.comunidadId || user.comunidad_id;

    if (!comunidadIdActual) {
      alert("Usuário sem comunidade atribuída");
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
    setLista((prev) => [nueva, ...prev]);

    try {
      const token = localStorage.getItem("token");

      await axios.post(
        `${API_BASE}/api/interacciones`,
        {
          user_id: user.id,
          comunidad_id: comunidadIdActual,
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
      setUrgencia("normal");

      cargarInteracciones();
    } catch (error) {
      console.error("Error publicando", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        alert(error.response?.data?.message || error.response?.data?.error || "Não autorizado");
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
        alert(error.response?.data?.message || error.response?.data?.error || "Não autorizado");
      }
    }
  };

  // 🎨 ESTILO BOTONES ACTIVOS
  const getActiveStyle = (activo) => {
    return activo
      ? {
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
  const getCardColor = (tipoActual) => {
    if (tipoActual === "necesidad") return "#fffdf8";
    if (tipoActual === "ayuda") return "#fbfffc";

    return "#fff";
  };

  const getEstadoLabel = (estado) => {
    if (estado === "cerrado") return "Fechado";
    if (estado === "oculto") return "Oculto";
    if (estado === "en_proceso") return "Em andamento";

    return "Aberto";
  };

  const getTipoLabel = (tipoActual) => {
    if (tipoActual === "necesidad") return "NECESSIDADE";
    if (tipoActual === "ayuda") return "AJUDA";

    return String(tipoActual || "").toUpperCase();
  };

  const getCategoriaLabel = (categoriaActual) => {
    if (categoriaActual === "servicio") return "SERVIÇO";
    if (categoriaActual === "producto") return "PRODUTO";

    return String(categoriaActual || "").toUpperCase();
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
          label: "Fechar",
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
            "Não autorizado para alterar o estado."
        }));
      } else if (status === 403) {
        setEstadoErroresPorId((prev) => ({
          ...prev,
          [interaccionId]:
            backendMessage ||
            "Você não tem permissão para moderar esta interação."
        }));
      } else if (status === 400) {
        setEstadoErroresPorId((prev) => ({
          ...prev,
          [interaccionId]:
            backendMessage ||
            "Estado inválido para esta interação."
        }));
      } else {
        setEstadoErrorGeneral(
          "Não foi possível atualizar o estado da interação."
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
            "Não foi possível atualizar o estado da resposta."
        }));
      } else {
        setEstadoErrorGeneral(
          "Não foi possível atualizar o estado da resposta."
        );
      }
    } finally {
      setAccionEstadoRespuestaId(null);
    }
  };

  // 🔍 FILTROS
  const listaFiltrada = lista.filter((item) => {
    return (
      (filtroTipo === "todos" ||
        item.tipo === filtroTipo) &&
      (filtroCategoria === "todos" ||
        item.categoria === filtroCategoria)
    );
  });

  return (
    <Container className="interacciones-screen">
      <div className="interacciones-header">
        <h2 className="interacciones-title">Interação</h2>
        <p className="interacciones-subtitle">
          Publique pedidos, ofereça ajuda e acompanhe respostas da comunidade.
        </p>
      </div>

      <Card className="interacciones-panel publicar-panel">
        <Card.Body>
          <div className="panel-heading">
            <span className="panel-eyebrow">Nova interação</span>
            <h5 className="panel-title">Criar publicação</h5>
          </div>

          <div className="composer-row">
            <strong className="control-label">Tipo</strong>
            <div className="control-actions">
              <Button
                variant={
                  tipo === "necesidad"
                    ? "primary"
                    : "outline-primary"
                }
                className="chip-button"
                style={getActiveStyle(tipo === "necesidad")}
                onClick={() => setTipo("necesidad")}
              >
                Necessidade
              </Button>

              <Button
                variant={
                  tipo === "ayuda"
                    ? "success"
                    : "outline-success"
                }
                className="chip-button"
                style={getActiveStyle(tipo === "ayuda")}
                onClick={() => setTipo("ayuda")}
              >
                Ajuda
              </Button>
            </div>
          </div>

          {tipo === "necesidad" && (
            <div className="composer-row">
              <strong className="control-label">Urgência</strong>
              <div className="control-actions">
                <Button
                  variant={
                    urgencia === "normal"
                      ? "success"
                      : "outline-success"
                  }
                  className="chip-button"
                  style={getActiveStyle(urgencia === "normal")}
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
                  className="chip-button"
                  style={getActiveStyle(urgencia === "alta")}
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
                  className="chip-button"
                  style={getActiveStyle(urgencia === "critica")}
                  onClick={() => setUrgencia("critica")}
                >
                  🔴 Crítica
                </Button>
              </div>
            </div>
          )}

          <div className="composer-row">
            <strong className="control-label">Categoria</strong>
            <div className="control-actions">
              <Button
                variant={
                  categoria === "servicio"
                    ? "warning"
                    : "outline-warning"
                }
                className="chip-button"
                style={getActiveStyle(categoria === "servicio")}
                onClick={() => setCategoria("servicio")}
              >
                🛠️ Serviço
              </Button>

              <Button
                variant={
                  categoria === "producto"
                    ? "info"
                    : "outline-info"
                }
                className="chip-button"
                style={getActiveStyle(categoria === "producto")}
                onClick={() => setCategoria("producto")}
              >
                📦 Produto
              </Button>
            </div>
          </div>

          <div className="composer-row">
            <strong className="control-label">Visibilidade</strong>
            <div className="control-actions">
              <Button
                variant={
                  visibilidad === "global"
                    ? "dark"
                    : "outline-dark"
                }
                className="chip-button"
                style={getActiveStyle(visibilidad === "global")}
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
                className="chip-button"
                style={getActiveStyle(visibilidad === "comunidad")}
                onClick={() => setVisibilidad("comunidad")}
              >
                🏘️ Comunidade
              </Button>
            </div>
          </div>

          <Form.Control
            className="composer-input"
            placeholder="Do que você precisa ou o que pode oferecer?"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />

          <div className="composer-actions">
            <Button
              onClick={publicar}
              className="composer-submit"
            >
              Publicar
            </Button>
          </div>
        </Card.Body>
      </Card>

      <Card className="interacciones-panel filtros-panel">
        <Card.Body>
          <div className="panel-heading filtros-heading">
            <h5 className="panel-title">Explorar</h5>
            <span className="filtros-resumen">
              {listaFiltrada.length} interaç{listaFiltrada.length === 1 ? "ão" : "ões"}
            </span>
          </div>

          <div className="filter-row compact">
            <strong className="control-label">Tipo</strong>
            <div className="control-actions">
              <Button
                variant={
                  filtroTipo === "todos"
                    ? "primary"
                    : "outline-primary"
                }
                className="chip-button compact"
                style={getActiveStyle(filtroTipo === "todos")}
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
                className="chip-button compact"
                style={getActiveStyle(filtroTipo === "necesidad")}
                onClick={() => setFiltroTipo("necesidad")}
              >
                Necessidades
              </Button>

              <Button
                variant={
                  filtroTipo === "ayuda"
                    ? "success"
                    : "outline-success"
                }
                className="chip-button compact"
                style={getActiveStyle(filtroTipo === "ayuda")}
                onClick={() => setFiltroTipo("ayuda")}
              >
                Ajuda
              </Button>
            </div>
          </div>

          <div className="filter-row compact">
            <strong className="control-label">Categoria</strong>
            <div className="control-actions">
              <Button
                variant={
                  filtroCategoria === "servicio"
                    ? "warning"
                    : "outline-warning"
                }
                className="chip-button compact"
                style={getActiveStyle(filtroCategoria === "servicio")}
                onClick={() => setFiltroCategoria("servicio")}
              >
                Serviços
              </Button>

              <Button
                variant={
                  filtroCategoria === "producto"
                    ? "info"
                    : "outline-info"
                }
                className="chip-button compact"
                style={getActiveStyle(filtroCategoria === "producto")}
                onClick={() => setFiltroCategoria("producto")}
              >
                Produtos
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

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
          className="interaccion-card"
          style={{
            backgroundColor: getCardColor(item.tipo),
            border:
              item.urgencia === "critica"
                ? "2px solid #dc3545"
                : "1px solid rgba(202, 147, 43, 0.18)"
          }}
        >
          <Card.Body>
            <div className="interaccion-alerts">
              {item.urgencia === "critica" && (
                <span className="status-pill danger">
                  🚨 URGENTE
                </span>
              )}

              {item.urgencia === "alta" && (
                <span className="status-pill warning">
                  ⚠️ Alta prioridade
                </span>
              )}
            </div>

            <div className="interaccion-topline">
              <strong className="interaccion-kind">
                {getTipoLabel(item.tipo)}
                {" | "}
                {getCategoriaLabel(item.categoria)}
              </strong>
              <span className="status-pill subtle">
                {item.visibilidad === "global"
                  ? "🌍 Global"
                  : "🏘️ Comunidade"}
              </span>
            </div>

            <div className="interaccion-meta">
              👤 {item.usuario?.username}
              {" - "}
              🏘️ {item.comunidad?.nombre_comunidad}
            </div>

            <div className="interaccion-support">
              {item.respuestas?.length === 0 && (
                <span className="support-status empty">
                  🆘 Sem respostas
                </span>
              )}

              {item.respuestas?.length > 0 && (
                <span className="support-status active">
                  🤝 Com ajuda
                </span>
              )}
            </div>

            <div className="interaccion-tags">
              <small className="meta-tag">
                Estado: {getEstadoLabel(item.estado)}
              </small>
              <small
                className="meta-tag urgency-tag"
                style={{
                  color:
                    item.urgencia === "critica"
                      ? "#dc3545"
                      : item.urgencia === "alta"
                      ? "#c97f10"
                      : "#2f8f4e"
                }}
              >
                ⚡ {item.urgencia?.toUpperCase() || "NORMAL"}
              </small>
            </div>

            <p className="interaccion-body">
              {item.descripcion}
            </p>

            {puedeModerarInteraccion(item) &&
              getModerationActions(item.estado).length > 0 && (
                <div className="moderation-actions">
                  {getModerationActions(item.estado).map(
                    (action) => (
                      <Button
                        key={`${item.id}-${action.nextEstado}`}
                        size="sm"
                        variant={action.variant}
                        className="moderation-button"
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
              <div className="inline-error">
                {estadoErroresPorId[item.id]}
              </div>
            )}

            {item.respuestas?.length > 0 && (
              <div className="respuestas-list">
                {item.respuestas.map((r) => (
                  <div
                    key={r.id}
                    className={`respuesta-item ${r.estado === "oculta" ? "is-hidden" : ""}`}
                  >
                    <div className="respuesta-content">
                      <span className="respuesta-arrow">↳</span>
                      <p className="respuesta-text">
                        <strong>
                          {r.usuario?.username}:
                        </strong>
                        {" "}
                        {r.mensaje}
                        {r.estado === "oculta" && (
                          <small className="respuesta-hidden-label">
                            Oculta
                          </small>
                        )}
                      </p>
                    </div>

                    {puedeModerarInteraccion(item) && (
                      <div className="respuesta-actions">
                        <Button
                          size="sm"
                          variant={r.estado === "oculta" ? "outline-success" : "outline-secondary"}
                          className="moderation-button"
                          disabled={accionEstadoRespuestaId === r.id}
                          onClick={() =>
                            cambiarEstadoRespuesta(
                              r.id,
                              r.estado === "oculta" ? "activa" : "oculta"
                            )
                          }
                        >
                          {r.estado === "oculta" ? "Ativar" : "Ocultar"}
                        </Button>
                      </div>
                    )}

                    {estadoErroresRespuestaPorId[r.id] && (
                      <div className="inline-error small">
                        {estadoErroresRespuestaPorId[r.id]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Form.Control
              className="respuesta-input"
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
