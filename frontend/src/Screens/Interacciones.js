import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import { Container, Button, Form, Card, Alert } from "react-bootstrap";
import axios from "axios";
import { UserContext } from "../UserContext";
import PrimarySelectorBar from "../components/PrimarySelectorBar";
import UserAvatar from "../components/UserAvatar";

const TIPO_OPTIONS = [
  { value: "necesidad", label: "Necessidade" },
  { value: "ayuda", label: "Ajuda" }
];

const CATEGORIA_OPTIONS = [
  { value: "servicio", label: "Serviço" },
  { value: "producto", label: "Produto" }
];

const VISIBILIDAD_OPTIONS = [
  { value: "global", label: "Global" },
  { value: "comunidad", label: "Comunidade" }
];

const FILTER_TIPO_OPTIONS = [
  { value: "todos", label: "Todos" },
  ...TIPO_OPTIONS
];

const FILTER_CATEGORIA_OPTIONS = [
  { value: "todos", label: "Todas" },
  ...CATEGORIA_OPTIONS
];

const FILTER_VISIBILIDAD_OPTIONS = [
  { value: "todas", label: "Todas" },
  ...VISIBILIDAD_OPTIONS
];

const MAX_INTERACTION_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_INTERACTION_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const normalizeCategoria = (categoriaActual) =>
  categoriaActual === "serviço" ? "servicio" : categoriaActual;

const getOptionLabel = (options, value) =>
  options.find((option) => option.value === value)?.label || String(value || "");

const isHttpsUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch (_error) {
    return false;
  }
};

export default function Interacciones() {
  const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3000";
  const pollingIntervalRef = useRef(null);
  const isFetchingRef = useRef(false);
  const imageInputRef = useRef(null);
  const imagePreviewUrlRef = useRef("");

  const { user } = useContext(UserContext);
  const userId = user?.id || null;
  const comunidadId = user?.comunidadId || user?.comunidad_id || null;

  const [tipo, setTipo] = useState("ayuda");
  const [categoria, setCategoria] = useState("servicio");
  const [texto, setTexto] = useState("");
  const [visibilidad, setVisibilidad] = useState("comunidad");
  const [lista, setLista] = useState([]);
  const [estadoErrorGeneral, setEstadoErrorGeneral] = useState("");
  const [estadoErroresPorId, setEstadoErroresPorId] = useState({});
  const [estadoErroresRespuestaPorId, setEstadoErroresRespuestaPorId] = useState({});
  const [accionEstadoRespuestaId, setAccionEstadoRespuestaId] = useState(null);
  const [accionEstadoId, setAccionEstadoId] = useState(null);
  const [interaccionesAuth, setInteraccionesAuth] = useState(null);
  const [respuestasExpandidasPorId, setRespuestasExpandidasPorId] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [publishError, setPublishError] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [filtroVisibilidad, setFiltroVisibilidad] = useState("comunidad");
  const [selectorAberto, setSelectorAberto] = useState(null);

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

  const toggleRespuestas = (interaccionId) => {
    setRespuestasExpandidasPorId((prev) => ({
      ...prev,
      [interaccionId]: !prev[interaccionId]
    }));
  };

  const clearSelectedImage = useCallback(() => {
    setSelectedImage(null);
    setImageError("");

    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = "";
    }

    setImagePreviewUrl("");

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }, []);

  useEffect(() => () => {
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = "";
    }
  }, []);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    setImageError("");
    setPublishError("");

    if (!file) {
      clearSelectedImage();
      return;
    }

    if (!ALLOWED_INTERACTION_IMAGE_TYPES.has(file.type)) {
      clearSelectedImage();
      setImageError("Formato não suportado. Use JPG, PNG ou WebP.");
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_INTERACTION_IMAGE_SIZE) {
      clearSelectedImage();
      setImageError("A imagem deve ter no máximo 5 MB.");
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
    }

    imagePreviewUrlRef.current = nextPreviewUrl;
    setSelectedImage(file);
    setImagePreviewUrl(nextPreviewUrl);
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
    if (!texto || !user || isPublishing) return;
    if (imageError) return;

    const comunidadIdActual = user.comunidadId || user.comunidad_id;

    if (!comunidadIdActual) {
      alert("Usuário sem comunidade atribuída");
      return;
    }

    setPublishError("");
    setImageError("");
    setIsPublishing(true);

    if (!selectedImage) {
      const nueva = {
        id: Date.now(),
        tipo,
        categoria,
        descripcion: texto,
        visibilidad,
        imagen_url: null,
        usuario: {
          id: user.id,
          username: user.username,
          foto_perfil: user.foto_perfil || null
        },
        comunidad: {
          nombre_comunidad: user.comunidadNombre
        },
        respuestas: []
      };

      // UI optimista
      setLista((prev) => [nueva, ...prev]);
    }

    try {
      const token = localStorage.getItem("token");
      const headers = {
        Authorization: `Bearer ${token}`
      };

      if (selectedImage) {
        const formData = new FormData();
        formData.append("comunidad_id", String(comunidadIdActual));
        formData.append("tipo", tipo);
        formData.append("categoria", categoria);
        formData.append("descripcion", texto);
        formData.append("visibilidad", visibilidad);
        formData.append("imagen", selectedImage);

        await axios.post(
          `${API_BASE}/api/interacciones`,
          formData,
          { headers }
        );
      } else {
        await axios.post(
          `${API_BASE}/api/interacciones`,
          {
            user_id: user.id,
            comunidad_id: comunidadIdActual,
            tipo,
            categoria,
            descripcion: texto,
            visibilidad
          },
          {
            headers
          }
        );
      }

      setTexto("");
      setTipo("ayuda");
      setVisibilidad("comunidad");
      clearSelectedImage();

      await cargarInteracciones();
    } catch (error) {
      console.error("Error publicando", error);
      const backendMessage =
        error.response?.data?.message ||
        error.response?.data?.error;

      setPublishError(
        backendMessage || "Não foi possível publicar agora. Tente novamente."
      );

      if (error.response?.status === 401 || error.response?.status === 403) {
        alert(backendMessage || "Não autorizado");
      }
    } finally {
      setIsPublishing(false);
    }
  };

  // 💬 RESPONDER
  const responder = async (id, mensaje) => {
    if (!mensaje || !user) return;

    try {
      const token = localStorage.getItem("token");

      const response = await axios.post(
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

      const createdResponse = response.data || {};
      const optimisticResponse = {
        ...createdResponse,
        id: createdResponse.id || Date.now(),
        interaccion_id: createdResponse.interaccion_id || id,
        user_id: createdResponse.user_id || user.id,
        mensaje: createdResponse.mensaje || mensaje,
        estado: createdResponse.estado || "activa",
        usuario: {
          id: createdResponse.usuario?.id || user.id,
          username: createdResponse.usuario?.username || user.username,
          foto_perfil:
            createdResponse.usuario?.foto_perfil ||
            user.foto_perfil ||
            null
        }
      };

      setLista((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                respuestas: [
                  ...(item.respuestas || []),
                  optimisticResponse
                ]
              }
            : item
        )
      );
      cargarInteracciones();
    } catch (error) {
      console.error("Error respondiendo", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        alert(error.response?.data?.message || error.response?.data?.error || "Não autorizado");
      }
    }
  };

  const handlePrimarySelect = (field, value) => {
    if (field === "tipo") setTipo(value);
    if (field === "categoria") setCategoria(value);
    if (field === "visibilidad") setVisibilidad(value);
    if (field === "filtroTipo") setFiltroTipo(value);
    if (field === "filtroCategoria") setFiltroCategoria(value);
    if (field === "filtroVisibilidad") setFiltroVisibilidad(value);
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
    const categoriaNormalizada = normalizeCategoria(categoriaActual);

    if (categoriaNormalizada === "servicio") return "SERVIÇO";
    if (categoriaNormalizada === "producto") return "PRODUTO";

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
  const hasActiveFilters =
    filtroTipo !== "todos" ||
    filtroCategoria !== "todos" ||
    filtroVisibilidad !== "comunidad";

  const listaFiltrada = lista.filter((item) => {
    return (
      (filtroTipo === "todos" ||
        item.tipo === filtroTipo) &&
      (filtroCategoria === "todos" ||
        normalizeCategoria(item.categoria) === filtroCategoria) &&
      (filtroVisibilidad === "todas" ||
        item.visibilidad === filtroVisibilidad)
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
            <h5 className="panel-title">Nova publicação</h5>
          </div>

          <PrimarySelectorBar
            mode="form"
            ariaLabel="Dados principais da publicação"
            openKey={selectorAberto}
            onOpenChange={setSelectorAberto}
            onSelect={handlePrimarySelect}
            items={[
              {
                id: "tipo",
                label: "Tipo",
                value: tipo,
                valueLabel: getOptionLabel(TIPO_OPTIONS, tipo),
                options: TIPO_OPTIONS
              },
              {
                id: "categoria",
                label: "Categoria",
                value: categoria,
                valueLabel: getOptionLabel(CATEGORIA_OPTIONS, categoria),
                options: CATEGORIA_OPTIONS
              },
              {
                id: "visibilidad",
                label: "Visibilidade",
                value: visibilidad,
                valueLabel: getOptionLabel(VISIBILIDAD_OPTIONS, visibilidad),
                options: VISIBILIDAD_OPTIONS,
                align: "end"
              }
            ]}
          />

          <Form.Control
            className="composer-input"
            placeholder="Do que você precisa ou o que pode oferecer?"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />

          <div className="interaction-image-picker">
            <div className="interaction-image-picker__controls">
              <Form.Control
                ref={imageInputRef}
                id="interaction-image-input"
                type="file"
                className="interaction-image-picker__input"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
              />
              <Form.Label
                htmlFor="interaction-image-input"
                className="interaction-image-picker__button"
              >
                Adicionar imagem
              </Form.Label>
              {selectedImage && (
                <Button
                  type="button"
                  variant="link"
                  className="interaction-image-picker__remove"
                  onClick={clearSelectedImage}
                >
                  Remover imagem
                </Button>
              )}
            </div>

            {imageError && (
              <div className="inline-error interaction-image-picker__error">
                {imageError}
              </div>
            )}

            {imagePreviewUrl && (
              <div className="interaction-image-preview">
                <img
                  src={imagePreviewUrl}
                  alt="Prévia da imagem selecionada"
                />
              </div>
            )}
          </div>

          {publishError && (
            <div className="inline-error publish-error">
              {publishError}
            </div>
          )}

          <div className="composer-actions">
            <Button
              onClick={publicar}
              className="composer-submit"
              disabled={isPublishing || !texto.trim()}
            >
              {isPublishing ? "Publicando..." : "Publicar"}
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

          {/* Filtros independentes: apenas Limpar filtros restaura os três campos. */}
          <PrimarySelectorBar
            mode="filter"
            ariaLabel="Filtros de exploração"
            openKey={selectorAberto}
            onOpenChange={setSelectorAberto}
            onSelect={handlePrimarySelect}
            hasActiveFilters={hasActiveFilters}
            onClear={() => {
              setFiltroTipo("todos");
              setFiltroCategoria("todos");
              setFiltroVisibilidad("comunidad");
              setSelectorAberto(null);
            }}
            items={[
              {
                id: "filtroTipo",
                label: "Tipo",
                value: filtroTipo,
                valueLabel: getOptionLabel(FILTER_TIPO_OPTIONS, filtroTipo),
                options: FILTER_TIPO_OPTIONS
              },
              {
                id: "filtroCategoria",
                label: "Categoria",
                value: filtroCategoria,
                valueLabel: getOptionLabel(FILTER_CATEGORIA_OPTIONS, filtroCategoria),
                options: FILTER_CATEGORIA_OPTIONS
              },
              {
                id: "filtroVisibilidad",
                label: "Visibilidade",
                value: filtroVisibilidad,
                valueLabel: getOptionLabel(FILTER_VISIBILIDAD_OPTIONS, filtroVisibilidad),
                options: FILTER_VISIBILIDAD_OPTIONS,
                align: "end"
              }
            ]}
          />
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
            border: "1px solid rgba(202, 147, 43, 0.18)"
          }}
        >
          <Card.Body>
            
            <div className="interaccion-topline">
              <strong className="interaccion-kind">
                {getTipoLabel(item.tipo)}
                {" | "}
                {getCategoriaLabel(item.categoria)}
              </strong>
              <div className="interaction-badge-group" aria-label="Resumo da publicação">
                <span className="interaction-badge interaction-badge--visibility">
                  {item.visibilidad === "global"
                    ? "🌍 Global"
                    : "🏘️ Comunidade"}
                </span>
                {Array.isArray(item.respuestas) && item.respuestas.length > 0 ? (
                  <span className="interaction-badge interaction-badge--help">
                    🤝 Com ajuda
                  </span>
                ) : (
                  <span className="interaction-badge interaction-badge--no-help">
                    🆘 Sem respostas
                  </span>
                )}
                <span className="interaction-badge interaction-badge--state">
                  Estado: {getEstadoLabel(item.estado)}
                </span>
              </div>
            </div>

            <div className="interaccion-author">
              <UserAvatar
                src={item.usuario?.foto_perfil}
                name={item.usuario?.username}
                size="publication"
              />
              <div className="interaccion-author-text">
                <strong className="interaccion-author-name">
                  {item.usuario?.username || "Usuário"}
                </strong>
                <span className="interaccion-meta">
                  🏘️ {item.comunidad?.nombre_comunidad}
                </span>
              </div>
            </div>

            <p className="interaccion-body">
              {item.descripcion}
            </p>

            {isHttpsUrl(item.imagen_url) && (
              <div className="interaccion-media">
                <img
                  src={item.imagen_url}
                  alt="Imagem da publicação"
                  loading="lazy"
                />
              </div>
            )}

            {(() => {
              const respuestas = Array.isArray(item.respuestas)
                ? item.respuestas
                : [];
              const respuestasCount = respuestas.length;
              const respuestasExpandidas = respuestasExpandidasPorId[item.id] === true;
              const respuestasListId = `respuestas-list-${item.id}`;
              const moderationActions = puedeModerarInteraccion(item)
                ? getModerationActions(item.estado)
                : [];
              const hasActions = moderationActions.length > 0 || respuestasCount > 0;

              return (
                <>
                  {hasActions && (
                    <div className="interaction-actions-row">
                      {moderationActions.map((action) => (
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
                      ))}

                      {respuestasCount > 0 && (
                        <Button
                          type="button"
                          variant="link"
                          className="respuestas-toggle"
                          aria-expanded={respuestasExpandidas}
                          aria-controls={respuestasListId}
                          onClick={() => toggleRespuestas(item.id)}
                        >
                          💬 {respuestasExpandidas ? "Ocultar respostas" : "Ver respostas"} ({respuestasCount})
                        </Button>
                      )}
                    </div>
                  )}

                  {estadoErroresPorId[item.id] && (
                    <div className="inline-error">
                      {estadoErroresPorId[item.id]}
                    </div>
                  )}

                  {respuestasCount > 0 && respuestasExpandidas && (
                    <div id={respuestasListId} className="respuestas-list">
                      {respuestas.map((r) => (
                        <div
                          key={r.id}
                          className={`respuesta-item ${r.estado === "oculta" ? "is-hidden" : ""}`}
                        >
                          <div className="respuesta-row">
                            <span className="respuesta-arrow">↳</span>
                            <UserAvatar
                              src={r.usuario?.foto_perfil}
                              name={r.usuario?.username}
                              size="reply"
                            />
                            <div className="respuesta-content">
                              <strong className="respuesta-author-name">
                                {r.usuario?.username || "Usuário"}
                              </strong>
                              <p className="respuesta-text">
                                {r.mensaje}
                              </p>
                              {r.estado === "oculta" && (
                                <small className="respuesta-hidden-label">
                                  Oculta
                                </small>
                              )}
                            </div>
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
                </>
              );
            })()}

            <Form
              className="respuesta-form"
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.respuesta;
                const mensaje = input.value.trim();

                if (!mensaje) return;

                responder(item.id, mensaje);
                input.value = "";
              }}
            >
              <Form.Control
                name="respuesta"
                className="respuesta-input"
                placeholder="Responder..."
                enterKeyHint="send"
                autoComplete="off"
              />
              <Button type="submit" className="respuesta-submit">
                Enviar
              </Button>
            </Form>
          </Card.Body>
        </Card>
      ))}
    </Container>
  );
}
