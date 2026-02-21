import { gatherContext } from "./context";
import { evaluateTrigger, recordTriggerFired } from "./trigger";
import { getPromptSettings } from "./settings";
import { generatePromptedQueue, type GeneratedQueue } from "./queueGenerator";
import { sendPromptedQueueNotification } from "./notifications";
import { getCurrentPlayback } from "./spotify";
import { trackEvent } from "./analytics";
import type { VibeProfile } from "./vibes";

export type PromptEngineResult =
  | { status: "fired"; queue: GeneratedQueue; notificationId: string | null }
  | { status: "suppressed"; reason: string };

let pendingQueue: GeneratedQueue | null = null;

export function getPendingQueue(): GeneratedQueue | null {
  return pendingQueue;
}

export function setPendingQueue(queue: GeneratedQueue | null): void {
  pendingQueue = queue;
}

export function clearPendingQueue(): void {
  pendingQueue = null;
}

export async function runPromptEngine(
  spotifyToken: string
): Promise<PromptEngineResult> {
  const context = await gatherContext();

  trackEvent({
    name: "context_gathered",
    properties: {
      locationType: context.locationType,
      weatherTag: context.weatherTag,
      timeBucket: context.timeBucket,
      hasEvent: !!context.upcomingEvent,
    },
  });

  const playback = await getCurrentPlayback(spotifyToken).catch(() => null);
  if (playback?.isPlaying) {
    trackEvent({
      name: "trigger_suppressed",
      properties: { reason: "user_playing", triggerSource: "" },
    });
    return { status: "suppressed", reason: "user_currently_playing" };
  }

  const settings = await getPromptSettings();
  const decision = await evaluateTrigger(context, settings);

  trackEvent({
    name: "trigger_evaluated",
    properties: {
      shouldFire: decision.shouldFire,
      triggerSource: decision.triggerSource,
      reason: decision.reason,
    },
  });

  if (!decision.shouldFire || !decision.vibe) {
    return { status: "suppressed", reason: decision.reason };
  }

  const vibe = decision.vibe;

  try {
    const queue = await generatePromptedQueue(spotifyToken, vibe, context);

    trackEvent({
      name: "prompted_queue_generated",
      properties: {
        vibeId: vibe.id,
        triggerSource: decision.triggerSource,
        trackCount: queue.tracks.length,
        familiarPct: queue.familiarCount / Math.max(queue.tracks.length, 1),
      },
    });

    pendingQueue = queue;

    await recordTriggerFired(vibe.id, decision.triggerSource);

    const notificationId = await sendPromptedQueueNotification(vibe, context);

    if (notificationId) {
      trackEvent({
        name: "prompted_queue_notification_sent",
        properties: { vibeId: vibe.id, triggerSource: decision.triggerSource },
      });
    }

    return { status: "fired", queue, notificationId };
  } catch (err) {
    console.warn("[PromptEngine] generation failed:", err);
    return { status: "suppressed", reason: "generation_error" };
  }
}
