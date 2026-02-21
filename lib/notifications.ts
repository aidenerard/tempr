import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import type { VibeProfile } from "./vibes";
import type { ContextPayload } from "./context/types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) {
    console.warn("[Notifications] Must use physical device");
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

type NotificationTemplate = {
  title: string;
  body: string;
};

type TemplateVariant = {
  titles: string[];
  bodies: string[];
};

const VIBE_TEMPLATES: Record<string, TemplateVariant> = {
  rainy_chill: {
    titles: ["Rainy day vibes ☔", "Rain incoming ☔", "Perfect rain day"],
    bodies: [
      "We put together a mellow rainy-day queue for you.",
      "Here's a chill queue to match the weather.",
      "Rain outside? Here's some cozy music inside.",
    ],
  },
  storm_intense: {
    titles: ["Storm mode ⛈️", "Wild weather outside"],
    bodies: [
      "Dark, atmospheric tracks for this stormy moment.",
      "The weather's intense — your music should match.",
    ],
  },
  snow_cozy: {
    titles: ["Snowy vibes ❄️", "Bundle up ❄️"],
    bodies: [
      "Warm, cozy tracks for a snowy day.",
      "Here's something to curl up with.",
    ],
  },
  romantic_warm: {
    titles: ["Date night soon? 💫", "Something romantic 💫"],
    bodies: [
      "We put together a warm romantic queue for you.",
      "Here's a smooth pre-date playlist to set the mood.",
    ],
  },
  gym_hype: {
    titles: ["Gym time 💪", "Let's go 💪", "Time to lock in 💪"],
    bodies: [
      "High-energy queue ready to fuel your workout.",
      "Here's a hype queue to push through that session.",
      "Ready for the gym? We got your playlist.",
    ],
  },
  focus_study: {
    titles: ["Focus mode 📚", "Time to lock in 📚"],
    bodies: [
      "Here's a quiet, minimal queue for deep focus.",
      "Study session? This queue will keep you in the zone.",
    ],
  },
  travel_smooth: {
    titles: ["Travel mode ✈️", "Bon voyage ✈️"],
    bodies: [
      "Smooth tracks for your journey.",
      "Here's a travel queue — enjoy the ride.",
    ],
  },
  morning_gentle: {
    titles: ["Good morning 🌅", "Rise and shine 🌅"],
    bodies: [
      "Start your day with some gentle tunes.",
      "Here's a soft morning queue to ease you in.",
    ],
  },
  afternoon_cruise: {
    titles: ["Afternoon vibes ☀️", "Easy afternoon ☀️"],
    bodies: [
      "Cruising through the afternoon? Here's a vibe.",
      "Feel-good tracks for the rest of your day.",
    ],
  },
  night_winddown: {
    titles: ["Wind down time 🌙", "Evening calm 🌙"],
    bodies: [
      "Here's a soothing queue to end your evening.",
      "Time to relax — we've got the perfect soundtrack.",
    ],
  },
  late_night_deep: {
    titles: ["Late night 🌌", "Still up? 🌌"],
    bodies: [
      "Deep, introspective tracks for the late hours.",
      "Here's something for the quiet of the night.",
    ],
  },
  party_energy: {
    titles: ["Party time 🎉", "Let's celebrate 🎉"],
    bodies: [
      "Energy's up — here's a party queue to match.",
      "Get the vibe going with this one.",
    ],
  },
  cafe_acoustic: {
    titles: ["Cafe vibes ☕", "Coffee time ☕"],
    bodies: [
      "Acoustic, laid-back tunes for your cafe moment.",
      "Here's something mellow to sip to.",
    ],
  },
  park_sunny: {
    titles: ["Sunny vibes 🌳", "Nice day out 🌳"],
    bodies: [
      "Bright tracks for a sunny moment.",
      "Enjoy the weather with this feel-good queue.",
    ],
  },
  commute_flow: {
    titles: ["On the move 🚶", "Commute flow 🎧"],
    bodies: [
      "Rhythmic tracks to keep you moving.",
      "Here's a flow for your commute.",
    ],
  },
};

const GENERIC_TEMPLATE: TemplateVariant = {
  titles: ["Queue ready 🎵", "New queue for you 🎵"],
  bodies: [
    "We built a personalized queue based on your moment.",
    "Here's a fresh queue — tap to listen.",
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateNotificationCopy(
  vibe: VibeProfile,
  _context: ContextPayload
): NotificationTemplate {
  const templates = VIBE_TEMPLATES[vibe.id] ?? GENERIC_TEMPLATE;
  return {
    title: pickRandom(templates.titles),
    body: pickRandom(templates.bodies),
  };
}

export type PromptedQueueNotificationData = {
  type: "prompted_queue";
  vibeId: string;
  contextTimestamp: number;
};

export async function sendPromptedQueueNotification(
  vibe: VibeProfile,
  context: ContextPayload
): Promise<string | null> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return null;

    const copy = generateNotificationCopy(vibe, context);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: copy.title,
        body: copy.body,
        data: {
          type: "prompted_queue",
          vibeId: vibe.id,
          contextTimestamp: context.timestamp,
        } as PromptedQueueNotificationData,
        sound: true,
      },
      trigger: null,
    });

    return id;
  } catch (err) {
    console.warn("[Notifications] failed to send:", err);
    return null;
  }
}
