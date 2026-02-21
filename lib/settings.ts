import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PromptSettings } from "./context/types";
import { DEFAULT_PROMPT_SETTINGS } from "./context/types";

const SETTINGS_KEY = "tempr_prompt_settings";
const FEEDBACK_KEY = "tempr_queue_feedback";

export async function getPromptSettings(): Promise<PromptSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_PROMPT_SETTINGS;
    return { ...DEFAULT_PROMPT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROMPT_SETTINGS;
  }
}

export async function savePromptSettings(
  settings: Partial<PromptSettings>
): Promise<void> {
  const current = await getPromptSettings();
  const merged = { ...current, ...settings };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
}

export type QueueFeedback = {
  queueId: string;
  vibeId: string;
  triggerSource: string;
  action: "played" | "saved" | "dismissed" | "not_my_vibe";
  energyFeedback?: "too_high" | "too_low" | "just_right";
  timestamp: number;
};

export async function saveFeedback(feedback: QueueFeedback): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(FEEDBACK_KEY);
    const log: QueueFeedback[] = raw ? JSON.parse(raw) : [];
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const trimmed = log.filter((e) => e.timestamp > cutoff);
    trimmed.push(feedback);
    await AsyncStorage.setItem(FEEDBACK_KEY, JSON.stringify(trimmed));
  } catch {
    // non-critical
  }
}

export async function getFeedbackLog(): Promise<QueueFeedback[]> {
  try {
    const raw = await AsyncStorage.getItem(FEEDBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
