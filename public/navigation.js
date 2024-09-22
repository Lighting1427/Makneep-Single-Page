export function setupNavigation(socket) {
    document.getElementById('playWithAIButton').addEventListener('click', () => {
        socket.emit('playWithAI');
        navigateToGame();
    });

    document.getElementById('playMultiplayerButton').addEventListener('click', () => {
        navigateToMultiplayerOptions();
        socket.emit('requestRoomList');
    });

    document.getElementById('createRoomButton').addEventListener('click', () => {
        socket.emit('createRoom');
    });

    document.getElementById('joinRoomButton').addEventListener('click', () => {
        const roomId = document.getElementById('roomIdInput').value;
        socket.emit('joinRoom', roomId);
    });

    document.getElementById('backToPlayOptionsFromMultiplayer').addEventListener('click', () => {
        navigateToPlayOptions();
    });

    document.getElementById('backToMultiplayerFromGame').addEventListener('click', () => {
        socket.emit('leaveRoom');
        navigateToPlayOptions();
    });

    socket.on('roomCreated', (roomId) => {
        alert(`Room created with ID: ${roomId}`);
        navigateToGame();
    });

    socket.on('roomJoined', ({ roomId, isSpectator }) => {
        alert(`Joined room: ${roomId}${isSpectator ? ' as a spectator' : ''}`);
        navigateToGame();
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

export function navigateToPlayOptions() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('playOptions').style.display = 'block';
    document.getElementById('multiplayerOptions').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('moveHistoryContainer').style.display = 'none';
    document.getElementById('colorSelectButtons').style.display = 'none';
}

export function navigateToMultiplayerOptions() {
    document.getElementById('playOptions').style.display = 'none';
    document.getElementById('multiplayerOptions').style.display = 'block';
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('moveHistoryContainer').style.display = 'none';
    document.getElementById('colorSelectButtons').style.display = 'none';
}

export function navigateToGame() {
    document.getElementById('playOptions').style.display = 'none';
    document.getElementById('multiplayerOptions').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';
    document.getElementById('moveHistoryContainer').style.display = 'block';
    document.getElementById('colorSelectButtons').style.display = 'block';
}

