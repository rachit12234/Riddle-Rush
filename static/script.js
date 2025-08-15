// script.js
const socket = io();

const usernameInput = document.getElementById("username");
const createBtn = document.getElementById("createRoom");
const joinBtn = document.getElementById("joinRoom");
const roomInput = document.getElementById("roomcode");

function getName() {
  return (usernameInput.value || "").trim();
}

createBtn.addEventListener("click", () => {
  const username = getName();
  if (!username) {
    alert("Enter a username");
    return;
  }
  sessionStorage.setItem("username", username);
  socket.emit("newRoom");
});

socket.on("roomCodeGenerated", (roomCode) => {
  sessionStorage.setItem("roomCode", roomCode);
  // Pass params via URL strictly for lobby display; game will use sessionStorage
  window.location.href = `/lobby?roomCode=${encodeURIComponent(roomCode)}&username=${encodeURIComponent(getName())}`;
});

joinBtn.addEventListener("click", () => {
  const username = getName();
  const roomCode = (roomInput.value || "").trim();
  if (!username || !roomCode) {
    alert("Enter username and room code");
    return;
  }
  sessionStorage.setItem("username", username);
  sessionStorage.setItem("roomCode", roomCode);
  window.location.href = `/lobby?roomCode=${encodeURIComponent(roomCode)}&username=${encodeURIComponent(username)}`;
});
