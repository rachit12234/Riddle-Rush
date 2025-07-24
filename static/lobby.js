const socket = io();

// DOM elements
const roomCodeSpan = document.getElementById("roomCodeDisplay");
const playerList = document.getElementById("playerList");
const startGameBtn = document.getElementById("startGame");

// Game settings selectors
const timeLimit = document.getElementById("timeLimit");
const difficulty = document.getElementById("difficulty");
const category = document.getElementById("category");
const rounds = document.getElementById("rounds");
const hintMode = document.getElementById("hintMode");

// Get data from sessionStorage
const roomCode = sessionStorage.getItem("roomCode");
const username = sessionStorage.getItem("username");
roomCodeSpan.innerText = roomCode;

// Emit join confirmation
socket.emit("lobbyJoined", roomCode, username);

// Update player list
socket.on("updatePlayers", (players, host) => {
  playerList.innerHTML = "";
  players.forEach((player) => {
    const li = document.createElement("li");
    li.innerText = player;
    if (player === host) li.innerText += " 👑";
    playerList.appendChild(li);
  });

  // Show "Start Game" only if you're the host
  startGameBtn.style.display = username === host ? "block" : "none";
});

// Start Game button
startGameBtn.onclick = () => {
  const settings = {
    timeLimit: parseInt(timeLimit.value),
    difficulty: difficulty.value,
    category: category.value,
    rounds: parseInt(rounds.value),
    hintMode: hintMode.value === "true"
  };

  socket.emit("startGame", roomCode, settings);
};

// Navigate to game page when game starts
socket.on("gameStarted", () => {
  window.location.href = "/game";
});

// Copy room code on click
roomCodeSpan.addEventListener("click", () => {
  navigator.clipboard.writeText(roomCode).then(() => {
    const originalText = roomCodeSpan.innerText;
    roomCodeSpan.innerText = "Copied!";
    setTimeout(() => {
      roomCodeSpan.innerText = originalText;
    }, 1000);
  });
});