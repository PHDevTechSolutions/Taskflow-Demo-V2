importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCNonSOohWCFdgL052XUFFZTH1orbP2dH4",
  authDomain: "taskflow-4605f.firebaseapp.com",
  projectId: "taskflow-4605f",
  messagingSenderId: "558742255762",
  appId: "1:558742255762:web:5725b5c26f1c6fae9e8e4b"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title || "Reminder";
  const notificationOptions = {
    body: payload.notification.body || "",
    icon: payload.notification.icon || "/Taskflow.png",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Optional: handle notification click event to focus or open app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
