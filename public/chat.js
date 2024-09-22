let chatSendButtonClickListener = null;

export function setupChat(socket, playerName, playerColor) {
  const chatInput = document.getElementById('chatInput');
  const chatSendButton = document.getElementById('chatSendButton');
  const chatDisplay = document.getElementById('chatDisplay');

  if (chatSendButtonClickListener) {
    chatSendButton.removeEventListener('click', chatSendButtonClickListener);
  }
  
  chatSendButtonClickListener = () => {
    const message = chatInput.value;
    if (message.trim()) {
      socket.emit('chatMessage', { playerName, playerColor, message });
      chatInput.value = '';
    }
  };
  chatSendButton.addEventListener('click', chatSendButtonClickListener);

  socket.on('chatMessage', (data) => {
    const { playerName, playerColor, message } = data;
    const messageDiv = document.createElement('div');
    messageDiv.textContent = `${playerName}: ${message}`;
    messageDiv.style.color = playerColor === 'w' ? 'blue' : 'black';
  });

  socket.on('systemMessage', (data) => {
    const { message } = data;
    const messageDiv = document.createElement('div');
    messageDiv.textContent = `System: ${message}`;
    messageDiv.style.color = 'red';
    messageDiv.style.fontWeight = 'bold';
  });
}
