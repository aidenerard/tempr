# Tempr

AI-powered music queue generation app built with React Native (Expo) and Supabase.

## Setup

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- A [Supabase](https://supabase.com) project
- A [Spotify Developer](https://developer.spotify.com/dashboard) app

### 1. Supabase Configuration

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **Authentication > Providers > Spotify** and enable it
3. Enter your Spotify Client ID and Client Secret
4. Set the redirect URL to: `tempr://` (your app's deep link scheme)

### 2. Spotify Developer Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add the redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
4. Copy the Client ID and Client Secret into your Supabase Spotify provider settings

### 3. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Install & Run

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or press `i` for iOS simulator / `a` for Android emulator.

## Project Structure

```
app/
  _layout.tsx       # Root layout with auth provider & routing
  login.tsx         # Spotify OAuth login screen
  (tabs)/
    _layout.tsx     # Tab navigation layout
    index.tsx       # Authenticated home screen
lib/
  supabase.ts       # Supabase client configuration
  AuthContext.tsx    # React context for auth state management
```

## Auth Flow

1. User taps "Connect with Spotify" on the login screen
2. Supabase OAuth opens Spotify login in a web browser
3. After authorization, Spotify redirects back to Supabase
4. Supabase redirects back to the app via deep link (`tempr://`)
5. The app extracts the session tokens and stores them
6. User is automatically routed to the authenticated home screen
