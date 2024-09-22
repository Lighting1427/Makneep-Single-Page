export function setupJoinRoom(socket) {
    document.getElementById('joinRoomButton').addEventListener('click', () => {
        const roomId = document.getElementById('roomIdInput').value;
        socket.emit('joinRoom', roomId);
    });

    socket.on('roomJoined', ({ roomId, isSpectator }) => {
        alert(`Joined room: ${roomId}${isSpectator ? ' as a spectator' : ''}`);
        document.getElementById('playOptions').style.display = 'none'; 
        document.getElementById('multiplayerOptions').style.display = 'none'; 
        document.getElementById('gameContainer').style.display = 'block'; 
        document.getElementById('moveHistoryContainer').style.display = 'block';
        if (!isSpectator) {
            document.getElementById('colorSelectButtons').style.display = 'block';
        }
    });

    socket.on('roomFull', () => {
        alert('Room is full. Please join another room or create a new one.');
    });

    socket.on('roomNotFound', () => {
        alert('Room not found. Please check the Room ID and try again.');
    });

    socket.on('roomList', (roomList) => {
        const roomListContainer = document.getElementById('roomList');
        roomListContainer.innerHTML = ''; 
        roomList.forEach(room => {
            const roomElement = document.createElement('div');
            roomElement.textContent = `Room ${room.roomId}: ${room.occupancy}/${room.capacity}`;
            const joinButton = document.createElement('button');
            joinButton.textContent = 'Join Room';
            joinButton.addEventListener('click', () => {
                socket.emit('joinRoom', room.roomId);
            });
            roomElement.appendChild(joinButton);
            roomListContainer.appendChild(roomElement);
        });
    });
}
