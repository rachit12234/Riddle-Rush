// lobby.js
const socket = io();

const params = new URLSearchParams(window.location.search);
const roomCode = params.get("roomCode") || sessionStorage.getItem("roomCode");
const username = params.get("username") || sessionStorage.getItem("username");

// DOM elements
const roomCodeSpan = document.getElementById("roomCodeDisplay");
const playerList = document.getElementById("playerList");
const startGameBtn = document.getElementById("startGame");
const lobbyError = document.getElementById("lobbyError");

const timeLimit = document.getElementById("timeLimit");
const difficulty = document.getElementById("difficulty");
const category = document.getElementById("category");
const rounds = document.getElementById("rounds");
const hintMode = document.getElementById("hintMode");

// Validate session
if (!roomCode || !username) {
  window.location.href = "/";
}

roomCodeSpan.textContent = roomCode;

// Tell server we've joined the lobby
socket.emit("lobbyJoined", roomCode, username);

// Error from server (bad room, bad username, etc.)
socket.on("joinError", (msg) => {
  lobbyError.style.display = "block";
  lobbyError.textContent = msg || "Unable to join lobby.";
});

// Update player list
socket.on("updatePlayers", (players, host) => {
  playerList.innerHTML = "";
  players.forEach((player) => {
    const li = document.createElement("li");
    li.textContent = player + (player === host ? " 👑" : "");
    playerList.appendChild(li);
  });

  // Show "Start Game" only for host
  startGameBtn.style.display = username === host ? "block" : "none";
});

// Start Game button
startGameBtn.onclick = () => {
  const settingsObj = {
    timeLimit: parseInt(timeLimit.value, 10),
    difficulty: difficulty.value,
    category: category.value,
    rounds: parseInt(rounds.value, 10),
    hintMode: hintMode.value === "true"
  };
  socket.emit("startGame", roomCode, settingsObj);
};

// Navigate to game page
socket.on("gameStarted", () => {
  // keep sessionStorage as the source of truth
  sessionStorage.setItem("roomCode", roomCode);
  sessionStorage.setItem("username", username);
  window.location.href = "/game";
});

// Copy code on click
roomCodeSpan.addEventListener("click", () => {
  navigator.clipboard.writeText(roomCode).then(() => {
    const original = roomCodeSpan.textContent;
    roomCodeSpan.textContent = "Copied!";
    setTimeout(() => (roomCodeSpan.textContent = original), 1000);
  });
});
