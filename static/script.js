const socket = io();

const inputName = document.getElementById("username");
const inputRoomCode = document.getElementById("roomcode");
const inputJoinRoom = document.getElementById("joinRoom");
const inputCreateRoom = document.getElementById("createRoom");

inputJoinRoom.onclick = () => {
  const name = inputName.value.trim();
  const roomCode = inputRoomCode.value.trim();

  if (name === "" && roomCode === "") {
    alert("Enter the name and the room code");
  } else if (name === "") {
    alert("Enter the name");
  } else if (roomCode === "") {
    alert("Enter the room code");
  } else {
    socket.emit("joinRoom", roomCode, name);
    console.log(roomCode, name)
  }
};

inputCreateRoom.onclick = () => {
  const name = inputName.value.trim();
  if (name === "") {
    alert("Enter the name");
  } else {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    inputRoomCode.value = roomCode;
    socket.emit("createRoom", roomCode, name);
    console.log(roomCode, name)
  }
};

socket.on("roomJoined", (roomCode, name) => {
  sessionStorage.setItem("roomCode", roomCode);
  sessionStorage.setItem("username", name);
  window.location.href = "/lobby";
});
