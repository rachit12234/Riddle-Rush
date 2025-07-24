const socket = io();

const playerList = document.getElementById("playerList");
const riddleElement = document.getElementById("riddle");
const timerElement = document.getElementById("timer");
const answerInput = document.getElementById("answerInput");
const submitBtn = document.getElementById("submitAnswer");
const chatBox = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendChat = document.getElementById("sendChat");

const roomCode = localStorage.getItem("roomCode");
const username = localStorage.getItem("username");

socket.emit("join-room", { roomCode, username });

submitBtn.addEventListener("click", () => {
  const answer = answerInput.value.trim();
  if (answer !== "") {
    socket.emit("submit-answer", { roomCode, answer });
    answerInput.value = "";
  }
});

sendChat.addEventListener("click", () => {
  const msg = chatInput.value.trim();
  if (msg !== "") {
    socket.emit("chat", { roomCode, message: msg, username });
    chatInput.value = "";
  }
});

socket.on("players-update", (players) => {
  playerList.innerHTML = "";
  players.forEach((player) => {
    const li = document.createElement("li");
    li.textContent = `${player.username} — ${player.score} pts`;
    playerList.appendChild(li);
  });
});

socket.on("start-game", () => {
  console.log("Game started");
});

socket.on("new-riddle", (riddle) => {
  riddleElement.textContent = riddle;
});

socket.on("timer", (time) => {
  timerElement.textContent = time;
});

socket.on("correct-answer", ({ username, answer }) => {
  const msg = document.createElement("div");
  msg.textContent = `✅ ${username} got it right: "${answer}"`;
  msg.classList.add("chat-message");
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on("wrong-answer", () => {
  const msg = document.createElement("div");
  msg.textContent = `❌ Wrong answer! Try again.`;
  msg.classList.add("chat-message");
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on("chat", ({ username, message }) => {
  const msg = document.createElement("div");
  msg.textContent = `${username}: ${message}`;
  msg.classList.add("chat-message");
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on("game-over", (players) => {
  const sorted = Object.values(players).sort((a, b) => b.score - a.score);
  riddleElement.textContent = "🏁 Game Over!";
  const msg = document.createElement("div");
  msg.innerHTML = `🏆 Winner: <b>${sorted[0].username}</b> with ${sorted[0].score} points!`;
  msg.classList.add("chat-message");
  chatBox.appendChild(msg);
});
