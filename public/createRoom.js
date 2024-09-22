export function setupCreateRoom(socket) {
    document.getElementById('createRoomButton').addEventListener('click', () => {
        socket.emit('createRoom');
    });

    socket.on('roomCreated', (roomId) => {
        alert(`Room created with ID: ${roomId}`);
        document.getElementById('playOptions').style.display = 'none'; 
        document.getElementById('multiplayerOptions').style.display = 'none'; 
        document.getElementById('gameContainer').style.display = 'block'; 
        document.getElementById('moveHistoryContainer').style.display = 'block';
        document.getElementById('colorSelectButtons').style.display = 'block';
    });
}
