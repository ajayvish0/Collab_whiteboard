import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());
const allowedOrigins = [
  "https://main--collaoboard.netlify.app",
  "https://collaoboard.netlify.app",
  "http://localhost:5173",
];
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  })
);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const sessions = new Map();

app.post("/create-session", (req, res) => {
  const sessionId = uuidv4();
  console.log(sessionId);
  sessions.set(sessionId, { paths: [] });
  res.json({ sessionId });
});

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("join-session", (sessionId) => {
    socket.join(sessionId);
    const session = sessions.get(sessionId);
    if (session) {
      socket.emit("load-canvas", session.paths);
    }
  });

  socket.on("draw", ({ sessionId, path }) => {
    const session = sessions.get(sessionId);
    if (session) {
      session.paths.push(path);
      io.to(sessionId).emit("draw", path); // Broadcast to all clients in the session
    }
  });

  socket.on("clear", (sessionId) => {
    const session = sessions.get(sessionId);
    if (session) {
      session.paths = [];
      io.to(sessionId).emit("clear"); // Broadcast to all clients in the session
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log("Server is running on port 3000");
});
