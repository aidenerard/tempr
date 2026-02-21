import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ContextPayload, PromptSettings } from "./context/types";
import { isQuietHours } from "./context/time";
import { inferVibe, type VibeProfile } from "./vibes";

const TRIGGER_LOG_KEY = "tempr_trigger_log";
const COOLDOWN_HOURS = 3;

type TriggerLogEntry = {
  vibeId: string;
  timestamp: number;
  triggerSource: string;
  dismissed?: boolean;
};

type TriggerLog = TriggerLogEntry[];

export type TriggerDecision = {
  shouldFire: boolean;
  vibe: VibeProfile | null;
  triggerSource: string;
  reason: string;
};

async function getTriggerLog(): Promise<TriggerLog> {
  try {
    const raw = await AsyncStorage.getItem(TRIGGER_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function appendTriggerLog(entry: TriggerLogEntry): Promise<void> {
  const log = await getTriggerLog();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const trimmed = log.filter((e) => e.timestamp > cutoff);
  trimmed.push(entry);
  await AsyncStorage.setItem(TRIGGER_LOG_KEY, JSON.stringify(trimmed));
}

function determineTriggerSource(context: ContextPayload): string {
  if (context.upcomingEvent && context.upcomingEvent.startsInMin <= 60) {
    return `calendar:${context.upcomingEvent.type}`;
  }
  if (context.locationType !== "unknown") {
    return `location:${context.locationType}`;
  }
  if (context.weatherTag !== "unknown" && context.weatherTag !== "clear") {
    return `weather:${context.weatherTag}`;
  }
  return `time:${context.timeBucket}`;
}

export async function evaluateTrigger(
  context: ContextPayload,
  settings: PromptSettings
): Promise<TriggerDecision> {
  const noFire = (reason: string): TriggerDecision => ({
    shouldFire: false,
    vibe: null,
    triggerSource: "",
    reason,
  });

  if (isQuietHours(settings.quietHoursStart, settings.quietHoursEnd)) {
    return noFire("quiet_hours");
  }

  const triggerSource = determineTriggerSource(context);
  const [category] = triggerSource.split(":");

  if (category === "weather" && !settings.weatherPrompts) {
    return noFire("weather_prompts_disabled");
  }
  if (category === "calendar" && !settings.calendarPrompts) {
    return noFire("calendar_prompts_disabled");
  }
  if (category === "location" && !settings.locationPrompts) {
    return noFire("location_prompts_disabled");
  }
  if (category === "time" && !settings.timeOfDayPrompts) {
    return noFire("time_prompts_disabled");
  }

  const log = await getTriggerLog();
  const now = Date.now();
  const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;

  const recentSameTrigger = log.find(
    (e) => e.triggerSource === triggerSource && now - e.timestamp < cooldownMs
  );
  if (recentSameTrigger) {
    return noFire("cooldown_same_trigger");
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEntries = log.filter((e) => e.timestamp >= todayStart.getTime());
  if (todayEntries.length >= settings.maxPromptsPerDay) {
    return noFire("daily_limit_reached");
  }

  const recentDismissal = log.find(
    (e) =>
      e.triggerSource === triggerSource &&
      e.dismissed &&
      now - e.timestamp < 24 * 60 * 60 * 1000
  );
  if (recentDismissal) {
    return noFire("recently_dismissed");
  }

  if (category === "time" && context.weatherTag === "unknown" && context.locationType === "unknown" && !context.upcomingEvent) {
    return noFire("insufficient_context_for_time_only");
  }

  const vibe = inferVibe(context);

  return {
    shouldFire: true,
    vibe,
    triggerSource,
    reason: "trigger_conditions_met",
  };
}

export async function recordTriggerFired(
  vibeId: string,
  triggerSource: string
): Promise<void> {
  await appendTriggerLog({
    vibeId,
    timestamp: Date.now(),
    triggerSource,
  });
}

export async function recordTriggerDismissed(
  vibeId: string,
  triggerSource: string
): Promise<void> {
  await appendTriggerLog({
    vibeId,
    timestamp: Date.now(),
    triggerSource,
    dismissed: true,
  });
}
