const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Store the latest host state for new listeners
let latestHostUpdate = null;
let lastTrackUri = null;
let lastIsPlaying = null;

// Poll interval in milliseconds (3 seconds for responsive sync)
const POLL_INTERVAL = 3000;

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(httpServer, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Server-side polling of host's playback
  async function pollHostPlayback() {
    try {
      // Add timestamp to bust any caching
      const response = await fetch(`http://${hostname}:${port}/api/host/playback?t=${Date.now()}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Only log once every 30 seconds to avoid spam
          if (!pollHostPlayback.lastAuthLog || Date.now() - pollHostPlayback.lastAuthLog > 30000) {
            console.log("Host not authenticated yet. Waiting for host to log in...");
            pollHostPlayback.lastAuthLog = Date.now();
          }
        }
        return;
      }

      const data = await response.json();
      
      if (!data.track) {
        return;
      }

      const update = {
        trackUri: data.track?.uri || null,
        trackName: data.track?.name || null,
        artistName: data.track?.artists || null,
        albumName: data.track?.album || null,
        albumImageUrl: data.track?.albumImage || null,
        isPlaying: data.playing,
        progressMs: data.progressMs || 0,
        durationMs: data.track?.durationMs || 0,
        timestamp: Date.now(),
      };

      // Check if state changed significantly
      const trackChanged = lastTrackUri !== update.trackUri;
      const playStateChanged = lastIsPlaying !== update.isPlaying;

      // Always update the latest state
      latestHostUpdate = update;
      lastTrackUri = update.trackUri;
      lastIsPlaying = update.isPlaying;

      // Broadcast to all listeners on every poll
      const connectedClients = io.engine.clientsCount;
      if (trackChanged || playStateChanged) {
        console.log("Broadcasting host update:", update.trackName, update.isPlaying ? "playing" : "paused", "to", connectedClients, "clients");
      }
      if (connectedClients > 0) {
        io.emit("host_update", update);
      }
    } catch (error) {
      // Server might not be ready yet, ignore errors during startup
      if (!error.message.includes("ECONNREFUSED")) {
        console.error("Error polling host playback:", error.message);
      }
    }
  }

  // Start polling after server is ready
  let pollInterval;
  setTimeout(() => {
    console.log("Starting host playback polling...");
    pollHostPlayback(); // Initial poll
    pollInterval = setInterval(pollHostPlayback, POLL_INTERVAL);
  }, 3000);

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Send the latest host state to new listeners
    if (latestHostUpdate) {
      socket.emit("sync_response", latestHostUpdate);
    }

    // Host can also broadcast directly (if they're on the page)
    socket.on("host_update", (update) => {
      console.log("Host update from client:", update.trackName, update.isPlaying);
      latestHostUpdate = update;
      lastTrackUri = update.trackUri;
      lastIsPlaying = update.isPlaying;
      socket.broadcast.emit("host_update", update);
    });

    // Listener requests sync with current host state
    socket.on("request_sync", () => {
      console.log("Sync requested by:", socket.id, "- latestHostUpdate:", latestHostUpdate?.trackName || "null");
      if (latestHostUpdate) {
        console.log("Sending sync_response to", socket.id, ":", latestHostUpdate.trackName);
        socket.emit("sync_response", latestHostUpdate);
      } else {
        console.log("No latestHostUpdate available yet");
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      clearInterval(pollInterval);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
