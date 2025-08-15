const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

app.use(express.static(path.join(__dirname, "static")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "static", "Landing page", "index.html"));
});

const riddles = [
  { question: "What has to be broken before you can use it?", answer: "egg" },
  { question: "I’m tall when I’m young, and I’m short when I’m old. What am I?", answer: "candle" },
  { question: "What month of the year has 28 days?", answer: "all" },
  { question: "What is full of holes but still holds water?", answer: "sponge" },
  { question: "What question can you never answer yes to?", answer: "are you asleep" },
  { question: "What is always in front of you but can’t be seen?", answer: "future" },
  { question: "There’s a one-story house in which everything is yellow. What color are the stairs?", answer: "no stairs" },
  { question: "What can you break, even if you never pick it up or touch it?", answer: "promise" },
  { question: "What goes up but never comes down?", answer: "age" },
  { question: "A man who was outside in the rain without an umbrella didn’t get a single hair on his head wet. Why?", answer: "he was bald" },
  { question: "What gets wet while drying?", answer: "towel" },
  { question: "What can you keep after giving to someone?", answer: "your word" },
  { question: "I shave every day, but my beard stays the same. What am I?", answer: "barber" },
  { question: "You see a boat filled with people. It hasn’t sunk, but when you look again, you don’t see a single person. Why?", answer: "all married" },
  { question: "What can’t talk but will reply when spoken to?", answer: "echo" },
  { question: "The more of this there is, the less you see. What is it?", answer: "darkness" },
  { question: "David’s parents have three sons: Snap, Crackle, and ___?", answer: "david" },
  { question: "What has many keys but can’t open a single lock?", answer: "piano" },
  { question: "What can travel around the world while staying in the same corner?", answer: "stamp" },
  { question: "What has hands but can’t clap?", answer: "clock" },
  { question: "What has a head, a tail, but no body?", answer: "coin" },
  { question: "What comes once in a minute, twice in a moment, but never in a thousand years?", answer: "m" },
  { question: "What begins with T, ends with T, and has T in it?", answer: "teapot" },
  { question: "What kind of band never plays music?", answer: "rubber band" },
  { question: "What has one eye but can’t see?", answer: "needle" },
  { question: "What invention lets you look right through a wall?", answer: "window" },
  { question: "What runs all around a backyard, yet never moves?", answer: "fence" },
  { question: "What can fill a room but takes up no space?", answer: "light" },
  { question: "If you drop me I’m sure to crack, but give me a smile and I’ll always smile back. What am I?", answer: "mirror" },
  { question: "I have branches, but no fruit, trunk or leaves. What am I?", answer: "bank" }
];


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