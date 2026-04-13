import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";
import { firebaseApp } from "./firebase-config";

let messaging: Messaging | null = null;

function getFirebaseMessaging(): Messaging | null {
  if (!messaging && typeof window !== "undefined" && "serviceWorker" in navigator) {
    messaging = getMessaging(firebaseApp);
  }
  return messaging;
}

export async function requestFirebaseNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    try {
      const messaging = getFirebaseMessaging();
      if (!messaging) return null;

      // Add serviceWorkerRegistration option to help with registration
      const token = await getToken(messaging, {
        vapidKey:
          "BEqTX3MwcujEmsg-yh5MUiEQFZ4IdqLrpOweeO0KpI0MSvCtAhzXkz9QdYkJy9-_POTsXjIVPJZn-ERYUSb4Aew",
        serviceWorkerRegistration: await navigator.serviceWorker
          .register("/firebase-messaging-sw.js")
          .catch((err) => {
            console.warn("Service worker registration failed:", err);
            return undefined;
          }),
      });
      return token;
    } catch (err: any) {
      console.error("Failed to get FCM token:", err);
      // Don't crash the app - just return null
      return null;
    }
  }
  return null;
}

export function onMessageListener(callback: (payload: any) => void) {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    // Return a dummy unsubscribe function if messaging is not ready
    return () => {};
  }
  return onMessage(messaging, callback);
}
