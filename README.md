# Listen Together

A real-time "Listen Along" web application where "Listener" users automatically play the same song at the same timestamp as the "Host" user.

![Listen Together](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?style=flat-square&logo=tailwindcss)
![Socket.io](https://img.shields.io/badge/Socket.io-4-black?style=flat-square&logo=socket.io)

## Features

- **Real-time Sync**: Listeners automatically play the same song at the same timestamp as the Host
- **Host/Listener Roles**: One designated host controls playback, everyone else listens along
- **Spotify Integration**: Uses Spotify Web API and Web Playback SDK
- **Beautiful Dark UI**: Clean, modern player interface
- **Manual Sync**: "Sync Now" button for listeners to resync if they drift

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Real-time**: Socket.io
- **Auth**: NextAuth.js with Spotify Provider
- **API**: Spotify Web API & Web Playback SDK

## Prerequisites

Before you begin, you'll need:

1. **Spotify Premium Account** - Required for the Web Playback SDK to work
2. **Spotify Developer Account** - To get API credentials

## Setup

### 1. Create Spotify Developer App

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in and create a new app
3. Note your **Client ID** and **Client Secret**
4. In your app settings, add Redirect URI:
   ```
   http://localhost:3000/api/auth/callback/spotify
   ```

### 2. Find Your Spotify User ID

Your Spotify User ID is needed to designate the Host. You can find it:

- **Method 1**: Go to [your Spotify account overview](https://www.spotify.com/account/overview/) - your username is your user ID
- **Method 2**: In Spotify, go to Profile → Share → Copy link to profile → the ID is in the URL
- **Method 3**: Use the [Spotify Web API](https://developer.spotify.com/documentation/web-api/reference/get-current-users-profile)

### 3. Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
NEXTAUTH_SECRET=generate_a_random_string
NEXTAUTH_URL=http://localhost:3000
HOST_SPOTIFY_ID=your_spotify_username
```

To generate a random secret:
```bash
openssl rand -base64 32
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

### For the Host

1. Log in with your designated Host Spotify account
2. Start playing music in any Spotify app (desktop, mobile, web player)
3. The app polls your playback state every 5 seconds
4. When something changes (new track, play/pause), it broadcasts to all listeners

### For Listeners

1. Log in with any Spotify Premium account
2. The app initializes the Spotify Web Playback SDK in your browser
3. When the Host's state changes, your playback automatically syncs
4. Use the "Sync Now" button if you get out of sync

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│     Host        │     │    Listener     │
│  Spotify App    │     │   Web Player    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │  Polls every 5s       │
         ▼                       │
┌─────────────────┐              │
│   Next.js API   │              │
│  /currently-    │              │
│    playing      │              │
└────────┬────────┘              │
         │                       │
         │  Broadcasts           │
         ▼                       │
┌─────────────────┐              │
│   Socket.io     │──────────────┤
│    Server       │   host_update│
└─────────────────┘              │
                                 │
                                 ▼
                    ┌─────────────────┐
                    │ Spotify Web API │
                    │  /me/player/    │
                    │     play        │
                    └─────────────────┘
```

## API Routes

- `GET /api/auth/[...nextauth]` - NextAuth.js authentication
- `GET /api/spotify/currently-playing` - Get host's current playback state
- `POST /api/spotify/play` - Control playback (play, pause, seek)
- `GET /api/spotify/devices` - List available Spotify devices
- `POST /api/spotify/devices` - Transfer playback to a device

## Socket Events

- `host_update` - Emitted by host when playback state changes
- `request_sync` - Emitted by listener to request current state
- `sync_response` - Response to sync request with current host state

## Scopes

The app requests the following Spotify scopes:

| Scope | Purpose |
|-------|---------|
| `streaming` | Required for Web Playback SDK |
| `user-read-email` | Get user profile info |
| `user-read-private` | Get user profile info |
| `user-read-currently-playing` | Host: Read current playback |
| `user-read-playback-state` | Host: Read playback state |
| `user-modify-playback-state` | Listener: Control playback |

## Troubleshooting

### "Premium Required" Error
The Spotify Web Playback SDK requires a Premium subscription. Free accounts cannot use the web player.

### Player Not Initializing
- Make sure you have Spotify Premium
- Check browser console for errors
- Try refreshing the page

### Sync Issues
- Click "Sync Now" to manually resync
- Check that the Host is actively playing music
- Ensure both Host and Listener are logged in

### Authentication Errors
- Verify your environment variables are correct
- Check that the redirect URI in your Spotify app matches exactly
- Make sure NEXTAUTH_SECRET is set

## License

MIT
