# Tempr

A mobile music queue generation app that creates personalized playlists based on context (weather, calendar, mood) and your Spotify listening history.

## Tech Stack

- **Frontend**: React Native (Expo)
- **Styling**: NativeWind (Tailwind CSS)
- **Backend**: Supabase (auth, database, edge functions)
- **APIs**: Spotify, OpenWeather, Gemini, Google Calendar, CLIP, OpenL3
- **Deployment**: Vercel

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Fill in your API keys in `.env`.

3. **Run the app**
   ```bash
   npm start
   ```
   Then press `i` for iOS or `a` for Android.

4. **Run tests**
   ```bash
   npm test
   ```

## Project Structure

```
src/
├── components/     # Reusable UI (ScrollingPreviewCard, QueueMilestone)
├── contexts/       # Auth context
├── screens/       # QueueScreen, DiscoverScreen
├── services/      # API abstractions (Spotify, OpenWeather, Gemini, etc.)
└── theme/         # Color scheme constants
supabase/
├── migrations/    # Database schema
└── functions/    # Edge functions (CLIP, OpenL3 stubs)
```

## Features

- **App-Prompted Queues**: Auto-generate based on weather, calendar, location
- **User-Prompted Queues**: Chat prompt or video upload for mood
- **Save to Spotify**: Export queue as playlist
- **Queue Editing**: Swipe to keep/remove, double-tap to like
- **Discover Tab**: Genre, history-based, or random new music

## Environment Variables

See `.env.example` for required keys. Never commit `.env`.
