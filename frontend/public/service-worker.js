self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {};
  }

  const actorUsername = typeof payload.actor_username === 'string'
    ? payload.actor_username.trim().slice(0, 80)
    : '';
  const interactionId = Number(payload.interaccion_id);
  const validInteractionId = Number.isSafeInteger(interactionId) && interactionId > 0
    ? interactionId
    : null;
  const body = actorUsername
    ? `${actorUsername} respondeu à sua publicação`
    : (typeof payload.body === 'string' && payload.body.trim()
        ? payload.body.trim().slice(0, 180)
        : 'Você recebeu uma nova notificação');
  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.trim().slice(0, 120)
    : 'COMUVA';
  const url = typeof payload.url === 'string' && payload.url.trim()
    ? payload.url.trim()
    : null;

  event.waitUntil(self.registration.showNotification(title, {
    body,
    data: {
      interaccion_id: validInteractionId,
      url
    }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const interactionId = Number(event.notification.data?.interaccion_id);
  const validInteractionId = Number.isSafeInteger(interactionId) && interactionId > 0
    ? interactionId
    : null;
  let targetUrl = new URL('/interacciones', self.location.origin);

  if (typeof event.notification.data?.url === 'string') {
    try {
      const payloadUrl = new URL(event.notification.data.url, self.location.origin);
      if (payloadUrl.origin === self.location.origin) {
        targetUrl = payloadUrl;
      }
    } catch (error) {
      targetUrl = new URL('/interacciones', self.location.origin);
    }
  }

  if (validInteractionId) {
    targetUrl.searchParams.set('interaccionId', String(validInteractionId));
  }

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    const existingClient = windowClients.find((client) => {
      try {
        return new URL(client.url).origin === self.location.origin;
      } catch (error) {
        return false;
      }
    });

    if (existingClient) {
      if ('navigate' in existingClient) await existingClient.navigate(targetUrl.href);
      return existingClient.focus();
    }

    return self.clients.openWindow(targetUrl.href);
  })());
});
