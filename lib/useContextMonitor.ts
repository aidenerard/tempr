import { useEffect, useRef, useCallback, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "./AuthContext";
import { runPromptEngine, getPendingQueue, type PromptEngineResult } from "./promptEngine";
import type { GeneratedQueue } from "./queueGenerator";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const MIN_FOREGROUND_DELAY_MS = 5000;

export function useContextMonitor() {
  const { spotifyToken } = useAuth();
  const lastCheckRef = useRef(0);
  const [pendingQueue, setPendingQueue] = useState<GeneratedQueue | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkContext = useCallback(async () => {
    if (!spotifyToken) return;

    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_INTERVAL_MS) return;

    setIsChecking(true);
    lastCheckRef.current = now;

    try {
      const result = await runPromptEngine(spotifyToken);
      if (result.status === "fired") {
        setPendingQueue(result.queue);
      }
    } catch (err) {
      console.warn("[ContextMonitor] check failed:", err);
    } finally {
      setIsChecking(false);
    }
  }, [spotifyToken]);

  useEffect(() => {
    if (!spotifyToken) return;

    const timer = setTimeout(checkContext, MIN_FOREGROUND_DELAY_MS);

    const subscription = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "active") {
          setTimeout(checkContext, MIN_FOREGROUND_DELAY_MS);
        }
      }
    );

    const interval = setInterval(checkContext, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      subscription.remove();
    };
  }, [spotifyToken, checkContext]);

  useEffect(() => {
    const queue = getPendingQueue();
    if (queue) setPendingQueue(queue);
  }, []);

  return { pendingQueue, isChecking };
}
