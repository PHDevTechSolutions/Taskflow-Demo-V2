"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { supabase } from "@/utils/supabase";
import { useUser } from "@/contexts/UserContext";

/** Raw `spf_creation.status` values that map to actionable badges on the requests list. */
const CREATION_NOTIFICATION_STATUSES = new Set([
  "pending for procurement",
  "approved by procurement",
  "for revision",
]);

function normalizeCreationStatusForCompare(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isCreationNotificationStatus(status: unknown): boolean {
  return CREATION_NOTIFICATION_STATUSES.has(normalizeCreationStatusForCompare(status));
}

interface NotificationContextValue {
  unreadCount: number;
  unreadChatCount: number;
  markSPFRequestAsRead: (spfNumber: string) => void;
  isSPFRequestUnread: (spfNumber: string) => boolean;
  getSPFRequestUnreadCount: (spfNumber: string) => number;
  clearNotifications: () => void;
  // Chat message notification functions
  markChatAsRead: (requestId: string) => void;
  isChatUnread: (requestId: string) => boolean;
  getChatUnreadCount: (requestId: string) => number;
  updateChatUnreadCount: (requestId: string, count: number) => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  unreadChatCount: 0,
  markSPFRequestAsRead: () => {},
  isSPFRequestUnread: () => false,
  getSPFRequestUnreadCount: () => 0,
  clearNotifications: () => {},
  markChatAsRead: () => {},
  isChatUnread: () => false,
  getChatUnreadCount: () => 0,
  updateChatUnreadCount: () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const readSPFRef = useRef<Map<string, string>>(new Map());
  const unreadSPFRef = useRef<Set<string>>(new Set());
  const latestSignatureRef = useRef<Map<string, string>>(new Map());
  const knownSignatureRef = useRef<Map<string, string>>(new Map());
  const unreadCountMapRef = useRef<Map<string, number>>(new Map());
  const latestCreationStatusRef = useRef<Map<string, string>>(new Map());
  const lastSeenCreationRef = useRef<Map<string, string>>(new Map());
  // Chat notification tracking
  const chatUnreadMapRef = useRef<Map<string, number>>(new Map());
  const chatLastReadMapRef = useRef<Map<string, string>>(new Map());

  const getStorageKey = useCallback((uid: string) => `spf-notif-read-map:${uid}`, []);
  const getInitKey = useCallback((uid: string) => `spf-notif-init:${uid}`, []);
  const getLegacyStorageKey = useCallback((uid: string) => `spf-notif-read:${uid}`, []);
  const getKnownSignatureKey = useCallback((uid: string) => `spf-notif-known-map:${uid}`, []);
  const getUnreadCountKey = useCallback((uid: string) => `spf-notif-unread-count-map:${uid}`, []);
  const getLastSeenCreationKey = useCallback((uid: string) => `spf-notif-last-seen-creation:${uid}`, []);
  // Chat storage keys
  const getChatUnreadKey = useCallback((uid: string) => `chat-notif-unread-map:${uid}`, []);
  const getChatLastReadKey = useCallback((uid: string) => `chat-notif-last-read:${uid}`, []);
  const normalizeSPFNumber = useCallback((value: unknown) => {
    if (typeof value !== "string") return "";
    return value.trim().replace(/\s+/g, "").toUpperCase();
  }, []);

  const persistReadMap = useCallback((uid: string, map: Map<string, string>) => {
    const payload = Object.fromEntries(map.entries());
    localStorage.setItem(getStorageKey(uid), JSON.stringify(payload));
  }, [getStorageKey]);

  const persistKnownSignatureMap = useCallback((uid: string, map: Map<string, string>) => {
    const payload = Object.fromEntries(map.entries());
    localStorage.setItem(getKnownSignatureKey(uid), JSON.stringify(payload));
  }, [getKnownSignatureKey]);

  const persistUnreadCountMap = useCallback((uid: string, map: Map<string, number>) => {
    const payload = Object.fromEntries(map.entries());
    localStorage.setItem(getUnreadCountKey(uid), JSON.stringify(payload));
  }, [getUnreadCountKey]);

  const persistLastSeenCreationMap = useCallback((uid: string, map: Map<string, string>) => {
    const payload = Object.fromEntries(map.entries());
    localStorage.setItem(getLastSeenCreationKey(uid), JSON.stringify(payload));
  }, [getLastSeenCreationKey]);

  const persistChatUnreadMap = useCallback((uid: string, map: Map<string, number>) => {
    const payload = Object.fromEntries(map.entries());
    localStorage.setItem(getChatUnreadKey(uid), JSON.stringify(payload));
  }, [getChatUnreadKey]);

  const applyEffectiveUnreadAggregates = useCallback(() => {
    const unreadSet = new Set<string>();
    let total = 0;
    latestSignatureRef.current.forEach((_, spf) => {
      const delta = unreadCountMapRef.current.get(spf) ?? 0;
      const creation = latestCreationStatusRef.current.get(spf) ?? "";
      const lastSeen = lastSeenCreationRef.current.get(spf);
      const alertUnread =
        isCreationNotificationStatus(creation) &&
        normalizeCreationStatusForCompare(creation) !== normalizeCreationStatusForCompare(lastSeen);
      const effective = Math.max(delta, alertUnread ? 1 : 0);
      if (effective > 0) {
        unreadSet.add(spf);
        total += effective;
      }
    });
    unreadSPFRef.current = unreadSet;
    setUnreadCount(total);
  }, []);

  const playNotificationSound = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
    }
    audio.currentTime = 0;
    void audio.play().catch(() => {});
    stopTimerRef.current = window.setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      stopTimerRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => {
    if (!userId) {
      unreadSPFRef.current = new Set();
      readSPFRef.current = new Map();
      latestSignatureRef.current = new Map();
      knownSignatureRef.current = new Map();
      unreadCountMapRef.current = new Map();
      latestCreationStatusRef.current = new Map();
      lastSeenCreationRef.current = new Map();
      queueMicrotask(() => setUnreadCount(0));
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio("/musics/notif-sound.mp3");
      audioRef.current.preload = "auto";
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    let cancelled = false;

    const syncUnreadState = async () => {
      const { data: requestData } = await supabase
        .from("spf_request")
        .select("spf_number, status")
        .not("spf_number", "is", null);
const { data: creationData } = await supabase
  .from("spf_creation")
  .select("id, spf_number, status, date_created, date_updated, product_offer_image, product_offer_qty, product_offer_unit_cost, product_offer_technical_specification, supplier_brand, price_validity, tds")
  .not("spf_number", "is", null);

      if (cancelled) return;

      const requestRows = (requestData ?? []).reduce<Array<{ spf_number: string; status: string | null }>>(
        (acc, row) => {
          const spfNumber = normalizeSPFNumber(row?.spf_number);
          if (!spfNumber) return acc;
          acc.push({
            spf_number: spfNumber,
            status: typeof row?.status === "string" ? row.status : null,
          });
          return acc;
        },
        []
      );
      const currentSPF = new Set(
        requestRows
          .map((row) => row.spf_number)
          .filter((spf): spf is string => typeof spf === "string" && spf.length > 0)
      );

      const lastSeenKey = getLastSeenCreationKey(userId);
      const rawLastSeenCreation = localStorage.getItem(lastSeenKey);
      const lastSeenMap = new Map<string, string>();
      if (rawLastSeenCreation) {
        try {
          const parsed = JSON.parse(rawLastSeenCreation);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            Object.entries(parsed).forEach(([spf, v]) => {
              const n = normalizeSPFNumber(spf);
              if (n && typeof v === "string") lastSeenMap.set(n, v);
            });
          }
        } catch {
          /* ignore */
        }
      }
      const staleLastSeenSpf: string[] = [];
      lastSeenMap.forEach((_, spf) => {
        if (!currentSPF.has(spf)) staleLastSeenSpf.push(spf);
      });
      staleLastSeenSpf.forEach((spf) => lastSeenMap.delete(spf));
      lastSeenCreationRef.current = lastSeenMap;

      const creationSnapshotMap = new Map<string, { status: string; version: number; contentFingerprint: string }>();
      const creationVersionMap = new Map<string, number>();
      (creationData ?? []).forEach((row) => {
        const spf = normalizeSPFNumber(row?.spf_number);
        if (!spf) return;

        const dateUpdatedValue = row?.date_updated;
        const dateCreatedValue = row?.date_created;
        const dateUpdatedMs =
          typeof dateUpdatedValue === "string" || dateUpdatedValue instanceof Date
            ? new Date(dateUpdatedValue).getTime()
            : Number.NaN;
        const dateCreatedMs =
          typeof dateCreatedValue === "string" || dateCreatedValue instanceof Date
            ? new Date(dateCreatedValue).getTime()
            : Number.NaN;
        const idMs = typeof row?.id === "number" ? row.id : Number.NaN;
        const versionPoint = Number.isFinite(dateUpdatedMs)
          ? dateUpdatedMs
          : Number.isFinite(dateCreatedMs)
            ? dateCreatedMs
            : Number.isFinite(idMs)
              ? idMs
              : 0;
        const previousVersionPoint = creationVersionMap.get(spf) ?? Number.NEGATIVE_INFINITY;
        if (versionPoint < previousVersionPoint) return;

// AFTER:
creationVersionMap.set(spf, versionPoint);
const creationStatus = typeof row?.status === "string" ? row.status : "unknown";

// Build a content fingerprint from the actual row data
// so ANY field change (not just status/timestamp) triggers a notification
const contentFingerprint = [
  creationStatus,
  typeof row?.product_offer_image === "string" ? row.product_offer_image.slice(0, 100) : "",
  typeof row?.product_offer_qty === "string" ? row.product_offer_qty : "",
  typeof row?.product_offer_unit_cost === "string" ? row.product_offer_unit_cost : "",
  typeof row?.supplier_brand === "string" ? row.supplier_brand : "",
  typeof row?.price_validity === "string" ? row.price_validity : "",
  typeof row?.tds === "string" ? row.tds : "",
].join("|~|");

creationSnapshotMap.set(spf, {
  status: creationStatus,
  version: versionPoint,
  contentFingerprint,
});
      });
      const currentSignatureMap = new Map<string, string>();
      requestRows.forEach((row) => {
        const requestStatus = typeof row.status === "string" ? row.status : "unknown";
        const normalizedRequestStatus = requestStatus.trim().toLowerCase();
        const creationSnapshot = creationSnapshotMap.get(row.spf_number);
        const hasCreation = creationSnapshot ? "1" : "0";
const normalizedCreationStatus = creationSnapshot
  ? creationSnapshot.status.trim().toLowerCase()
  : "__none__";
const creationVersion = creationSnapshot ? String(creationSnapshot.version) : "__none__";
const creationFingerprint = creationSnapshot?.contentFingerprint ?? "__none__";
currentSignatureMap.set(
  row.spf_number,
  `request:${normalizedRequestStatus}|creation:${normalizedCreationStatus}|creation_v:${creationVersion}|has_creation:${hasCreation}|content:${creationFingerprint}`
);
      });
      latestSignatureRef.current = currentSignatureMap;

      const creationStatusBySpf = new Map<string, string>();
      requestRows.forEach((row) => {
        const snap = creationSnapshotMap.get(row.spf_number);
        creationStatusBySpf.set(row.spf_number, snap ? snap.status : "");
      });
      latestCreationStatusRef.current = creationStatusBySpf;

      const storageKey = getStorageKey(userId);
      const initKey = getInitKey(userId);
      const legacyKey = getLegacyStorageKey(userId);
      const knownKey = getKnownSignatureKey(userId);
      const unreadCountKey = getUnreadCountKey(userId);
      const initialized = localStorage.getItem(initKey) === "1";
      const rawReadMap = localStorage.getItem(storageKey);
      const rawLegacy = localStorage.getItem(legacyKey);
      const rawKnownSignatureMap = localStorage.getItem(knownKey);
      const rawUnreadCountMap = localStorage.getItem(unreadCountKey);
      const parsedReadMap = rawReadMap ? JSON.parse(rawReadMap) : {};
      const parsedLegacy = rawLegacy ? JSON.parse(rawLegacy) : [];
      const parsedKnownSignatureMap = rawKnownSignatureMap ? JSON.parse(rawKnownSignatureMap) : {};
      const parsedUnreadCountMap = rawUnreadCountMap ? JSON.parse(rawUnreadCountMap) : {};
      const readMap = new Map<string, string>();
      const knownMap = new Map<string, string>();
      const unreadCountMap = new Map<string, number>();
      if (parsedReadMap && typeof parsedReadMap === "object" && !Array.isArray(parsedReadMap)) {
        Object.entries(parsedReadMap).forEach(([spf, signature]) => {
          const normalizedSPF = normalizeSPFNumber(spf);
          if (!normalizedSPF || typeof signature !== "string") return;
          readMap.set(normalizedSPF, signature);
        });
      }
      if (
        parsedKnownSignatureMap &&
        typeof parsedKnownSignatureMap === "object" &&
        !Array.isArray(parsedKnownSignatureMap)
      ) {
        Object.entries(parsedKnownSignatureMap).forEach(([spf, signature]) => {
          const normalizedSPF = normalizeSPFNumber(spf);
          if (!normalizedSPF || typeof signature !== "string") return;
          knownMap.set(normalizedSPF, signature);
        });
      }
      if (parsedUnreadCountMap && typeof parsedUnreadCountMap === "object" && !Array.isArray(parsedUnreadCountMap)) {
        Object.entries(parsedUnreadCountMap).forEach(([spf, count]) => {
          const normalizedSPF = normalizeSPFNumber(spf);
          if (!normalizedSPF || typeof count !== "number" || !Number.isFinite(count) || count <= 0) return;
          unreadCountMap.set(normalizedSPF, count);
        });
      }
      if (Array.isArray(parsedLegacy)) {
        parsedLegacy.forEach((spf) => {
          const normalizedSPF = normalizeSPFNumber(spf);
          if (!normalizedSPF) return;
          const signature = currentSignatureMap.get(normalizedSPF);
          if (signature) readMap.set(normalizedSPF, signature);
        });
      }

      if (!initialized) {
        currentSignatureMap.forEach((signature, spf) => readMap.set(spf, signature));
        knownMap.clear();
        currentSignatureMap.forEach((signature, spf) => knownMap.set(spf, signature));
        unreadCountMap.clear();
        localStorage.setItem(initKey, "1");
      }

      const activeReadMap = new Map<string, string>();
      const activeUnreadCountMap = new Map<string, number>();
      const activeKnownMap = new Map<string, string>();
      currentSPF.forEach((spf) => {
        const currentSignature = currentSignatureMap.get(spf);
        if (!currentSignature) return;
        activeKnownMap.set(spf, currentSignature);

        const signature = readMap.get(spf);
        if (typeof signature === "string") {
          activeReadMap.set(spf, signature);
        }

        if (!initialized) return;

        const previousKnownSignature = knownMap.get(spf);
        const readSignature = activeReadMap.get(spf);
        const previousUnreadCount = unreadCountMap.get(spf) ?? 0;

        if (!previousKnownSignature) {
          if (readSignature !== currentSignature) {
            activeUnreadCountMap.set(spf, Math.max(1, previousUnreadCount));
          }
          return;
        }

        if (previousKnownSignature !== currentSignature) {
          if (readSignature !== currentSignature) {
            activeUnreadCountMap.set(spf, Math.max(1, previousUnreadCount + 1));
          }
          return;
        }

        if (readSignature !== currentSignature) {
          activeUnreadCountMap.set(spf, Math.max(1, previousUnreadCount));
        }
      });
      readSPFRef.current = activeReadMap;
      knownSignatureRef.current = activeKnownMap;
      unreadCountMapRef.current = activeUnreadCountMap;

      applyEffectiveUnreadAggregates();
      persistReadMap(userId, activeReadMap);
      persistKnownSignatureMap(userId, activeKnownMap);
      persistUnreadCountMap(userId, activeUnreadCountMap);
    };

    void syncUnreadState();

    const channel = supabase
      .channel("spf_request_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "spf_request" },
        () => {
          void syncUnreadState();
          playNotificationSound();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "spf_creation" },
        () => {
          void syncUnreadState();
          playNotificationSound();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      cancelled = true;
      if (stopTimerRef.current) {
        window.clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      supabase.removeChannel(channel);
    };
  }, [
    userId,
    getInitKey,
    getStorageKey,
    getLegacyStorageKey,
    getKnownSignatureKey,
    getUnreadCountKey,
    persistReadMap,
    persistKnownSignatureMap,
    persistUnreadCountMap,
    normalizeSPFNumber,
    playNotificationSound,
    getLastSeenCreationKey,
    applyEffectiveUnreadAggregates,
  ]);

  const markSPFRequestAsRead = useCallback((spfNumber: string) => {
    if (!userId) return;
    const normalizedSPF = normalizeSPFNumber(spfNumber);
    if (!normalizedSPF) return;
    const currentSignature = latestSignatureRef.current.get(normalizedSPF);
    const currentCreation = latestCreationStatusRef.current.get(normalizedSPF) ?? "";
    if (currentSignature) {
      readSPFRef.current.set(normalizedSPF, currentSignature);
    }
    unreadCountMapRef.current.delete(normalizedSPF);
    lastSeenCreationRef.current.set(normalizedSPF, currentCreation);
    persistLastSeenCreationMap(userId, lastSeenCreationRef.current);
    persistReadMap(userId, readSPFRef.current);
    persistKnownSignatureMap(userId, knownSignatureRef.current);
    persistUnreadCountMap(userId, unreadCountMapRef.current);
    applyEffectiveUnreadAggregates();
  }, [
    normalizeSPFNumber,
    persistReadMap,
    persistKnownSignatureMap,
    persistUnreadCountMap,
    persistLastSeenCreationMap,
    userId,
    applyEffectiveUnreadAggregates,
  ]);

  const isSPFRequestUnread = useCallback((spfNumber: string) => {
    const normalizedSPF = normalizeSPFNumber(spfNumber);
    if (!normalizedSPF) return false;
    const delta = unreadCountMapRef.current.get(normalizedSPF) ?? 0;
    const creation = latestCreationStatusRef.current.get(normalizedSPF) ?? "";
    const lastSeen = lastSeenCreationRef.current.get(normalizedSPF);
    const alertUnread =
      isCreationNotificationStatus(creation) &&
      normalizeCreationStatusForCompare(creation) !== normalizeCreationStatusForCompare(lastSeen);
    return Math.max(delta, alertUnread ? 1 : 0) > 0;
  }, [normalizeSPFNumber]);

  const getSPFRequestUnreadCount = useCallback((spfNumber: string) => {
    const normalizedSPF = normalizeSPFNumber(spfNumber);
    if (!normalizedSPF) return 0;
    const delta = unreadCountMapRef.current.get(normalizedSPF) ?? 0;
    const creation = latestCreationStatusRef.current.get(normalizedSPF) ?? "";
    const lastSeen = lastSeenCreationRef.current.get(normalizedSPF);
    const alertUnread =
      isCreationNotificationStatus(creation) &&
      normalizeCreationStatusForCompare(creation) !== normalizeCreationStatusForCompare(lastSeen);
    return Math.max(delta, alertUnread ? 1 : 0);
  }, [normalizeSPFNumber]);

  // Chat notification functions
  const recalcChatUnreadTotal = useCallback(() => {
    let total = 0;
    chatUnreadMapRef.current.forEach((count) => {
      total += count;
    });
    setUnreadChatCount(total);
  }, []);

  const markChatAsRead = useCallback((requestId: string) => {
    if (!userId || !requestId) return;
    chatUnreadMapRef.current.delete(requestId);
    chatLastReadMapRef.current.set(requestId, new Date().toISOString());
    persistChatUnreadMap(userId, chatUnreadMapRef.current);
    recalcChatUnreadTotal();
  }, [userId, persistChatUnreadMap, recalcChatUnreadTotal]);

  const isChatUnread = useCallback((requestId: string) => {
    if (!requestId) return false;
    return (chatUnreadMapRef.current.get(requestId) ?? 0) > 0;
  }, []);

  const getChatUnreadCount = useCallback((requestId: string) => {
    if (!requestId) return 0;
    return chatUnreadMapRef.current.get(requestId) ?? 0;
  }, []);

  const updateChatUnreadCount = useCallback((requestId: string, count: number) => {
    if (!userId || !requestId) return;
    if (count <= 0) {
      chatUnreadMapRef.current.delete(requestId);
    } else {
      chatUnreadMapRef.current.set(requestId, count);
    }
    persistChatUnreadMap(userId, chatUnreadMapRef.current);
    recalcChatUnreadTotal();
  }, [userId, persistChatUnreadMap, recalcChatUnreadTotal]);

  const clearNotifications = useCallback(() => {
    if (!userId) {
      unreadSPFRef.current = new Set();
      setUnreadCount(0);
      return;
    }
    latestSignatureRef.current.forEach((signature, spf) => {
      readSPFRef.current.set(spf, signature);
      const creation = latestCreationStatusRef.current.get(spf) ?? "";
      lastSeenCreationRef.current.set(spf, creation);
    });
    unreadCountMapRef.current.clear();
    persistReadMap(userId, readSPFRef.current);
    persistKnownSignatureMap(userId, knownSignatureRef.current);
    persistUnreadCountMap(userId, unreadCountMapRef.current);
    persistLastSeenCreationMap(userId, lastSeenCreationRef.current);
    applyEffectiveUnreadAggregates();
  }, [
    persistReadMap,
    persistKnownSignatureMap,
    persistUnreadCountMap,
    persistLastSeenCreationMap,
    userId,
    applyEffectiveUnreadAggregates,
  ]);

  return (
    <NotificationContext.Provider value={{
      unreadCount,
      unreadChatCount,
      markSPFRequestAsRead,
      isSPFRequestUnread,
      getSPFRequestUnreadCount,
      clearNotifications,
      markChatAsRead,
      isChatUnread,
      getChatUnreadCount,
      updateChatUnreadCount,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
