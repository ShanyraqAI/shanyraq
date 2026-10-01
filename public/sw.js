/* Shanyraq push notifications for the installable PWA. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(self.registration.showNotification(payload.title || "Shanyraq", {
    body: payload.body || "Новое уведомление",
    icon: "/icons/shanyraq-192.png",
    badge: "/icons/shanyraq-192.png",
    tag: payload.id || "shanyraq-notification",
    data: { href: payload.href || "/dashboard" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.href || "/dashboard", self.location.origin);
  const href = target.origin === self.location.origin ? `${target.pathname}${target.search}${target.hash}` : "/dashboard";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      return existing.navigate(href).then(() => existing.focus());
    }
    return self.clients.openWindow(href);
  }));
});
