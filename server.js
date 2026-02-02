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

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Send the latest host state to new listeners
    if (latestHostUpdate) {
      socket.emit("sync_response", latestHostUpdate);
    }

    // Host broadcasts their playback state
    socket.on("host_update", (update) => {
      console.log("Host update received:", update.trackName, update.isPlaying);
      latestHostUpdate = update;
      // Broadcast to all other clients (listeners)
      socket.broadcast.emit("host_update", update);
    });

    // Listener requests sync with current host state
    socket.on("request_sync", () => {
      console.log("Sync requested by:", socket.id);
      if (latestHostUpdate) {
        socket.emit("sync_response", latestHostUpdate);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
