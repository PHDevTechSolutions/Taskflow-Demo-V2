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

      const token = await getToken(messaging, {
        vapidKey:
          "BEqTX3MwcujEmsg-yh5MUiEQFZ4IdqLrpOweeO0KpI0MSvCtAhzXkz9QdYkJy9-_POTsXjIVPJZn-ERYUSb4Aew",
      });
      return token;
    } catch (err) {
      console.error("Failed to get FCM token", err);
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
