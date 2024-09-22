import { startTimer, resetTimer, pauseTimer, resumeTimer } from './timeUtils.js';
import { setupChat } from './chat.js';
import { checkCaptures, hasNoPieces, countPieces } from './captureUtils.js';
import { setupNavigation, navigateToMultiplayerOptions  } from './navigation.js';
import { getBestMove } from './aiUtils.js';

const socket = io();

const boardSize = 8;
let board = Array.from({ length: boardSize }, () => Array(boardSize).fill(null));
let moveHistory = [];
let selectedPiece = null;
let validMoves = [];
let resetRequested = false;
let playerId = null;
let currentMoveIndex = -1;
let gameEnded = false;
let currentPlayer = 'w';
let playerColor = null;
let capturedPieces = { black: [], white: [] };
let isSpectator = false;
let isAI = false;

const whiteTimerDisplay = document.getElementById('whiteTimer');
const blackTimerDisplay = document.getElementById('blackTimer');
const turnIndicator = document.getElementById('turnIndicator');
const duration = 60 * 5;
const gameStartTime = new Date();
const whitePlayer = localStorage.getItem('whitePlayer') || 'White Player';
const blackPlayer = localStorage.getItem('blackPlayer') || 'Black Player';

localStorage.setItem('startTime', gameStartTime);
localStorage.setItem('whitePlayer', whitePlayer);
localStorage.setItem('blackPlayer', blackPlayer);

whiteTimerDisplay.remainingTime = duration;
blackTimerDisplay.remainingTime = duration;
pauseTimer(whiteTimerDisplay);
pauseTimer(blackTimerDisplay);

setupNavigation(socket);

socket.on('hideResignButton', () => {
    hideResignButton();
});


socket.on('redirectToRoomSelection', () => {
    alert('No players left in the room. Redirecting to room selection.');
    navigateToMultiplayerOptions();
});


document.getElementById('howToPlayButton').addEventListener('click', () => {
    const modal = document.getElementById('howToPlayModal');
    modal.style.display = 'block';
});
  

document.querySelector('.modal .close').addEventListener('click', () => {
    const modal = document.getElementById('howToPlayModal');
    modal.style.display = 'none';
});
  

window.addEventListener('click', (event) => {
    const modal = document.getElementById('howToPlayModal');
    if (event.target === modal) {
      modal.style.display = 'none';
    }
});

window.onGoogleSignIn = (response) => {
    const profile = jwt_decode(response.credential);
    const playerName = profile.name;
    const email = profile.email;
    localStorage.setItem('playerName', playerName);
    localStorage.setItem('playerEmail', email);
    localStorage.setItem('isLoggedIn', true);
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('playOptions').style.display = 'block';
    setupChat(socket, playerName, null);
    socket.emit('setPlayerName', { playerName }); 
};

window.onGoogleLogout = () => {
    const email = localStorage.getItem('playerEmail');
    google.accounts.id.revoke(email, () => {
        console.log('Revoked Google account access');
        localStorage.removeItem('playerName');
        localStorage.removeItem('playerEmail');
        localStorage.removeItem('isLoggedIn');
        document.getElementById('playOptions').style.display = 'none';
        document.getElementById('loginPage').style.display = 'block';
        google.accounts.id.disableAutoSelect();
    });
};

document.getElementById('guestLoginButton').addEventListener('click', () => {
    const guestName = `Guest${Math.floor(Math.random() * 1000)}`;
    localStorage.setItem('playerName', guestName);
    localStorage.setItem('isLoggedIn', true);
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('playOptions').style.display = 'block';
    setupChat(socket, guestName, null);
    
   
    socket.emit('guestLogin', { name: guestName });
});

document.getElementById('googleLogoutButton').addEventListener('click', () => {
    window.onGoogleLogout();
});

function renderBoard(board, isHistoricalView = false) {
    const gameDiv = document.getElementById('game');
    gameDiv.innerHTML = '';

    const startY = playerColor === 'b' ? boardSize - 1 : 0;
    const endY = playerColor === 'b' ? -1 : boardSize;
    const incrementY = playerColor === 'b' ? -1 : 1;

    const startX = playerColor === 'b' ? boardSize - 1 : 0;
    const endX = playerColor === 'b' ? -1 : boardSize;
    const incrementX = playerColor === 'b' ? -1 : 1;

    let lastMove = null;
    if (moveHistory.length > 0) {
        lastMove = moveHistory[moveHistory.length - 1].move;
    }

    for (let y = startY; y !== endY; y += incrementY) {
        for (let x = startX; x !== endX; x += incrementX) {
            const cellDiv = document.createElement('div');
            cellDiv.classList.add('cell');
            cellDiv.dataset.x = x;
            cellDiv.dataset.y = y;

            
            if ((x + y) % 2 === 0) {
                cellDiv.classList.add('light');
            } else {
                cellDiv.classList.add('dark');
            }

            if (lastMove) {
                if (x === lastMove.prevX && y === lastMove.prevY) {
                    cellDiv.classList.add('highlight-previous');
                } else if (x === lastMove.x && y === lastMove.y) {
                    cellDiv.classList.add('highlight-new');
                }
            }

            if (!isHistoricalView && validMoves.some(move => move.x === x && move.y === y)) {
                cellDiv.classList.add('highlight');
            }

            if (board[y][x]) {
                const pieceDiv = document.createElement('div');
                pieceDiv.classList.add('piece');
                pieceDiv.classList.add(board[y][x].color === 'w' ? 'white' : 'black');
                cellDiv.appendChild(pieceDiv);
            }

            cellDiv.addEventListener('click', (event) => {
                if (gameEnded || !playerColor || isHistoricalView || isSpectator || !areBothColorsSelected()) return;
                const x = parseInt(event.currentTarget.dataset.x);
                const y = parseInt(event.currentTarget.dataset.y);
                handleCellClick(x, y);
            });

            gameDiv.appendChild(cellDiv);
        }
    }

    addCoordinates();

    if (!isHistoricalView) {
        renderMoveHistory();
        renderCapturedPieces();
        updateTurnIndicator();
    }
}


document.getElementById('historyButton').addEventListener('click', () => {
    window.location.href = 'history.html';
});

function addCoordinates() {
    const topCoordinates = document.querySelector('.coordinate-top');
    const bottomCoordinates = document.querySelector('.coordinate-bottom');
    const leftCoordinates = document.querySelector('.coordinate-left');
    const rightCoordinates = document.querySelector('.coordinate-right');

    topCoordinates.innerHTML = '';
    bottomCoordinates.innerHTML = '';
    leftCoordinates.innerHTML = '';
    rightCoordinates.innerHTML = '';

    const letters = 'abcdefgh';
    for (let i = 0; i < boardSize; i++) {
        const topDiv = document.createElement('div');
        const bottomDiv = document.createElement('div');
        const leftDiv = document.createElement('div');
        const rightDiv = document.createElement('div');

        topDiv.classList.add('coordinate');
        bottomDiv.classList.add('coordinate');
        leftDiv.classList.add('coordinate');
        rightDiv.classList.add('coordinate');

        topDiv.textContent = playerColor === 'b' ? letters[boardSize - 1 - i] : letters[i];
        bottomDiv.textContent = playerColor === 'b' ? letters[boardSize - 1 - i] : letters[i];
        leftDiv.textContent = playerColor === 'b' ? i + 1 : boardSize - i;
        rightDiv.textContent = playerColor === 'b' ? i + 1 : boardSize - i;

        topCoordinates.appendChild(topDiv);
        bottomCoordinates.appendChild(bottomDiv);
        leftCoordinates.appendChild(leftDiv);
        rightCoordinates.appendChild(rightDiv);
    }
}

function renderCapturedPieces() {
    const whiteCapturedDiv = document.getElementById('capturedWhitePieces');
    const blackCapturedDiv = document.getElementById('capturedBlackPieces');

    whiteCapturedDiv.innerHTML = 'WHITE PLAYER: ';
    capturedPieces.white.forEach(piece => {
        const pieceDiv = document.createElement('div');
        pieceDiv.classList.add('piece', 'white');
        whiteCapturedDiv.appendChild(pieceDiv);
    });

    blackCapturedDiv.innerHTML = 'BLACK PLAYER: ';
    capturedPieces.black.forEach(piece => {
        const pieceDiv = document.createElement('div');
        pieceDiv.classList.add('piece', 'black');
        blackCapturedDiv.appendChild(pieceDiv);
    });
}

function renderMoveHistory() {
    const historyDiv = document.getElementById('moveHistory');
    historyDiv.innerHTML = '<h3>Move History</h3>';

    moveHistory.forEach((entry, index) => {
        const move = entry.move;
        const isWhiteMove = index % 2 === 0;

        const moveDescription = ` ${formatPosition(move.prevX, move.prevY)} - ${formatPosition(move.x, move.y)}`;

        if (isWhiteMove) {
            const rowDiv = document.createElement('div');
            rowDiv.classList.add('move-row');
            rowDiv.textContent = `${Math.floor(index / 2) + 1}. `;

            const whiteMoveSpan = document.createElement('span');
            whiteMoveSpan.classList.add('move');
            whiteMoveSpan.textContent = moveDescription;
            whiteMoveSpan.addEventListener('click', () => {
                goToMove(index);
            });

            if (index === currentMoveIndex) {
                whiteMoveSpan.classList.add('highlighted');
            }

            rowDiv.appendChild(whiteMoveSpan);
            historyDiv.appendChild(rowDiv);
        } else {
            const rowDiv = historyDiv.lastChild;
            const blackMoveSpan = document.createElement('span');
            blackMoveSpan.classList.add('move');
            blackMoveSpan.textContent = moveDescription;
            blackMoveSpan.addEventListener('click', () => {
                goToMove(index);
            });

            if (index === currentMoveIndex) {
                blackMoveSpan.classList.add('highlighted');
            }

            rowDiv.appendChild(blackMoveSpan);
        }
    });

    historyDiv.style.overflowY = 'auto';
}

function formatPosition(x, y) {
    const letters = 'abcdefgh';
    return `${letters[x]}${8 - y}`;
}

function resetLocalGameState() {
    board = Array.from({ length: boardSize }, () => Array(boardSize).fill(null));
    moveHistory = [];
    capturedPieces = { black: [], white: [] };
    currentPlayer = 'w';
    gameEnded = false;
    playerColor = null;
    isAI = false;

    socket.emit('getPlayerNames');

    const colorButtons = document.querySelectorAll('.color-select');
    colorButtons.forEach(button => {
        button.disabled = false;
        button.textContent = button.dataset.color === 'w' ? 'Select White' : 'Select Black';
    });
    document.getElementById('colorSelectButtons').style.display = 'block';

    pauseTimer(whiteTimerDisplay);
    pauseTimer(blackTimerDisplay);

    renderBoard(board);

    enableControls(); 
    enableResignButton(); 
}

function enableControls() {
    const resignButton = document.getElementById('resignButton');
    const prevMoveButton = document.getElementById('prevMoveButton');
    const nextMoveButton = document.getElementById('nextMoveButton');
    
    resignButton.disabled = false;
    prevMoveButton.disabled = false;
    nextMoveButton.disabled = false;
}

function enableResignButton() {
    const resignButton = document.getElementById('resignButton');
    if (playerColor) {
        resignButton.disabled = false;
    } else {
        resignButton.disabled = true;
    }
}

function disableResignButton() {
    const resignButton = document.getElementById('resignButton');
    resignButton.disabled = true;
}

document.getElementById('resignButton').addEventListener('click', () => {
    if (!isAI && areBothColorsSelected()) {
        const playerName = localStorage.getItem('playerName') || `Guest${socket.id}`;
        const result = playerColor === 'w' ? '0-1' : '1-0'; 
        console.log(`Player ${playerName} with color ${playerColor} is resigning`);
        socket.emit('resign', { color: playerColor, playerName, result });
        pauseTimer(whiteTimerDisplay);
        pauseTimer(blackTimerDisplay);
    } else {
        console.log('Resign is not available when playing with AI or before color selection.');
        socket.emit('systemMessage', { message: 'Resign is not available when playing with AI or before color selection.' });
    }
});

function getValidMoves(board, piece) {
    const directions = [
        { x: 0, y: 1 },
        { x: 0, y: -1 },
        { x: 1, y: 0 },
        { x: -1, y: 0 }
    ];

    const moves = [];

    for (let direction of directions) {
        let x = piece.x + direction.x;
        let y = piece.y + direction.y;

        while (x >= 0 && x < boardSize && y >= 0 && y < boardSize && !board[y][x]) {
            moves.push({ x, y });
            x += direction.x;
            y += direction.y;
        }
    }

    return moves;
}

function handleCellClick(x, y) {
    if (gameEnded || !playerColor || isSpectator || !areBothColorsSelected()) return;
    const piece = board[y][x];
    if (selectedPiece && validMoves.some(move => move.x === x && move.y === y)) {
        const move = {
            piece: { ...selectedPiece, x, y },
            x: x,
            y: y,
            prevX: selectedPiece.x,
            prevY: selectedPiece.y
        };
        performMove(move);
        selectedPiece = null;
        validMoves = [];
        switchPlayer();
        checkWinConditions();
    } else if (piece && piece.color === currentPlayer && piece.color === playerColor) {
        selectedPiece = piece;
        validMoves = getValidMoves(board, selectedPiece);
    } else {
        socket.emit('systemMessage', { message: "You can only move your own pieces!" });
    }

    renderBoard(board);
}

function areBothColorsSelected() {
    const colorButtons = document.querySelectorAll('.color-select');
    let selectedColors = 0;
    colorButtons.forEach(button => {
        if (button.disabled) selectedColors++;
    });
    console.log(`Selected colors: ${selectedColors}`);
    return selectedColors === 2;
}

function performMove(move) {
    const { piece, x, y, prevX, prevY } = move;
    const captures = checkCaptures(board, piece);
    board[prevY][prevX] = null;
    board[y][x] = piece;

    
    captures.forEach(({ x, y, color }) => {
        const capturedPiece = board[y][x];
        if (capturedPiece) {
            capturedPieces[color === 'w' ? 'black' : 'white'].push(capturedPiece);
            board[y][x] = null;
        }
    });

    moveHistory.push({ move, boardState: JSON.parse(JSON.stringify(board)) });
    currentMoveIndex = moveHistory.length - 1; 
    socket.emit('move', { move, captures });

    renderBoard(board, true); 
    renderMoveHistory(); 
    renderCapturedPieces(); 
}

function updateRoomList(roomList) {
    const roomListDiv = document.getElementById('roomList');
    roomListDiv.innerHTML = '';

    roomList.forEach(room => {
        const roomDiv = document.createElement('div');
        roomDiv.className = 'room';
        roomDiv.textContent = `Room ${room.roomId}: ${room.playerCount} players`;
        
        const joinButton = document.createElement('button');
        joinButton.textContent = 'Join Room';
        joinButton.onclick = () => {
            const playerName = localStorage.getItem('playerName');
            socket.emit('joinRoom', { roomId: room.roomId, playerName });
        };
        
        roomDiv.appendChild(joinButton);
        roomListDiv.appendChild(roomDiv);
    });
}


socket.emit('requestRoomList');

function updateRoomName(roomId) {
    const roomNameDiv = document.getElementById('roomName');
    roomNameDiv.textContent = `Room ${roomId}`;
}

function checkWinConditions() {
    if (hasNoPieces(board, 'w')) {
        endGame('b');
    } else if (hasNoPieces(board, 'b')) {
        endGame('w');
    } else if (!hasValidMoves(board, currentPlayer)) {
        endGame(currentPlayer === 'w' ? 'b' : 'w');
    } else if (isTimeUp()) {
        declareWinnerByPieces();
    }
}

function declareWinnerByPieces() {
    const whitePieces = countPieces(board, 'w');
    const blackPieces = countPieces(board, 'b');

    if (whitePieces > blackPieces) {
        endGame('w');
    } else if (blackPieces > whitePieces) {
        endGame('b');
    } else {
        endGame('draw');
    }
}

function hasValidMoves(board, color) {
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
            if (board[y][x] && board[y][x].color === color) {
                if (getValidMoves(board, board[y][x]).length > 0) {
                    return true;
                }
            }
        }
    }
    return false;
}

function isTimeUp() {
    return whiteTimerDisplay.remainingTime <= 0 || blackTimerDisplay.remainingTime <= 0;
}

function endGame(winner) {
    gameEnded = true;
    let result;
    if (winner === 'draw') {
        result = '1/2-1/2'; 
        socket.emit('chatMessage', { playerName: 'System', message: 'The game is a draw!' });
    } else {
        result = winner === 'w' ? '1-0' : '0-1'; 
    }
    socket.emit('gameEnd', { winner, result });
    pauseTimer(whiteTimerDisplay);
    pauseTimer(blackTimerDisplay);
    disableBoard();
}

function switchPlayer() {
    currentPlayer = currentPlayer === 'w' ? 'b' : 'w';
    updateTurnIndicator();

    if (currentPlayer === 'w') {
        pauseTimer(blackTimerDisplay);
    } else {
        pauseTimer(whiteTimerDisplay);
    }

    if (!hasValidMoves(board, currentPlayer)) {
        
        endGame(currentPlayer === 'w' ? 'b' : 'w');
        pauseTimer(whiteTimerDisplay); 
        pauseTimer(blackTimerDisplay); 
        return; 
    }

    if (currentPlayer === 'w') {
        resumeTimer(whiteTimerDisplay);
    } else {
        resumeTimer(blackTimerDisplay);
    }

    if (whiteTimerDisplay.remainingTime <= 0) {
        endGame('b');
    } else if (blackTimerDisplay.remainingTime <= 0) {
        endGame('w');
    }

    checkWinConditions();
}


function makeAIMove() {
    if (gameEnded || currentPlayer === playerColor) return; 

    console.log("AI making move for color", currentPlayer); 
    if (currentPlayer === 'w') {
        pauseTimer(blackTimerDisplay); 
    } else {
        pauseTimer(whiteTimerDisplay); 
    }

    const aiMove = getBestMove(board, currentPlayer);
    if (aiMove) {
        const move = {
            piece: { ...aiMove.piece, x: aiMove.x, y: aiMove.y },
            x: aiMove.x,
            y: aiMove.y,
            prevX: aiMove.piece.x,
            prevY: aiMove.piece.y
        };
        socket.emit('aiMove', { roomId: currentRoomId, move });
    } else {
        console.log("AI has no valid moves, ending game.");
        socket.emit('aiNoMoves', { winner: currentPlayer === 'w' ? 'b' : 'w' });
    }

    if (currentPlayer === 'w') {
        pauseTimer(whiteTimerDisplay);
        resumeTimer(blackTimerDisplay);
    } else {
        pauseTimer(blackTimerDisplay);
        resumeTimer(whiteTimerDisplay);
    }
}



socket.on('playerColorSelected', (data) => {
    const colorButton = document.querySelector(`.color-select[data-color="${data.color}"]`);
    colorButton.textContent = data.playerName; 
    colorButton.disabled = true; 

    if (data.playerId === socket.id) {
        playerColor = data.color;
        renderBoard(board);
        localStorage.setItem(data.color === 'w' ? 'whitePlayer' : 'blackPlayer', data.playerName);
        if (isAI) {
            const aiColor = playerColor === 'w' ? 'b' : 'w';
            socket.emit('selectColor', { color: aiColor, playerName: 'AI' });
            localStorage.setItem(aiColor === 'w' ? 'whitePlayer' : 'blackPlayer', 'AI');
            if (aiColor === 'w') {
                setTimeout(() => {
                    makeAIMove();
                }, 1000);
            }
        }
    } else {
        renderBoard(board);
    }

    if (areBothColorsSelected() || isAI) {
        enableBoard();
        if (!isAI) {
            startTimers();
        } else {
            if (currentPlayer === 'w' && playerColor !== 'w') {
                resumeTimer(whiteTimerDisplay);
            } else if (currentPlayer === 'b' && playerColor !== 'b') {
                resumeTimer(blackTimerDisplay);
            }
        }
    }

    whiteTimerDisplay.remainingTime = data.remainingTimes.w;
    blackTimerDisplay.remainingTime = data.remainingTimes.b;
    updateTimerDisplay(whiteTimerDisplay, whiteTimerDisplay.remainingTime);
    updateTimerDisplay(blackTimerDisplay, blackTimerDisplay.remainingTime);
    pauseTimer(whiteTimerDisplay);
    pauseTimer(blackTimerDisplay);

    enableResignButton();

    const colorButtons = document.querySelectorAll('.color-select');
    colorButtons.forEach(button => {
        if (data.color === button.dataset.color) {
            button.textContent = data.playerName;
            button.disabled = true;
        }
    });
});

function changeColorScheme(scheme) {
    let lightColor, darkColor, buttonColor;
    switch (scheme) {
        case 'color1':
            lightColor = '#f0d9b5';
            darkColor = '#b58863';
            buttonColor = '#ff5733';
            break;
        case 'color2':
            lightColor = '#a8d5e2';
            darkColor = '#6b9d8e';
            buttonColor = '#1f7a8c';
            break;
        case 'color3':
            lightColor = '#f4c2c2';
            darkColor = '#ba7979';
            buttonColor = '#a10035';
            break;
        default:
            lightColor = '#fefcf8';
            darkColor = '#bebab7';
            buttonColor = '#007bff';
            break;
    }

    document.documentElement.style.setProperty('--light-color', lightColor);
    document.documentElement.style.setProperty('--dark-color', darkColor);
    document.documentElement.style.setProperty('--button-color', buttonColor);

    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.style.backgroundColor = buttonColor;
    });

    renderBoard(board);
}


function updateBoardAfterMove(captures) {
    captures.forEach(({ x, y, color }) => {
        const capturedPiece = board[y][x];
        if (capturedPiece) {
            capturedPieces[color === 'w' ? 'black' : 'white'].push(capturedPiece);
            board[y][x] = null;
        }
    });
    renderBoard(board);
    checkWinConditions();
}

function resetGame() {
    if (!resetRequested) {
        resetRequested = true;
        socket.emit('requestReset');
    }
}

function showAcceptResetButton() {
    const acceptButton = document.getElementById('acceptResetButton');
    acceptButton.style.display = 'block';
    acceptButton.addEventListener('click', () => {
        socket.emit('confirmReset');
        acceptButton.style.display = 'none';
        socket.emit('chatMessage', { playerName: 'System', message: 'Room is Reset' });
        socket.emit('chatMessage', { playerName: 'System', message: 'Rejoined the game.' });
    });
}

function goToMove(index) {
    const tempBoard = JSON.parse(JSON.stringify(moveHistory[index].boardState));
    renderBoard(tempBoard, true);
    currentMoveIndex = index; 
    renderMoveHistory();
}

function previousMove() {
    if (currentMoveIndex > 0) {
        currentMoveIndex--;
        goToMove(currentMoveIndex);
    }
}

function nextMove() {
    if (currentMoveIndex < moveHistory.length - 1) {
        currentMoveIndex++;
        goToMove(currentMoveIndex);
    } else if (currentMoveIndex === moveHistory.length - 1) {
        renderBoard(board);
        currentMoveIndex++;
    }
}
function resign() {
    if (!isAI) {
        const playerName = localStorage.getItem('playerName') || `Guest${socket.id}`;
        const result = playerColor === 'w' ? '0-1-0-0' : '1-0-0-0';
        socket.emit('resign', { color: playerColor, playerName, result });
        pauseTimer(whiteTimerDisplay);
        pauseTimer(blackTimerDisplay);
    } else {
        socket.emit('systemMessage', { message: 'Resign is not available when playing with AI.' });
    }
}

function highlightMove(prevX, prevY, x, y) {
    document.querySelectorAll('.highlight-previous, .highlight-new').forEach(cell => {
        cell.classList.remove('highlight-previous', 'highlight-new');
    });

    const prevCell = document.querySelector(`[data-x="${prevX}"][data-y="${prevY}"]`);
    const newCell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    if (prevCell) prevCell.classList.add('highlight-previous');
    if (newCell) newCell.classList.add('highlight-new');
}

function updateTurnIndicator() {
    if (currentPlayer === 'w') {
        turnIndicator.textContent = "White Turn";
    } else {
        turnIndicator.textContent = "Black Turn";
    }
}

socket.on('moveHistory', (newMoveHistory) => {
    moveHistory = newMoveHistory;
    renderMoveHistory();
});

socket.on('resetRequest', (data) => {
    if (data.playerId !== playerId) {
        showAcceptResetButton();
    }
    const playerName = localStorage.getItem('playerName');
    socket.emit('chatMessage', { message: `Player requested to reset the game`, playerName: 'System' });
});

socket.on('roomCreated', (roomId) => {
    isAI = false; 
    renderBoard(board); 
    updateRoomName(roomId); 
    showResignButton();
    
    moveHistory = [];
    capturedPieces = { black: [], white: [] };
    resetChat();
    resetTimers();
    resetColorSelectionButtons();
});

socket.on('roomJoined', (data) => {
    if (data.isSpectator) {
        updateControlsForSpectators();
    } else {
        enableResignButton();
    }

    data.currentColors.forEach(({ color, playerName }) => {
        const colorButton = document.querySelector(`.color-select[data-color="${color}"]`);
        if (colorButton) {
            colorButton.textContent = playerName;
            colorButton.disabled = true;
        }
    });

    renderBoard(data.board);
});

function resetChat() {
    const chatDisplay = document.getElementById('chatDisplay');
    chatDisplay.innerHTML = '';
}

function resetTimers() {
    const duration = 60 * 5; 
    whiteTimerDisplay.remainingTime = duration;
    blackTimerDisplay.remainingTime = duration;
    pauseTimer(whiteTimerDisplay);
    pauseTimer(blackTimerDisplay);
    updateTimerDisplay(whiteTimerDisplay, duration);
    updateTimerDisplay(blackTimerDisplay, duration);
}

socket.on('resetChat', () => {
    resetChat();
});

socket.on('roomList', (roomList) => {
    updateRoomList(roomList);
});


socket.on('playWithAI', (roomId) => {
    isAI = true; 
    renderBoard(board); 
    updateRoomName(roomId);
    hideResignButton(); 
});

socket.on('resetConfirmed', (data) => {
    resetLocalGameState();
    board = data.board;
    moveHistory = data.moveHistory;
    capturedPieces = data.capturedPieces;
    currentPlayer = data.currentPlayer;
    whiteTimerDisplay.remainingTime = data.remainingTimes.w;
    blackTimerDisplay.remainingTime = data.remainingTimes.b;
    updateTimerDisplay(whiteTimerDisplay, whiteTimerDisplay.remainingTime);
    updateTimerDisplay(blackTimerDisplay, blackTimerDisplay.remainingTime);
    pauseTimer(blackTimerDisplay);
    pauseTimer(whiteTimerDisplay);
    isAI = data.isAI;

    if (isAI) {
        document.getElementById('colorSelectButtons').style.display = 'block';
    }

    renderBoard(board);
    gameEnded = false;
    resetRequested = false; 

    data.players.forEach(player => {
        const colorButton = document.querySelector(`.color-select[data-color="${player.color}"]`);
        if (colorButton) {
            colorButton.textContent = player.name;
            colorButton.disabled = true;
        }
    });

    const playerName = localStorage.getItem('playerName') || 'Guest';
    
    enableControls(); 
    enableResignButton(); 
});

socket.on('gameOver', (data) => {
    gameEnded = true;
    pauseTimer(whiteTimerDisplay);
    pauseTimer(blackTimerDisplay);
    disableBoard();
    if (data.result) {
        localStorage.setItem('gameResult', data.result);
    }
});

socket.on('chatMessage', (data) => {
    const { playerName, message } = data;
    const chatDisplay = document.getElementById('chatDisplay');
    const messageDiv = document.createElement('div');
    messageDiv.textContent = `${playerName}: ${message}`;
    chatDisplay.scrollTop = chatDisplay.scrollHeight; 
});

socket.on('turnSwitch', (newCurrentPlayer) => {
    currentPlayer = newCurrentPlayer;
    updateTurnIndicator();
    enableResignButton(); 

    if (currentPlayer === 'w') {
        resumeTimer(whiteTimerDisplay);
        pauseTimer(blackTimerDisplay);
    } else {
        resumeTimer(blackTimerDisplay);
        pauseTimer(whiteTimerDisplay);
    }

    if (isAI && currentPlayer !== playerColor) {
        setTimeout(() => {
            makeAIMove();
        }, 1000); 
    }
});


socket.on('gameEnd', (data) => {
    gameEnded = true;
    pauseTimer(whiteTimerDisplay);
    pauseTimer(blackTimerDisplay);
    disableBoard();
    
    const whitePlayerName = localStorage.getItem('whitePlayer') || 'White Player';
    const blackPlayerName = localStorage.getItem('blackPlayer') || 'Black Player';
    const message = data.winner === 'draw'
        ? 'The game is a draw!'
        : `${data.winner === 'w' ? whitePlayerName : blackPlayerName} wins the game!`;

    socket.emit('systemMessage', { message });
});

socket.on('highlightMove', (data) => {
    const { prevX, prevY, x, y } = data;
    highlightMove(prevX, prevY, x, y);
});

socket.on('capturedPieces', (newCapturedPieces) => {
    capturedPieces = newCapturedPieces;
    renderCapturedPieces();
});

socket.on('timerUpdate', (data) => {
    const { playerColor, remainingTime } = data;
    const timerDisplay = playerColor === 'w' ? whiteTimerDisplay : blackTimerDisplay;
    updateTimerDisplay(timerDisplay, remainingTime);
});

socket.on('playerNames', (data) => {
    const colorButtons = document.querySelectorAll('.color-select');
    colorButtons.forEach(button => {
        const color = button.dataset.color;
        if (data[color]) {
            button.textContent = data[color];
            button.disabled = true;
        } else {
            button.textContent = color === 'w' ? 'Select White' : 'Select Black';
            button.disabled = false;
        }
    });
});

function disableBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.removeEventListener('click', handleCellClick);
        cell.classList.remove('highlight');
    });
}

socket.on('connect', () => {
    playerId = socket.id;
    const playerName = localStorage.getItem('playerName');
    if (playerName) {
        socket.emit('setPlayerName', { playerName });
        setupChat(socket, playerName, playerColor);
    }

    socket.on('joinRoom', (roomId) => {
        const playerName = localStorage.getItem('playerName');
        socket.emit('joinRoom', { roomId, playerName });
    });
    
    socket.on('disconnect', () => {
        localStorage.removeItem('playerName');
    });

});

document.getElementById('resetButton').addEventListener('click', () => {
    if (isAI) {
        socket.emit('confirmReset');
    } else {
        resetGame();
    }
});

document.getElementById('prevMoveButton').disabled = false;
document.getElementById('nextMoveButton').disabled = false;

document.getElementById('prevMoveButton').addEventListener('click', previousMove);
document.getElementById('nextMoveButton').addEventListener('click', nextMove);
document.getElementById('pgnButton').addEventListener('click', () => {
    const pgnData = {
        moveHistory,
        moves: generatePGN(moveHistory)
    };
    localStorage.setItem('pgnData', JSON.stringify(pgnData));
    window.open('pgn.html', '_blank');
});

document.getElementById('colorSchemeButtons').addEventListener('click', (event) => {
    if (event.target.classList.contains('color-scheme')) {
        const scheme = event.target.dataset.scheme;
        changeColorScheme(scheme);
    }
});

document.getElementById('pgnButton').addEventListener('click', () => {
    const pgnData = {
        moveHistory,
        moves: generatePGN(moveHistory),
        startTime: gameStartTime,
        whitePlayer,
        blackPlayer
    };
    localStorage.setItem('pgnData', JSON.stringify(pgnData));
    window.open('pgn.html', '_blank');
});

socket.on('board', (newBoard) => {
    board = newBoard;
    renderBoard(board);
});

socket.on('roomFull', () => {
    socket.emit('systemMessage', { message: 'Room is full. Please join another room or create a new one.' });
});

socket.on('chatMessage', (data) => {
    const { playerName, message } = data;
    const chatDisplay = document.getElementById('chatDisplay');
    const messageDiv = document.createElement('div');
    messageDiv.textContent = `${playerName}: ${message}`;
    chatDisplay.appendChild(messageDiv);
    chatDisplay.scrollTop = chatDisplay.scrollHeight; 
});

socket.on('playerLeft', (data) => {
    const colorButton = document.querySelector(`.color-select[data-color="${data.color}"]`);
    colorButton.disabled = false;
    colorButton.textContent = data.color === 'w' ? 'Select White' : 'Select Black';

    const chatDisplay = document.getElementById('chatDisplay');
    const messageDiv = document.createElement('div');
    messageDiv.textContent = `System: ${data.name} has left the room.`;
    chatDisplay.appendChild(messageDiv);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
});

socket.on('playerJoined', (data) => {
    const chatDisplay = document.getElementById('chatDisplay');
    const messageDiv = document.createElement('div');
    messageDiv.textContent = `System: ${data.name} joined.`;
    chatDisplay.appendChild(messageDiv);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
    enableControls(); 
});

document.querySelectorAll('.color-select').forEach(button => {
    button.addEventListener('click', (event) => {
        const color = event.target.dataset.color;
        const playerName = localStorage.getItem('playerName');
        localStorage.setItem(color === 'w' ? 'whitePlayer' : 'blackPlayer', playerName);

        if (isAI) {
            const aiName = 'AI';
            localStorage.setItem(color === 'w' ? 'blackPlayer' : 'whitePlayer', aiName); 
        }

        socket.emit('selectColor', { color, playerName });
    });
});

document.getElementById('chatSendButton').addEventListener('click', () => {
    const messageInput = document.getElementById('chatInput');
    const message = messageInput.value.trim();
    if (message) {
        const playerName = localStorage.getItem('playerName');
        socket.emit('chatMessage', { playerName, message });
        messageInput.value = '';
    }
});

document.getElementById('playWithAIButton').addEventListener('click', () => {
    resetColorSelectionButtons();
    resetGameBoard();
    hideResignButton();
    isSpectator = false; 
});

function hideResignButton() {
    const resignButton = document.getElementById('resignButton');
    resignButton.style.display = 'none';
}

function showResignButton() {
    const resignButton = document.getElementById('resignButton');
    resignButton.style.display = 'inline-block';
}

function resetGameBoard() {
    board = Array.from({ length: boardSize }, () => Array(boardSize).fill(null));
    moveHistory = [];
    capturedPieces = { black: [], white: [] };
    currentMoveIndex = -1;
    gameEnded = false;
    currentPlayer = 'w';
    renderBoard(board);
    renderMoveHistory();
    renderCapturedPieces();
    isSpectator = false; 
}

function generatePGN(moveHistory) {
    return moveHistory.map((entry, index) => {
        const move = entry.move;
        const isWhiteMove = index % 2 === 0;
        return `${isWhiteMove ? Math.floor(index / 2) + 1 + '. ' : ''}${formatPosition(move.x, move.y)}`;
    });
}

function resetColorSelectionButtons() {
    const colorButtons = document.querySelectorAll('.color-select');
    colorButtons.forEach(button => {
        button.disabled = false;
        button.textContent = button.dataset.color === 'w' ? 'Select White' : 'Select Black';
    });
    document.getElementById('colorSelectButtons').style.display = 'block';
}

socket.on('resetPlayerColors', () => {
    const colorButtons = document.querySelectorAll('.color-select');
    colorButtons.forEach(button => {
        button.disabled = false;
        button.textContent = button.dataset.color === 'w' ? 'Select White' : 'Select Black';
    });
    document.getElementById('colorSelectButtons').style.display = 'block';
    resetColorSelectionButtons();
    pauseTimer(whiteTimerDisplay);
    pauseTimer(blackTimerDisplay);
});

function updateTimerDisplay(display, remainingTime) {
    const minutes = String(Math.floor(remainingTime / 60)).padStart(2, '0');
    const seconds = String(remainingTime % 60).padStart(2, '0');
    const label = display.id === 'whiteTimer' ? 'White Time: ' : 'Black Time: ';
    display.textContent = `${label}${minutes}:${seconds}`;
}

function updateControlsForSpectators() {
    const controls = document.querySelectorAll('.game-control');
    controls.forEach(control => {
        control.disabled = true;
    });

    document.getElementById('prevMoveButton').disabled = false;
    document.getElementById('nextMoveButton').disabled = false;
    document.getElementById('chatSendButton').disabled = false;
    document.getElementById('backButton').disabled = false;
}

function enableBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });
}

function startTimers() {
    if (currentPlayer === 'w') {
        resumeTimer(whiteTimerDisplay);
    } else {
        resumeTimer(blackTimerDisplay);
    }
}

window.onload = () => {
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('playOptions').style.display = 'none';

    
    google.accounts.id.initialize({
        client_id: 'google id',
        callback: onGoogleSignIn
    });

    google.accounts.id.renderButton(
        document.getElementById('googleSignInButton'),
        { theme: 'outline', size: 'large' }
    );

    google.accounts.id.prompt(); 
};

socket.on('requestAIMove', ({ roomId, aiColor }) => {
    const aiMove = getBestMove(board, aiColor);
    if (aiMove) {
        const move = {
            piece: { ...aiMove.piece, x: aiMove.x, y: aiMove.y },
            x: aiMove.x,
            y: aiMove.y,
            prevX: aiMove.piece.x,
            prevY: aiMove.piece.y
        };
        socket.emit('aiMove', { roomId, move });
    }
});

window.onbeforeunload = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('playerName');
    localStorage.removeItem('playerEmail');
};