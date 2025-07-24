const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

// Serve static files from /public
app.use(express.static(path.join(__dirname, "static")));

// Optional: Serve index.html for the root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "static", "index.html"));
});

// Sample riddles
const riddles = [
  { question: "What has to be broken before you can use it?", answer: "egg" },
  { question: "I’m tall when I’m young, and I’m short when I’m old. What am I?", answer: "candle" },
  { question: "What month of the year has 28 days?", answer: "all" },
  { question: "What is full of holes but still holds water?", answer: "sponge" },
];

// Room structure
const rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomCode, username }) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: {},
        currentRiddleIndex: 0,
        timer: null,
      };
    }

    rooms[roomCode].players[socket.id] = {
      username,
      score: 0,
    };

    socket.join(roomCode);
    updatePlayers(roomCode);

    // Auto-start when 2 players join
    if (Object.keys(rooms[roomCode].players).length === 2) {
      startGame(roomCode);
    }
  });

  socket.on("submit-answer", ({ roomCode, answer }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const riddle = riddles[room.currentRiddleIndex];
    if (riddle && riddle.answer.toLowerCase() === answer.toLowerCase().trim()) {
      room.players[socket.id].score += 1;
      io.to(roomCode).emit("correct-answer", {
        userId: socket.id,
        username: room.players[socket.id].username,
        answer,
      });
      nextRiddle(roomCode);
    } else {
      socket.emit("wrong-answer");
    }
  });

  socket.on("chat", ({ roomCode, message, username }) => {
    io.to(roomCode).emit("chat", { message, username });
  });

  socket.on("disconnect", () => {
    for (let roomCode in rooms) {
      if (rooms[roomCode].players[socket.id]) {
        delete rooms[roomCode].players[socket.id];
        updatePlayers(roomCode);

        // Clean room if empty
        if (Object.keys(rooms[roomCode].players).length === 0) {
          clearTimeout(rooms[roomCode].timer);
          delete rooms[roomCode];
        }
      }
    }
  });

  function updatePlayers(roomCode) {
    const players = Object.entries(rooms[roomCode].players).map(([id, info]) => ({
      id,
      ...info,
    }));
    io.to(roomCode).emit("players-update", players);
  }

  function startGame(roomCode) {
    io.to(roomCode).emit("start-game");
    sendRiddle(roomCode);
  }

  function sendRiddle(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    const riddle = riddles[room.currentRiddleIndex];
    if (!riddle) {
      io.to(roomCode).emit("game-over", room.players);
      return;
    }

    io.to(roomCode).emit("new-riddle", riddle.question);
    let timeLeft = 30;
    io.to(roomCode).emit("timer", timeLeft);

    room.timer = setInterval(() => {
      timeLeft--;
      io.to(roomCode).emit("timer", timeLeft);

      if (timeLeft <= 0) {
        clearInterval(room.timer);
        nextRiddle(roomCode);
      }
    }, 1000);
  }

  function nextRiddle(roomCode) {
    clearInterval(rooms[roomCode].timer);
    rooms[roomCode].currentRiddleIndex++;
    sendRiddle(roomCode);
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});