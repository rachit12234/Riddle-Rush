// Server2.js (patched startGame to send data immediately)
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "static")));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "static", "index.html")));
app.get("/lobby", (req, res) => res.sendFile(path.join(__dirname, "static", "lobby.html")));
app.get("/game", (req, res) => res.sendFile(path.join(__dirname, "static", "game.html")));

const riddlesMaster = [
  { question: "What has to be broken before you can use it?", answer: "egg" },
  { question: "I’m tall when I’m young, and I’m short when I’m old. What am I?", answer: "candle" },
  { question: "What month of the year has 28 days?", answer: "all" },
  { question: "What is full of holes but still holds water?", answer: "sponge" },
  { question: "What question can you never answer yes to?", answer: "are you asleep" },
  { question: "What is always in front of you but can’t be seen?", answer: "future" },
  { question: "There’s a one-story house in which everything is yellow. What color are the stairs?", answer: "no stairs" },
  { question: "What can you break, even if you never pick it up or touch it?", answer: "promise" },
  { question: "What goes up but never comes down?", answer: "age" },
  { question: "What gets wet while drying?", answer: "towel" }
];

const rooms = {};

function uniqRoomCode() {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms[code]);
  return code;
}

function pickRiddles(rounds) {
  const pool = [...riddlesMaster];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(rounds, pool.length));
}

io.on("connection", (socket) => {
  function getSocketRoom() {
    for (const code in rooms) {
      if (rooms[code].players.has(socket.id)) return code;
    }
    return null;
  }

  socket.on("newRoom", () => {
    const roomCode = uniqRoomCode();
    rooms[roomCode] = {
      players: new Map(),
      host: null,
      settings: null,
      started: false,
      riddles: [],
      currentRound: 0,
      answered: new Set(),
      roundLocked: false
    };
    socket.emit("roomCodeGenerated", roomCode);
  });

  socket.on("lobbyJoined", (roomCode, username) => {
    if (!roomCode || !rooms[roomCode]) {
      socket.emit("joinError", "Room not found.");
      return;
    }
    if (!username || !username.trim()) {
      socket.emit("joinError", "Invalid username.");
      return;
    }
    rooms[roomCode].players.set(socket.id, { username: username.trim(), score: 0 });
    if (!rooms[roomCode].host) rooms[roomCode].host = socket.id;

    socket.join(roomCode);
    const playersArr = [...rooms[roomCode].players.values()].map(p => p.username);
    const hostName = rooms[roomCode].players.get(rooms[roomCode].host)?.username || "";
    io.to(roomCode).emit("updatePlayers", playersArr, hostName);
  });

  socket.on("startGame", (roomCode, settingsObj) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (socket.id !== room.host) {
      socket.emit("errorMsg", "Only the host can start the game.");
      return;
    }

    const def = { timeLimit: 60, difficulty: "easy", category: "random", rounds: 5, hintMode: false };
    const settings = {
      timeLimit: Number(settingsObj?.timeLimit) || def.timeLimit,
      difficulty: String(settingsObj?.difficulty || def.difficulty),
      category: String(settingsObj?.category || def.category),
      rounds: Number(settingsObj?.rounds) || def.rounds,
      hintMode: !!settingsObj?.hintMode
    };

    room.settings = settings;
    room.started = true;
    room.riddles = pickRiddles(settings.rounds);
    room.currentRound = 0;
    room.answered = new Set();
    room.roundLocked = false;

    for (let player of room.players.values()) player.score = 0;

    // Send data before redirect
    io.to(roomCode).emit("parameters", [
      settings.timeLimit,
      settings.difficulty,
      settings.category,
      settings.rounds,
      settings.hintMode
    ]);
    io.to(roomCode).emit("riddles", room.riddles);
    io.to(roomCode).emit("nextRound", 0);

    // Trigger game start navigation
    io.to(roomCode).emit("gameStarted");
  });

  socket.on("joinGame", (roomCode, username) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit("joinError", "Room not found.");
      return;
    }
    if (!room.players.has(socket.id)) {
      room.players.set(socket.id, { username: username || "Player", score: 0 });
    }
    socket.join(roomCode);

    socket.emit("parameters", [
      room.settings?.timeLimit ?? 60,
      room.settings?.difficulty ?? "easy",
      room.settings?.category ?? "random",
      room.settings?.rounds ?? 5,
      room.settings?.hintMode ?? false
    ]);
    socket.emit("riddles", room.riddles);
    socket.emit("nextRound", room.currentRound || 0);

    const playersArr = [...room.players.values()].map(p => p.username);
    const hostName = room.players.get(room.host)?.username || "";
    io.to(roomCode).emit("updatePlayers", playersArr, hostName);
  });

  socket.on("submitAnswer", (answer) => {
    const roomCode = getSocketRoom();
    if (!roomCode) return;
    const room = rooms[roomCode];
    if (!room) return;

    if (room.answered.has(socket.id)) return;
    room.answered.add(socket.id);

    const currentRiddle = room.riddles[room.currentRound];
    const correct = String(answer).trim().toLowerCase() === currentRiddle.answer.toLowerCase();

    if (correct && !room.roundLocked) {
      const player = room.players.get(socket.id);
      if (player) player.score += 10;
      room.roundLocked = true;
      advanceRoundOrEnd(roomCode);
    } else if (room.answered.size >= room.players.size) {
      advanceRoundOrEnd(roomCode);
    }
  });

  function advanceRoundOrEnd(roomCode) {
    const room = rooms[roomCode];
    room.currentRound++;
    room.answered.clear();
    room.roundLocked = false;

    if (room.currentRound >= room.settings.rounds || room.currentRound >= room.riddles.length) {
      endGame(roomCode);
    } else {
      io.to(roomCode).emit("nextRound", room.currentRound);
    }
  }

  function endGame(roomCode) {
    const room = rooms[roomCode];
    const maxScore = Math.max(...[...room.players.values()].map(p => p.score));
    const winners = [...room.players.values()]
      .filter(p => p.score === maxScore)
      .map(p => p.username);
    io.to(roomCode).emit("gameOver", {
      winners,
      scores: [...room.players.values()]
    });
    room.started = false;
  }

  socket.on("playAgain", () => {
    const roomCode = getSocketRoom();
    const room = rooms[roomCode];
    room.riddles = pickRiddles(room.settings.rounds);
    room.currentRound = 0;
    room.answered.clear();
    room.roundLocked = false;
    room.started = true;
    for (let player of room.players.values()) player.score = 0;

    io.to(roomCode).emit("parameters", [
      room.settings.timeLimit,
      room.settings.difficulty,
      room.settings.category,
      room.settings.rounds,
      room.settings.hintMode
    ]);
    io.to(roomCode).emit("riddles", room.riddles);
    io.to(roomCode).emit("restartGame");
    io.to(roomCode).emit("nextRound", 0);
  });

  socket.on("chat", (text) => {
    const roomCode = getSocketRoom();
    if (!roomCode) return;
    const user = rooms[roomCode].players.get(socket.id)?.username || "Anon";
    io.to(roomCode).emit("chat", { user, text: String(text || "").slice(0, 500), ts: Date.now() });
  });

  socket.on("disconnect", () => {
    const code = getSocketRoom();
    if (!code || !rooms[code]) return;
    rooms[code].players.delete(socket.id);
    if (rooms[code].host === socket.id) {
      rooms[code].host = [...rooms[code].players.keys()][0] || null;
    }
    const playersArr = [...rooms[code].players.values()].map(p => p.username);
    const hostName = rooms[code].players.get(rooms[code].host)?.username || "";
    io.to(code).emit("updatePlayers", playersArr, hostName);
    if (!rooms[code].players.size) delete rooms[code];
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
