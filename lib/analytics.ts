type AnalyticsEvent =
  | { name: "prompted_queue_generated"; properties: { vibeId: string; triggerSource: string; trackCount: number; familiarPct: number } }
  | { name: "prompted_queue_notification_sent"; properties: { vibeId: string; triggerSource: string } }
  | { name: "prompted_queue_notification_opened"; properties: { vibeId: string } }
  | { name: "prompted_queue_played"; properties: { vibeId: string; trackCount: number; durationMin: number } }
  | { name: "prompted_queue_saved"; properties: { vibeId: string } }
  | { name: "prompted_queue_dismissed"; properties: { vibeId: string; triggerSource: string } }
  | { name: "prompted_queue_feedback"; properties: { vibeId: string; action: string; energyFeedback?: string } }
  | { name: "trigger_evaluated"; properties: { shouldFire: boolean; triggerSource: string; reason: string } }
  | { name: "trigger_suppressed"; properties: { reason: string; triggerSource: string } }
  | { name: "context_gathered"; properties: { locationType: string; weatherTag: string; timeBucket: string; hasEvent: boolean } }
  | { name: "permission_granted"; properties: { permission: string } }
  | { name: "permission_denied"; properties: { permission: string } }
  | { name: "settings_changed"; properties: { setting: string; value: boolean | number } };

const eventLog: Array<AnalyticsEvent & { timestamp: number }> = [];

export function trackEvent(event: AnalyticsEvent): void {
  const entry = { ...event, timestamp: Date.now() };
  eventLog.push(entry);

  if (__DEV__) {
    console.log(`[Analytics] ${event.name}`, event.properties);
  }

  // Future: send to Supabase, Mixpanel, Amplitude, etc.
}

export function getRecentEvents(limit = 50) {
  return eventLog.slice(-limit);
}
