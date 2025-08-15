// game-logic.js
const socket = io();

const clock = document.getElementById("timer");
const riddleEl = document.getElementById("riddle");
const submitBtn = document.getElementById("submitAnswer");
const answerInput = document.getElementById("answerInput");
const chatInput = document.getElementById("chatInput");
const sendChat = document.getElementById("sendChat");
const chatMessages = document.getElementById("chatMessages");
const playerList = document.getElementById("playerList");

const roomCode = sessionStorage.getItem("roomCode");
const username = sessionStorage.getItem("username");

if (!roomCode || !username) {
  window.location.href = "/";
}

let parameters = [];      // [timeLimit, difficulty, category, rounds, hintMode]
let riddles = [];         // array of {question, answer}
let currentRoundIndex = 0;
let time = 0;
let timerInterval = null;
let roundActive = false;

socket.emit("joinGame", roomCode, username);

// update player list
socket.on("updatePlayers", (players, host) => {
  playerList.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p + (p === host ? " 👑" : "");
    playerList.appendChild(li);
  });
});

// receive params
socket.on("parameters", (settingsArray) => {
  parameters = settingsArray;
});

// receive riddles and auto-start when nextRound arrives
socket.on("riddles", (riddleList) => {
  riddles = Array.isArray(riddleList) ? [...riddleList] : [];
});

// nextRound tells clients which round index to display
socket.on("nextRound", (roundNum) => {
  clearInterval(timerInterval);
  currentRoundIndex = roundNum;
  // if out of bounds, show game over wait (server usually emits gameOver)
  if (!riddles || !riddles[currentRoundIndex]) {
    riddleEl.textContent = "Waiting for server...";
    submitBtn.disabled = true;
    answerInput.disabled = true;
    roundActive = false;
    return;
  }
  showRiddle();
});

// timer start
function startTimer() {
  clearInterval(timerInterval);
  time = Number(parameters[0]) || 60;
  clock.textContent = time;
  roundActive = true;

  timerInterval = setInterval(() => {
    time -= 1;
    clock.textContent = time;
    if (time <= 0) {
      clearInterval(timerInterval);
      roundActive = false;
      // Emit empty answer to indicate timeout (server treats as answered-but-wrong)
      socket.emit("submitAnswer", "");
    }
  }, 1000);
}

function showRiddle() {
  const r = riddles[currentRoundIndex];
  if (!r) {
    riddleEl.textContent = "No riddle available.";
    submitBtn.disabled = true;
    answerInput.disabled = true;
    return;
  }

  riddleEl.textContent = r.question;
  answerInput.value = "";
  submitBtn.disabled = false;
  answerInput.disabled = false;
  answerInput.focus();
  startTimer();
}

// submit click handler
submitBtn.onclick = () => {
  if (!roundActive) return; // prevent double sends
  const ans = (answerInput.value || "").trim();
  // disable inputs locally to avoid double submits until nextRound arrives
  submitBtn.disabled = true;
  answerInput.disabled = true;
  roundActive = false;
  clearInterval(timerInterval);
  socket.emit("submitAnswer", ans);
};

// enter key
answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitBtn.click();
});

// game over display
socket.on("gameOver", ({ winners, scores }) => {
  clearInterval(timerInterval);
  roundActive = false;

  riddleEl.innerHTML = `<div style="margin-bottom:0.5rem">🎉 Game Over!</div>
    <div style="margin-bottom:0.5rem">Winner${winners.length > 1 ? "s" : ""}: ${winners.join(", ")}</div>`;

  const scoreList = document.createElement("ul");
  scores.forEach(s => {
    const li = document.createElement("li");
    li.textContent = `${s.username}: ${s.score} pts`;
    scoreList.appendChild(li);
  });
  riddleEl.appendChild(scoreList);

  // hide inputs
  submitBtn.style.display = "none";
  answerInput.style.display = "none";

  // buttons wrapper
  const btnWrap = document.createElement("div");
  btnWrap.style.marginTop = "0.6rem";
  btnWrap.style.display = "flex";
  btnWrap.style.gap = "0.5rem";

  const playAgainBtn = document.createElement("button");
  playAgainBtn.textContent = "🔄 Play Again";
  playAgainBtn.onclick = () => {
    // show UI immediately while server restarts
    submitBtn.style.display = "inline-block";
    answerInput.style.display = "inline-block";
    riddleEl.textContent = "Restarting...";
    socket.emit("playAgain");
  };

  const backLobbyBtn = document.createElement("button");
  backLobbyBtn.textContent = "⬅ Back to Lobby";
  backLobbyBtn.onclick = () => {
    window.location.href = `/lobby?roomCode=${roomCode}&username=${username}`;
  };

  btnWrap.appendChild(playAgainBtn);
  btnWrap.appendChild(backLobbyBtn);
  riddleEl.appendChild(btnWrap);
});

// restartGame: server told us a new game has been prepared
socket.on("restartGame", () => {
  // clear UI and wait for nextRound event
  clearInterval(timerInterval);
  submitBtn.style.display = "inline-block";
  answerInput.style.display = "inline-block";
  submitBtn.disabled = true;
  answerInput.disabled = true;
  riddleEl.textContent = "Preparing new game...";
});

// chat rendering
function renderChat({ user, text }) {
  const p = document.createElement("p");
  p.textContent = `${user}: ${text}`;
  chatMessages.appendChild(p);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendChat.onclick = () => {
  const message = (chatInput.value || "").trim();
  if (message) {
    socket.emit("chat", message);
    chatInput.value = "";
  }
};
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChat.click();
});
socket.on("chat", renderChat);
