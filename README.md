# Listen Together

A real-time synchronized music listening experience with an immersive 3D interface. One host controls the music, and everyone else listens along in perfect sync.

![Listen Together](https://img.shields.io/badge/Next.js-14-black?logo=next.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript) ![Socket.io](https://img.shields.io/badge/Socket.io-4-white?logo=socket.io) ![Three.js](https://img.shields.io/badge/Three.js-r160-black?logo=three.js)

---

## What It Does

**Listen Together** lets a group of people experience music simultaneously:

- **Host** plays music on Spotify — their playback is broadcast to everyone
- **Listeners** (Spotify Premium) get their playback synced automatically
- **Guests** (no account) can listen via YouTube or open songs in Apple Music/Spotify

The interface features a stunning 3D visualization with a reactive orb and spinning vinyl that respond to the music's tempo and energy.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │
│  │   3D Scene    │  │      HUD      │  │  YouTube Player   │   │
│  │  (Three.js)   │  │ (Framer Motion│  │   (IFrame API)    │   │
│  │               │  │  + Tailwind)  │  │                   │   │
│  └───────────────┘  └───────────────┘  └───────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │                    ListenTogether3D                        │  │
│  │   - useSession (NextAuth)                                  │  │
│  │   - useSpotifyPlayer (Web Playback SDK)                   │  │
│  │   - useHostSync / useListenerSync (Socket.io)             │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                        Socket.io
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Custom Node.js Server                        │
│                        (server.js)                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Server-side Polling (every 3 seconds)                  │    │
│  │  - Fetches host's current playback from Spotify API     │    │
│  │  - Broadcasts host_update to all connected clients      │    │
│  │  - Tracks listener count                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Next.js App Router (handles HTTP requests)             │    │
│  │  - /api/auth/* (NextAuth)                               │    │
│  │  - /api/host/playback (host's current track)            │    │
│  │  - /api/spotify/* (play, pause, devices)                │    │
│  │  - /api/music-link (Odesli/song.link)                   │    │
│  │  - /api/youtube/search (video search)                   │    │
│  │  - /api/audio-features (tempo, energy)                  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Spotify    │  │   Odesli    │  │  YouTube (via scraping) │  │
│  │  Web API    │  │  (song.link)│  │  + Invidious fallback   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Roles

### Host
The single designated user (configured via `HOST_SPOTIFY_ID`) who controls playback:
- Plays music on any Spotify client (phone, desktop, web)
- Server polls their playback state every 3 seconds
- All listeners receive real-time updates

### Listener (Spotify Premium)
Authenticated users with Spotify Premium:
- Their browser becomes a Spotify Connect device ("Listen Together")
- Playback syncs automatically with host (same track, same position)
- Can toggle sync on/off
- Can open tracks in Apple Music or Spotify

### Guest
Unauthenticated users:
- See track info, album art, and progress
- Can play along via embedded YouTube player
- Can open tracks in Apple Music or Spotify
- No Spotify account required

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS + Framer Motion |
| **3D Graphics** | Three.js + React Three Fiber + Drei |
| **Real-time** | Socket.io (custom server wrapping Next.js) |
| **Auth** | NextAuth.js with Spotify Provider |
| **Music API** | Spotify Web API + Web Playback SDK |
| **Cross-platform Links** | Odesli (song.link) API |
| **Guest Playback** | YouTube IFrame API |

---

## Project Structure

```
listen-together/
├── server.js                 # Custom Node.js server (Socket.io + Next.js)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/  # NextAuth endpoints
│   │   │   ├── host/playback/       # Get host's current track
│   │   │   ├── spotify/             # Spotify control endpoints
│   │   │   ├── music-link/          # Odesli cross-platform links
│   │   │   ├── youtube/search/      # YouTube video search
│   │   │   └── audio-features/      # Track tempo/energy
│   │   ├── globals.css              # Tailwind + glass effects
│   │   ├── layout.tsx               # Root layout with providers
│   │   └── page.tsx                 # Main page
│   │
│   ├── components/
│   │   ├── ListenTogether3D.tsx     # Main client component (orchestrator)
│   │   ├── YouTubePlayer.tsx        # YouTube IFrame player for guests
│   │   ├── Providers.tsx            # NextAuth + Session provider
│   │   └── three/
│   │       ├── Experience.tsx       # 3D scene setup (Canvas, lights)
│   │       ├── HUD.tsx              # UI overlay (glassmorphic panels)
│   │       ├── ReactiveOrb.tsx      # Animated orb with GLSL shader
│   │       └── Vinyl.tsx            # Spinning vinyl record
│   │
│   ├── hooks/
│   │   ├── useHostSync.ts           # Host: poll & broadcast playback
│   │   ├── useListenerSync.ts       # Listener: receive & sync playback
│   │   └── useSpotifyPlayer.ts      # Spotify Web Playback SDK wrapper
│   │
│   ├── lib/
│   │   ├── auth.ts                  # NextAuth configuration
│   │   ├── socket.ts                # Socket.io client singleton
│   │   ├── spotify.ts               # Spotify API helpers
│   │   └── hostTokenStore.ts        # In-memory host token storage
│   │
│   └── types/
│       ├── spotify.ts               # Spotify type definitions
│       └── next-auth.d.ts           # NextAuth type extensions
│
├── .env.example                     # Environment template
├── Dockerfile                       # Railway deployment
├── railway.json                     # Railway config
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Spotify Developer Account
- Spotify Premium (for playback sync)

### 1. Clone & Install

```bash
git clone <repository-url>
cd listen-together
npm install
```

### 2. Spotify Developer Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add redirect URI: `http://localhost:3000/api/auth/callback/spotify`
4. Note your **Client ID** and **Client Secret**

### 3. Find Your Spotify User ID

The host must be a specific Spotify account. Find your User ID:
- Go to [Spotify Account Overview](https://www.spotify.com/account/overview/)
- Or use the Spotify Web API to get your profile

### 4. Configure Environment

Copy the example and fill in your values:

```bash
cp .env.example .env.local
```

```env
# Spotify API Credentials
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret

# NextAuth (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your_random_secret
NEXTAUTH_URL=http://localhost:3000

# Host Configuration (your Spotify User ID)
HOST_SPOTIFY_ID=your_spotify_user_id
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## How It Works

### Real-time Sync Flow

```
1. Host plays music on Spotify (any device)
           │
           ▼
2. Server polls /api/host/playback every 3 seconds
           │
           ▼
3. Server broadcasts host_update via Socket.io
           │
           ├──────────────────────────────────┐
           ▼                                  ▼
4a. Listener receives update            4b. Guest receives update
    │                                        │
    ▼                                        ▼
5a. Spotify Web Playback SDK            5b. Shows track info
    syncs track + position                   Can play via YouTube
```

### Key Hooks

#### `useHostSync`
- Receives socket events for the host
- Stores and broadcasts current playback state
- Only active when user is the host

#### `useListenerSync`
- Receives `host_update` events from socket
- For Premium listeners: controls Spotify playback
- Maintains sync tolerance (5 seconds drift allowed)
- Provides manual sync trigger

#### `useSpotifyPlayer`
- Initializes Spotify Web Playback SDK
- Registers browser as a Spotify Connect device
- Returns `deviceId` for playback control

---

## 3D Experience

The interface features an immersive 3D scene built with React Three Fiber:

### Components

- **ReactiveOrb**: A glowing sphere with custom GLSL shaders that pulse to the music's tempo and change intensity based on energy
- **Vinyl**: A 3D vinyl record that spins when music plays, with the album art as the label
- **Experience**: Scene setup with lighting, camera controls, and post-processing

### Audio Features

The orb reacts to Spotify's audio analysis:
- **Tempo** (BPM): Controls pulse speed
- **Energy** (0-1): Controls glow intensity and color

---

## Design System

The UI follows Apple/Linear-inspired design principles:

### Glass Panels
```css
backdrop-blur-[40px] saturate-[180%]
bg-black/50
shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]  /* 1px highlight */
```

### Spring Physics (Framer Motion)
```typescript
gentle: { stiffness: 120, damping: 14 }  // Slow, floaty
snappy: { stiffness: 400, damping: 30 }  // Quick, responsive
bouncy: { stiffness: 300, damping: 20 }  // Playful
```

### Typography
- **Font**: Inter with tabular figures for timestamps
- **Tracking**: Tight on headings (`tracking-[-0.02em]`)
- **Hierarchy**: White for primary, white/50 for secondary

---

## Deployment (Railway)

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Create Railway Project

1. Go to [Railway](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Add environment variables (same as `.env.local`)
4. Update `NEXTAUTH_URL` to your Railway domain

### 3. Update Spotify Redirect URI

Add your Railway URL to Spotify Developer Dashboard:
```
https://your-app.up.railway.app/api/auth/callback/spotify
```

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/host/playback` | Returns host's current playing track |
| `POST /api/spotify/play` | Play/pause/seek on listener's device |
| `GET /api/spotify/devices` | List user's Spotify Connect devices |
| `GET /api/music-link` | Get cross-platform links (Odesli) |
| `GET /api/youtube/search` | Search YouTube for a track |
| `GET /api/audio-features` | Get tempo/energy for a track |

---

## Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `host_update` | Server → Client | Broadcast current track state |
| `sync_response` | Server → Client | Initial state for new connections |
| `listener_count` | Server → Client | Number of connected users |
| `request_sync` | Client → Server | Request current host state |

---

## Troubleshooting

### "No active device found"
- Make sure Spotify is open on at least one device
- The browser becomes a device after clicking play

### Sync not working
- Verify you have Spotify Premium
- Check that `HOST_SPOTIFY_ID` matches the logged-in host
- Ensure the listener clicked "Synced" button

### YouTube not playing
- YouTube may block autoplay; click the player to start
- Some videos may be region-restricted

### 3D not loading
- WebGL must be enabled in your browser
- Try refreshing or using Chrome/Edge

---

## License

MIT

---

## Acknowledgments

- [Spotify Web API](https://developer.spotify.com/documentation/web-api/)
- [Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk/)
- [Odesli/song.link](https://odesli.co/) for cross-platform links
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) for 3D
- [Framer Motion](https://www.framer.com/motion/) for animations
