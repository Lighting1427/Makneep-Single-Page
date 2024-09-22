export function setupPlayOptions(socket) {
    document.getElementById('playMultiplayerButton').addEventListener('click', () => {
        
        document.getElementById('multiplayerOptions').style.display = 'block';
        document.getElementById('playOptions').style.display = 'none';
        socket.emit('requestRoomList'); 
    });

    document.getElementById('playWithAIButton').addEventListener('click', () => {
        
        socket.emit('playWithAI');
    });
}
