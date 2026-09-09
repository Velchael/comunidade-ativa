const db = require('../models');
const notificationDeliveryService = require('./notificationDeliveryService');

const AGENDA_URL = '/TaskList';
const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 180;

const emptySummary = () => ({
  recipients: 0,
  notifications: 0,
  attempted: 0,
  delivered: 0,
  expired: 0,
  failed: 0,
});

const normalizeId = (value) => {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const truncate = (value, maxLength) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd();
};

const formatDatePtBr = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}`;
};

const serializeTask = (task) => {
  const plain = typeof task?.toJSON === 'function' ? task.toJSON() : task;
  return plain || {};
};

const getTaskTitle = (task) => truncate(serializeTask(task).title, MAX_TITLE_LENGTH) || 'Atividade';

const getTaskDate = (task) => formatDatePtBr(serializeTask(task).due_date);

const buildCreatedPayload = (task) => {
  const taskData = serializeTask(task);
  const title = getTaskTitle(taskData);
  const date = getTaskDate(taskData);

  return {
    type: 'agenda_task_created',
    title: 'Nova atividade na Agenda',
    body: truncate(date ? `${title} — ${date}` : title, MAX_BODY_LENGTH),
    url: AGENDA_URL,
    taskId: taskData.id,
    comunidadId: taskData.comunidad_id,
  };
};

const buildCreatedNotification = (task) => {
  const payload = buildCreatedPayload(task);
  return {
    tipo: payload.type,
    titulo: payload.title,
    corpo: payload.body,
    url: payload.url,
    task_id: payload.taskId,
    comunidad_id: payload.comunidadId,
  };
};

const buildUpdatedBody = (oldTask, newTask, changedFields) => {
  const title = getTaskTitle(newTask);

  if (changedFields.includes('due_date')) {
    const date = getTaskDate(newTask);
    return truncate(date ? `${title} — nova data: ${date}` : `${title} foi atualizada`, MAX_BODY_LENGTH);
  }

  if (changedFields.includes('status')) {
    return truncate(`${title} — status: ${serializeTask(newTask).status}`, MAX_BODY_LENGTH);
  }

  if (changedFields.includes('title')) {
    const date = getTaskDate(newTask);
    return truncate(date ? `${title} — ${date}` : `${title} foi atualizada`, MAX_BODY_LENGTH);
  }

  return truncate(`${getTaskTitle(oldTask)} foi atualizada`, MAX_BODY_LENGTH);
};

const didTransitionToCancelled = (oldTask, newTask) => (
  serializeTask(oldTask).status !== 'cancelada' &&
  serializeTask(newTask).status === 'cancelada'
);

const getAgendaUpdateNotificationType = (oldTask, newTask) => {
  const changedFields = getRelevantChanges(oldTask, newTask);
  const titleOrDateChanged = changedFields.includes('title') || changedFields.includes('due_date');

  if (didTransitionToCancelled(oldTask, newTask)) {
    return {
      tipo: 'agenda_task_cancelled',
      changedFields,
    };
  }

  if (titleOrDateChanged) {
    return {
      tipo: 'agenda_task_updated',
      changedFields,
    };
  }

  return {
    tipo: null,
    changedFields,
  };
};

const buildUpdatedPayload = (oldTask, newTask, changedFields, tipo = 'agenda_task_updated') => {
  const taskData = serializeTask(newTask);
  const cancelled = tipo === 'agenda_task_cancelled';

  return {
    type: tipo,
    title: cancelled ? 'Atividade cancelada' : 'Atividade atualizada',
    body: cancelled
      ? truncate(`${getTaskTitle(taskData)} foi cancelada`, MAX_BODY_LENGTH)
      : buildUpdatedBody(oldTask, taskData, changedFields),
    url: AGENDA_URL,
    taskId: taskData.id,
    comunidadId: taskData.comunidad_id,
  };
};

const buildUpdatedNotification = (oldTask, newTask) => {
  const { tipo, changedFields } = getAgendaUpdateNotificationType(oldTask, newTask);
  if (!tipo) return null;

  const payload = buildUpdatedPayload(oldTask, newTask, changedFields, tipo);
  return {
    tipo: payload.type,
    titulo: payload.title,
    corpo: payload.body,
    url: payload.url,
    task_id: payload.taskId,
    comunidad_id: payload.comunidadId,
  };
};

const buildDeletedPayload = (task) => {
  const taskData = serializeTask(task);
  const title = getTaskTitle(taskData);

  return {
    type: 'agenda_task_deleted',
    title: 'Atividade removida',
    body: truncate(`${title} foi removida da Agenda`, MAX_BODY_LENGTH),
    url: AGENDA_URL,
    taskId: taskData.id,
    comunidadId: taskData.comunidad_id,
  };
};

const buildDeletedNotification = (task) => {
  const payload = buildDeletedPayload(task);
  return {
    tipo: payload.type,
    titulo: payload.title,
    corpo: payload.body,
    url: payload.url,
    task_id: payload.taskId,
    comunidad_id: payload.comunidadId,
  };
};

const getRelevantChanges = (oldTask, newTask) => {
  const oldData = serializeTask(oldTask);
  const newData = serializeTask(newTask);
  return ['title', 'due_date', 'status'].filter((field) => oldData[field] !== newData[field]);
};

const createAgendaNotificationService = ({
  ComunidadMiembro = db.ComunidadMiembro,
  Notificacion = db.Notificacion,
  deliveryService = notificationDeliveryService,
  logger = console,
} = {}) => {
  const notifyCommunity = async ({ comunidadId, actorUserId, notification } = {}) => {
    const summary = emptySummary();
    const normalizedComunidadId = normalizeId(comunidadId);
    const normalizedActorUserId = normalizeId(actorUserId);

    if (!normalizedComunidadId || !normalizedActorUserId || !notification) return summary;

    try {
      const memberships = await ComunidadMiembro.findAll({
        where: {
          comunidad_id: normalizedComunidadId,
          estado: 'activo',
        },
        attributes: ['user_id'],
        order: [['user_id', 'ASC']],
      });
      const recipientIds = [
        ...new Set(memberships
          .map((membership) => normalizeId(membership.user_id))
          .filter((userId) => userId && userId !== normalizedActorUserId)),
      ];

      summary.recipients = recipientIds.length;
      if (recipientIds.length === 0) return summary;

      const notifications = await Notificacion.bulkCreate(
        recipientIds.map((userId) => ({
          user_id: userId,
          actor_user_id: normalizedActorUserId,
          tipo: notification.tipo,
          interaccion_id: null,
          respuesta_id: null,
          comunidad_id: normalizedComunidadId,
          task_id: notification.task_id,
          titulo: notification.titulo,
          corpo: notification.corpo,
          url: notification.url,
          leida: false,
        })),
        { returning: true }
      );

      summary.notifications = notifications.length;
      const deliverySummary = await deliveryService.deliverMany(notifications);
      summary.attempted = deliverySummary.attempted;
      summary.delivered = deliverySummary.delivered;
      summary.expired = deliverySummary.expired;
      summary.failed = deliverySummary.failed;

      logger.info?.('agenda notifications persisted and delivered', {
        type: notification.tipo,
        taskId: notification.task_id,
        comunidadId: normalizedComunidadId,
        ...summary,
      });
      return summary;
    } catch (error) {
      logger.error?.('agenda notification persistence/delivery failed', {
        type: notification?.tipo,
        taskId: notification?.task_id,
        comunidadId: normalizedComunidadId,
      });
      return summary;
    }
  };

  const notifyTaskCreated = (task, actorUserId) => notifyCommunity({
    comunidadId: serializeTask(task).comunidad_id,
    actorUserId,
    notification: buildCreatedNotification(task),
  });

  const notifyTaskUpdated = (oldTask, newTask, actorUserId) => {
    const notification = buildUpdatedNotification(oldTask, newTask);
    if (!notification) return Promise.resolve(emptySummary());

    return notifyCommunity({
      comunidadId: serializeTask(newTask).comunidad_id,
      actorUserId,
      notification,
    });
  };

  const notifyTaskDeleted = (task, actorUserId) => notifyCommunity({
    comunidadId: serializeTask(task).comunidad_id,
    actorUserId,
    notification: buildDeletedNotification(task),
  });

  return {
    notifyCommunity,
    notifyTaskCreated,
    notifyTaskUpdated,
    notifyTaskDeleted,
  };
};

module.exports = {
  ...createAgendaNotificationService(),
  createAgendaNotificationService,
  getRelevantChanges,
  getAgendaUpdateNotificationType,
  buildCreatedPayload,
  buildCreatedNotification,
  buildUpdatedPayload,
  buildUpdatedNotification,
  buildDeletedPayload,
  buildDeletedNotification,
  formatDatePtBr,
};
