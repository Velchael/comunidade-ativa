import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { Link, useNavigate, useParams } from "react-router-dom";
import UserAvatar from "../components/UserAvatar";
import { UserContext } from "../UserContext";
import authClient from "../services/authClient";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3000";
export const MAX_MESSAGE_LENGTH = 2000;

export const formatConversationTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfDate) / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  if (diffDays === 1) return "Ontem";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit"
  });
};

export const mergeMessagesById = (currentMessages, nextMessages) => {
  const byId = new Map();
  [...currentMessages, ...nextMessages].forEach((message) => {
    if (message?.id) byId.set(Number(message.id), message);
  });

  return [...byId.values()].sort((first, second) => Number(first.id) - Number(second.id));
};

const getMessagePreview = (conversa) => {
  const corpo = conversa?.ultimo_mensagem?.corpo;
  return typeof corpo === "string" && corpo.trim()
    ? corpo.trim()
    : "Sem mensagens ainda.";
};

const getOtherParticipantName = (conversa) => (
  conversa?.outro_participante?.username || "Usuário"
);

const isNearBottom = (element) => {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight < 120;
};

const scrollToBottom = (element) => {
  if (!element) return;
  element.scrollTop = element.scrollHeight;
};

const useVisiblePolling = ({ enabled, delay, onTick }) => {
  const intervalRef = useRef(null);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (!enabled) return undefined;

    const stop = () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const start = () => {
      if (document.visibilityState !== "visible" || intervalRef.current !== null) return;
      intervalRef.current = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          onTickRef.current?.();
        }
      }, delay);
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        onTickRef.current?.();
        start();
        return;
      }

      stop();
    };

    start();
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      stop();
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [delay, enabled]);
};

export function ConversasList() {
  const navigate = useNavigate();
  const pollingInFlightRef = useRef(false);
  const [conversas, setConversas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const carregarConversas = useCallback(async ({ quiet = false } = {}) => {
    if (pollingInFlightRef.current) return;

    try {
      pollingInFlightRef.current = true;
      if (!quiet) setLoading(true);
      setError("");

      const response = await authClient.request({
        method: "get",
        url: `${API_BASE}/api/conversas`
      });

      setConversas(Array.isArray(response.data?.items) ? response.data.items : []);
    } catch (requestError) {
      console.error("Erro ao carregar conversas", requestError);
      setError("Não foi possível carregar as conversas.");
    } finally {
      pollingInFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarConversas();
  }, [carregarConversas]);

  useVisiblePolling({
    enabled: true,
    delay: 30000,
    onTick: () => carregarConversas({ quiet: true })
  });

  return (
    <section className="conversas-screen" aria-labelledby="conversas-title">
      <div className="conversas-heading">
        <h2 id="conversas-title">Conversas</h2>
      </div>

      {error && (
        <Alert variant="danger">
          {error}
        </Alert>
      )}

      {loading && conversas.length === 0 && (
        <div className="conversas-loading">
          <Spinner size="sm" animation="border" role="status" />
          <span>Carregando conversas...</span>
        </div>
      )}

      {!loading && !error && conversas.length === 0 && (
        <div className="conversas-empty">
          <p>Você ainda não tem conversas.</p>
          <small>As conversas podem começar a partir de uma interação.</small>
        </div>
      )}

      {conversas.length > 0 && (
        <div className="conversas-list" aria-label="Lista de conversas">
          {conversas.map((conversa) => {
            const participantName = getOtherParticipantName(conversa);
            const unreadCount = Number(conversa.unread_count) || 0;

            return (
              <button
                key={conversa.id}
                type="button"
                className={`conversa-list-item ${unreadCount > 0 ? "is-unread" : ""}`}
                onClick={() => navigate(`/conversas/${conversa.id}`)}
              >
                <UserAvatar
                  src={conversa.outro_participante?.foto_perfil}
                  name={participantName}
                  size="publication"
                />
                <span className="conversa-list-item__main">
                  <strong>{participantName}</strong>
                  <span>{getMessagePreview(conversa)}</span>
                  {conversa.can_send === false && (
                    <small>Não é possível enviar novas mensagens.</small>
                  )}
                </span>
                <span className="conversa-list-item__meta">
                  <time dateTime={conversa.last_message_at || undefined}>
                    {formatConversationTime(conversa.last_message_at)}
                  </time>
                  {unreadCount > 0 && (
                    <span className="conversa-unread">
                      {unreadCount} não lida{unreadCount === 1 ? "" : "s"}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function ConversaDetail() {
  const { id } = useParams();
  const { user } = useContext(UserContext);
  const userId = Number(user?.id || 0);
  const messagesEndRef = useRef(null);
  const messagesPanelRef = useRef(null);
  const pollingInFlightRef = useRef(false);
  const readPatchInFlightRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  const activeConversaIdRef = useRef(null);

  const [conversa, setConversa] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [canSend, setCanSend] = useState(null);

  const oldestId = messages.length > 0 ? Number(messages[0].id) : null;
  const newestId = messages.length > 0 ? Number(messages[messages.length - 1].id) : null;
  const participantName = getOtherParticipantName(conversa);
  const isCurrentConversa = useCallback(() => (
    String(activeConversaIdRef.current || "") === String(id || "")
  ), [id]);

  const markAsRead = useCallback(async () => {
    if (!isCurrentConversa() || readPatchInFlightRef.current) return;

    try {
      readPatchInFlightRef.current = true;
      await authClient.request({
        method: "patch",
        url: `${API_BASE}/api/conversas/${id}/lida`
      });
    } catch (requestError) {
      console.error("Erro ao marcar conversa como lida", requestError);
    } finally {
      readPatchInFlightRef.current = false;
    }
  }, [id, isCurrentConversa]);

  const loadConversaMetadata = useCallback(async () => {
    try {
      const response = await authClient.request({
        method: "get",
        url: `${API_BASE}/api/conversas?limit=100`
      });
      if (!isCurrentConversa()) return;
      const items = Array.isArray(response.data?.items) ? response.data.items : [];
      const found = items.find((item) => Number(item.id) === Number(id));
      if (found) {
        setConversa(found);
        setCanSend(found.can_send === true);
      } else {
        setCanSend(false);
      }
    } catch (requestError) {
      if (!isCurrentConversa()) return;
      console.error("Erro ao carregar dados da conversa", requestError);
      setCanSend(false);
    }
  }, [id, isCurrentConversa]);

  const loadInitialMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      initialLoadDoneRef.current = false;

      const response = await authClient.request({
        method: "get",
        url: `${API_BASE}/api/conversas/${id}/mensagens?limit=50`
      });
      const nextMessages = Array.isArray(response.data?.items) ? response.data.items : [];
      if (!isCurrentConversa()) return;
      setMessages(nextMessages);
      setHasOlderMessages(nextMessages.length >= 50);
      initialLoadDoneRef.current = true;
      await markAsRead();
      window.requestAnimationFrame(() => scrollToBottom(messagesPanelRef.current));
    } catch (requestError) {
      if (!isCurrentConversa()) return;
      console.error("Erro ao carregar mensagens", requestError);
      const status = requestError.response?.status;
      if (status === 403 || status === 404) {
        setError("Conversa não encontrada ou sem permissão.");
      } else {
        setError("Não foi possível carregar as mensagens.");
      }
    } finally {
      if (isCurrentConversa()) setLoading(false);
    }
  }, [id, isCurrentConversa, markAsRead]);

  useEffect(() => {
    activeConversaIdRef.current = String(id || "");
    setConversa(null);
    setMessages([]);
    setText("");
    setSendError("");
    setCanSend(null);
    setHasOlderMessages(true);
    loadConversaMetadata();
    loadInitialMessages();
  }, [id, loadConversaMetadata, loadInitialMessages]);

  const loadNewMessages = useCallback(async () => {
    if (!initialLoadDoneRef.current || !newestId || pollingInFlightRef.current) return;

    try {
      pollingInFlightRef.current = true;
      const shouldStickToBottom = isNearBottom(messagesPanelRef.current);
      const response = await authClient.request({
        method: "get",
        url: `${API_BASE}/api/conversas/${id}/mensagens?after_id=${newestId}&limit=50`
      });
      const nextMessages = Array.isArray(response.data?.items) ? response.data.items : [];
      if (!isCurrentConversa()) return;
      if (nextMessages.length === 0) return;

      setMessages((current) => mergeMessagesById(current, nextMessages));

      const hasMessageFromOtherUser = nextMessages.some(
        (message) => Number(message.sender_user_id) !== userId
      );
      if (hasMessageFromOtherUser) await markAsRead();

      if (shouldStickToBottom) {
        window.requestAnimationFrame(() => scrollToBottom(messagesPanelRef.current));
      }
    } catch (requestError) {
      if (!isCurrentConversa()) return;
      console.error("Erro ao buscar novas mensagens", requestError);
    } finally {
      pollingInFlightRef.current = false;
    }
  }, [id, isCurrentConversa, markAsRead, newestId, userId]);

  useVisiblePolling({
    enabled: Boolean(id),
    delay: 5000,
    onTick: loadNewMessages
  });

  const loadOlderMessages = async () => {
    if (!oldestId || loadingOlder) return;
    const panel = messagesPanelRef.current;
    const previousHeight = panel?.scrollHeight || 0;

    try {
      setLoadingOlder(true);
      const response = await authClient.request({
        method: "get",
        url: `${API_BASE}/api/conversas/${id}/mensagens?before_id=${oldestId}&limit=50`
      });
      const olderMessages = Array.isArray(response.data?.items) ? response.data.items : [];
      if (!isCurrentConversa()) return;
      setHasOlderMessages(olderMessages.length >= 50);
      setMessages((current) => mergeMessagesById(olderMessages, current));
      window.requestAnimationFrame(() => {
        if (panel) panel.scrollTop = panel.scrollHeight - previousHeight;
      });
    } catch (requestError) {
      if (!isCurrentConversa()) return;
      console.error("Erro ao carregar mensagens anteriores", requestError);
      setSendError("Não foi possível carregar mensagens anteriores.");
    } finally {
      if (isCurrentConversa()) setLoadingOlder(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const corpo = text.trim();

    if (!corpo || corpo.length > MAX_MESSAGE_LENGTH || sending || canSend === false) return;

    try {
      setSending(true);
      setSendError("");
      const response = await authClient.request({
        method: "post",
        url: `${API_BASE}/api/conversas/${id}/mensagens`,
        data: { corpo }
      });

      if (!isCurrentConversa()) return;
      setMessages((current) => mergeMessagesById(current, [response.data]));
      setText("");
      window.requestAnimationFrame(() => scrollToBottom(messagesPanelRef.current));
    } catch (requestError) {
      if (!isCurrentConversa()) return;
      console.error("Erro ao enviar mensagem", requestError);
      if (requestError.response?.status === 403) {
        setCanSend(false);
        setSendError("Não é possível enviar novas mensagens nesta conversa.");
      } else {
        setSendError("Não foi possível enviar a mensagem.");
      }
    } finally {
      if (isCurrentConversa()) setSending(false);
    }
  };

  const tooLong = text.trim().length > MAX_MESSAGE_LENGTH;
  const submitDisabled = sending || canSend !== true || !text.trim() || tooLong;

  return (
    <section className="conversa-detail-screen" aria-labelledby="conversa-detail-title">
      <div className="conversa-detail-header">
        <Link to="/conversas" className="conversa-back-link">
          ← Conversas
        </Link>
        <div className="conversa-detail-person">
          <UserAvatar
            src={conversa?.outro_participante?.foto_perfil}
            name={participantName}
            size="publication"
          />
          <h2 id="conversa-detail-title">{participantName}</h2>
        </div>
      </div>

      {error && (
        <Alert variant="danger">
          {error} <Link to="/conversas">Voltar para Conversas</Link>
        </Alert>
      )}

      {!error && (
        <>
          <div
            ref={messagesPanelRef}
            className="conversa-messages-panel"
            aria-live="polite"
          >
            {loading && messages.length === 0 && (
              <div className="conversas-loading">
                <Spinner size="sm" animation="border" role="status" />
                <span>Carregando mensagens...</span>
              </div>
            )}

            {!loading && hasOlderMessages && messages.length > 0 && (
              <Button
                type="button"
                variant="link"
                className="conversa-load-older"
                disabled={loadingOlder}
                onClick={loadOlderMessages}
              >
                {loadingOlder ? "Carregando..." : "Carregar mensagens anteriores"}
              </Button>
            )}

            {!loading && messages.length === 0 && (
              <div className="conversas-empty compact">
                <p>Nenhuma mensagem ainda.</p>
              </div>
            )}

            {messages.map((message) => {
              const isOwn = Number(message.sender_user_id) === userId;
              return (
                <article
                  key={message.id}
                  className={`conversa-message ${isOwn ? "is-own" : "is-other"}`}
                >
                  <span className="conversa-message__author">
                    {isOwn ? "Você" : participantName}
                  </span>
                  <p>{message.corpo}</p>
                  <time dateTime={message.created_at}>
                    {formatConversationTime(message.created_at)}
                  </time>
                </article>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {canSend === false && (
            <Alert variant="warning" className="conversa-cannot-send">
              Não é possível enviar novas mensagens nesta conversa.
            </Alert>
          )}

          {sendError && (
            <div className="inline-error" role="alert">
              {sendError}
            </div>
          )}

          {tooLong && (
            <div className="inline-error" role="alert">
              A mensagem deve ter no máximo {MAX_MESSAGE_LENGTH} caracteres.
            </div>
          )}

          {canSend === true && (
            <Form className="conversa-compose" onSubmit={handleSubmit}>
              <Form.Label htmlFor="conversa-message-input" className="visually-hidden">
                Digite uma mensagem
              </Form.Label>
              <Form.Control
                id="conversa-message-input"
                as="textarea"
                rows={2}
                value={text}
                maxLength={MAX_MESSAGE_LENGTH + 1}
                placeholder="Digite uma mensagem..."
                onChange={(event) => setText(event.target.value)}
              />
              <Button type="submit" disabled={submitDisabled}>
                {sending ? "Enviando..." : "Enviar"}
              </Button>
            </Form>
          )}
        </>
      )}
    </section>
  );
}

export default function Conversas() {
  const { id } = useParams();
  return id ? <ConversaDetail /> : <ConversasList />;
}
