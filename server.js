import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { checkCaptures, hasNoPieces, countPieces } from './public/captureUtils.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const historyFilePath = join(__dirname, 'gameHistory.json');
const playerNamesFilePath = join(__dirname, 'playerNames.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

function savePlayerNames(roomId, playerNames) {
    let data = {};
    if (fs.existsSync(playerNamesFilePath)) {
        data = JSON.parse(fs.readFileSync(playerNamesFilePath));
    }
    data[roomId] = playerNames;
    fs.writeFileSync(playerNamesFilePath, JSON.stringify(data, null, 2));
}

function loadPlayerNames(roomId) {
    if (fs.existsSync(playerNamesFilePath)) {
        const data = JSON.parse(fs.readFileSync(playerNamesFilePath));
        return data[roomId] || {};
    }
    return {};
}

function saveGameHistory(gameHistory) {
    fs.readFile(historyFilePath, (err, data) => {
        let histories = [];
        if (!err) {
            histories = JSON.parse(data);
        }
        histories.push(gameHistory);
        fs.writeFile(historyFilePath, JSON.stringify(histories, null, 2), err => {
            if (err) console.error('Error saving game history:', err);
        });
    });
}

app.get('/gameHistory', (req, res) => {
    fs.readFile(historyFilePath, (err, data) => {
        if (err) {
            console.error('Error reading game history:', err);
            res.status(500).send('Internal Server Error');
        } else {
            res.json(JSON.parse(data));
        }
    });
});

app.get('/history', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'history.html'));
});

const boardSize = 8;
const gameDuration = 5 * 60;

let rooms = {};
let players = {};

function initializeBoard() {
    const board = Array.from({ length: boardSize }, () => Array(boardSize).fill(null));
    for (let i = 0; i < boardSize; i++) {
        board[0][i] = { type: 'p', color: 'b', x: i, y: 0 };
        board[boardSize - 1][i] = { type: 'p', color: 'w', x: i, y: boardSize - 1 };
    }
    return board;
}

function resetGameRoom(roomId) {
    if (!rooms[roomId]) {
        console.error(`Room ${roomId} does not exist.`);
        return;
    }

    clearInterval(rooms[roomId].timers['w']);
    clearInterval(rooms[roomId].timers['b']);

    rooms[roomId].board = initializeBoard();
    rooms[roomId].moveHistory = [];
    rooms[roomId].capturedPieces = { black: [], white: [] };
    rooms[roomId].currentPlayer = 'w';
    rooms[roomId].remainingTimes = { w: gameDuration, b: gameDuration };
    rooms[roomId].timers = { w: null, b: null };
    rooms[roomId].playerColors = {};
    rooms[roomId].gameActive = false;
    rooms[roomId].gameEnded = false;

    const playerNames = rooms[roomId].players.map(id => ({
        color: rooms[roomId].playerColors[id] || null,
        name: players[id].name || `Guest${id}`
    }));

    io.to(roomId).emit('resetConfirmed', {
        board: rooms[roomId].board,
        moveHistory: rooms[roomId].moveHistory,
        capturedPieces: rooms[roomId].capturedPieces,
        currentPlayer: rooms[roomId].currentPlayer,
        remainingTimes: rooms[roomId].remainingTimes,
        isAI: rooms[roomId].isAI,
        players: playerNames
    });

    io.to(roomId).emit('resetPlayerColors');
    io.to(roomId).emit('resetChat');
}

function startGameTimer(roomId, playerColor) {
    if (!rooms[roomId]) {
        console.error(`Room ${roomId} does not exist.`);
        return;
    }

    if (rooms[roomId].timers[playerColor]) {
        clearInterval(rooms[roomId].timers[playerColor]);
    }

    let remainingTime = rooms[roomId].remainingTimes[playerColor];

    rooms[roomId].timers[playerColor] = setInterval(() => {
        if (!rooms[roomId] || !rooms[roomId].timers) {
            clearInterval(rooms[roomId]?.timers?.[playerColor]);
            return;
        }


        if (!hasValidMoves(rooms[roomId].board, rooms[roomId].currentPlayer)) {
            clearInterval(rooms[roomId].timers[playerColor]);
            endGame(roomId, rooms[roomId].currentPlayer === 'w' ? 'b' : 'w', rooms[roomId].currentPlayer === 'w' ? '0-1' : '1-0');
            return;
        }

        remainingTime--;
        rooms[roomId].remainingTimes[playerColor] = remainingTime;
        io.to(roomId).emit('timerUpdate', { playerColor, remainingTime });

        if (remainingTime <= 0) {
            clearInterval(rooms[roomId].timers[playerColor]);
            declareWinnerByPieces(roomId);
        }
    }, 1000);
}


function resetAIPlayerRoom(roomId) {
    if (!rooms[roomId]) {
        console.error(`Room ${roomId} does not exist.`);
        return;
    }

    clearInterval(rooms[roomId].timers['w']);
    clearInterval(rooms[roomId].timers['b']);

    rooms[roomId].board = initializeBoard();
    rooms[roomId].moveHistory = [];
    rooms[roomId].capturedPieces = { black: [], white: [] };
    rooms[roomId].currentPlayer = 'w';
    rooms[roomId].remainingTimes = { w: gameDuration, b: gameDuration };
    rooms[roomId].timers = { w: null, b: null };
    rooms[roomId].playerColors = {};
    rooms[roomId].gameActive = false;
    rooms[roomId].gameEnded = false;

    io.to(roomId).emit('resetConfirmed', {
        board: rooms[roomId].board,
        moveHistory: rooms[roomId].moveHistory,
        capturedPieces: rooms[roomId].capturedPieces,
        currentPlayer: rooms[roomId].currentPlayer,
        remainingTimes: rooms[roomId].remainingTimes,
        isAI: rooms[roomId].isAI,
        players: [{ color: 'w', name: 'AI' }, { color: 'b', name: 'AI' }]
    });

    io.to(roomId).emit('resetPlayerColors');

}

function deleteRoomAfterTimeout(roomId) {
    setTimeout(() => {
        if (rooms[roomId] && rooms[roomId].players.length === 0 && rooms[roomId].spectators.length === 0) {
            delete rooms[roomId];
            console.log(`Room ${roomId} has been deleted due to inactivity.`);
            updateRoomList();
        }
    }, 60000);
}


function endGame(roomId, winner, result, disconnectedPlayerId = null) {
    if (!rooms[roomId] || rooms[roomId].gameEnded) {
        return;
    }

    rooms[roomId].gameEnded = true;

    const round = Math.ceil(rooms[roomId].moveHistory.length / 2);


    const playerNames = loadPlayerNames(roomId);

    const whitePlayerId = rooms[roomId].players.find(id => rooms[roomId].playerColors[id] === 'w');
    const blackPlayerId = rooms[roomId].players.find(id => rooms[roomId].playerColors[id] === 'b');

    const whitePlayerName = playerNames.white || (whitePlayerId ? players[whitePlayerId]?.name || `Guest${whitePlayerId}` : 'White Player');
    const blackPlayerName = playerNames.black || (blackPlayerId ? players[blackPlayerId]?.name || `Guest${blackPlayerId}` : 'Black Player');

    let winnerName, loserName;
    if (disconnectedPlayerId) {
        loserName = players[disconnectedPlayerId]?.name || `Guest${disconnectedPlayerId}`;
        winnerName = 'draw';
    } else {
        winnerName = winner === 'w' ? whitePlayerName : blackPlayerName;
        loserName = winner === 'w' ? blackPlayerName : whitePlayerName;
    }

    const gameHistory = {
        Event: "เกมหมากหนีบ",
        Site: "MakNeep",
        Date: new Date().toISOString().split('T')[0],
        Round: round.toString(),
        White: whitePlayerName,
        Black: blackPlayerName,
        Result: result,
        Time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        TimeControl: "600 second",
        Moves: rooms[roomId].moveHistory.map((move, index) => `${index + 1}. ${move.move.prevX},${move.move.prevY} - ${move.move.x},${move.move.y}`).join(' '),
        Winner: winnerName,
        Loser: loserName
    };

    saveGameHistory(gameHistory);

    io.to(roomId).emit('gameEnd', { winner, result });
    clearInterval(rooms[roomId].timers['w']);
    clearInterval(rooms[roomId].timers['b']);
    rooms[roomId].gameActive = false;

    if (winner === 'draw') {
        io.to(roomId).emit('chatMessage', { playerName: 'System', message: 'The game is a draw!' });
    } else {
        io.to(roomId).emit('chatMessage', { playerName: 'System', message: `${winnerName} wins the game!` });
    }
}

function updateRoomList() {
    const roomList = Object.keys(rooms).map(roomId => {
        const room = rooms[roomId];
        const playerNames = room.players.map(id => players[id]?.name || `Guest${id}`);
        const isAI = room.isAI ? "AI" : playerNames.length;
        const playerCount = room.isAI ? `1/${isAI}` : `${room.players.length}/2`;

        return {
            roomId,
            playerCount,
            spectators: room.spectators.length,
        };
    });

    io.emit('roomList', roomList);
}


function declareWinnerByPieces(roomId) {
    const whitePieces = countPieces(rooms[roomId].board, 'w');
    const blackPieces = countPieces(rooms[roomId].board, 'b');

    if (whitePieces > blackPieces) {
        endGame(roomId, 'w', '1-0');
    } else if (blackPieces > whitePieces) {
        endGame(roomId, 'b', '0-1');
    } else {
        endGame(roomId, 'draw', '1/2-1/2(draw)');
    }
}

function checkWinConditions(roomId) {
    if (hasNoPieces(rooms[roomId].board, 'w')) {
        endGame(roomId, 'b', '0-1');
    } else if (hasNoPieces(rooms[roomId].board, 'b')) {
        endGame(roomId, 'w', '1-0');
    } else if (!hasValidMoves(rooms[roomId].board, rooms[roomId].currentPlayer)) {
        endGame(roomId, rooms[roomId].currentPlayer === 'w' ? 'b' : 'w', rooms[roomId].currentPlayer === 'w' ? '0-1' : '1-0');
    } else if (isTimeUp(roomId)) {
        declareWinnerByPieces(roomId);
    }
}

function isTimeUp(roomId) {
    return rooms[roomId].remainingTimes.w <= 0 || rooms[roomId].remainingTimes.b <= 0;
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

        while (x >= 0 && x < board[0].length && y >= 0 && y < board.length && !board[y][x]) {
            moves.push({ x, y });
            x += direction.x;
            y += direction.y;
        }
    }

    return moves;
}


function notifySpectatorsAndDeleteRoom(roomId) {
    const room = rooms[roomId];
    if (room) {
        room.spectators.forEach(spectatorId => {
            io.to(spectatorId).emit('redirectToRoomSelection');
        });
        delete rooms[roomId];
        console.log(`Room ${roomId} has been deleted because no players are left.`);
        updateRoomList();
    }
}


function scheduleRoomDeletion(roomId) {
    setTimeout(() => {
        if (rooms[roomId] && rooms[roomId].players.length === 0) {
            notifySpectatorsAndDeleteRoom(roomId);
        }
    }, 3000);
}


function handleDisconnect(socket) {
    const player = players[socket.id];
    if (!player) return;

    const { roomId } = player;
    if (rooms[roomId]) {
        if (!player.isSpectator) {
            rooms[roomId].players = rooms[roomId].players.filter(id => id !== socket.id);
            delete rooms[roomId].playerColors[socket.id];

            if (rooms[roomId].players.length === 1) {
                endGame(roomId, 'draw', '1/2-1/2(disconnected)', socket.id);
                io.to(roomId).emit('chatMessage', { message: ' player disconnected.', playerName: 'System' });
            }
        } else {
            rooms[roomId].spectators = rooms[roomId].spectators.filter(id => id !== socket.id);
        }

        if (rooms[roomId].players.length === 0) {
            scheduleRoomDeletion(roomId);
        }

        io.to(roomId).emit('playerLeft', { name: player.name });

        updateRoomList();
    }
    delete players[socket.id];
}


function performMove(move, roomId, isAIMove = false) {
    if (!rooms[roomId]) {
        console.error(`Room ${roomId} does not exist.`);
        return;
    }

    const { piece, x, y, prevX, prevY } = move;
    const currentBoard = rooms[roomId].board;


    currentBoard[prevY][prevX] = null;
    currentBoard[y][x] = { ...piece, x, y };

    const captures = checkCaptures(currentBoard, { ...piece, x, y });

    captures.forEach(({ x, y }) => {
        if (currentBoard[y][x]) {
            rooms[roomId].capturedPieces[piece.color === 'w' ? 'black' : 'white'].push(currentBoard[y][x]);
            currentBoard[y][x] = null;
        }
    });

    rooms[roomId].moveHistory.push({ move, boardState: JSON.parse(JSON.stringify(currentBoard)) });

    io.to(roomId).emit('board', currentBoard);
    io.to(roomId).emit('moveHistory', rooms[roomId].moveHistory);
    io.to(roomId).emit('highlightMove', { prevX, prevY, x, y });
    io.to(roomId).emit('capturedPieces', rooms[roomId].capturedPieces);

    checkWinConditions(roomId);

    if (isAIMove) {
        const aiColor = piece.color;
        setTimeout(() => {
            rooms[roomId].currentPlayer = aiColor === 'w' ? 'b' : 'w';
            startGameTimer(roomId, rooms[roomId].currentPlayer);
            io.to(roomId).emit('turnSwitch', rooms[roomId].currentPlayer);

            if (aiColor === 'w') {
                clearInterval(rooms[roomId].timers['w']);
                startGameTimer(roomId, 'b');
            } else {
                clearInterval(rooms[roomId].timers['b']);
                startGameTimer(roomId, 'w');
            }
        }, 1000);
    }
}



function startGameIfReady(roomId, socketId) {
    if (Object.keys(rooms[roomId].playerColors).length === 2 && !rooms[roomId].gameActive) {
        rooms[roomId].gameActive = true;
        io.to(roomId).emit('startGame', rooms[roomId]);

        startGameTimer(roomId, rooms[roomId].currentPlayer);

        if (rooms[roomId].isAI && rooms[roomId].currentPlayer !== rooms[roomId].playerColors[socketId]) {
            const aiColor = rooms[roomId].currentPlayer;
            io.to(socketId).emit('requestAIMove', { roomId, aiColor });
        }
    }
}

function initializeRoom(roomId, isAI = false) {
    rooms[roomId] = {
        board: initializeBoard(),
        moveHistory: [],
        capturedPieces: { black: [], white: [] },
        players: [],
        spectators: [],
        currentPlayer: 'w',
        gameActive: false,
        timers: { w: null, b: null },
        remainingTimes: { w: gameDuration, b: gameDuration },
        playerColors: {},
        isAI: isAI
    };
}

function getCurrentColors(roomId) {
    return Object.entries(rooms[roomId].playerColors).map(([playerId, color]) => ({
        playerId,
        color,
        playerName: players[playerId] ? players[playerId].name : 'AI'
    }));
}


io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('setPlayerName', (data) => {
        const player = players[socket.id];
        if (player) {
            player.name = data.playerName;
        } else {
            players[socket.id] = { name: data.playerName, roomId: null, isSpectator: false };
        }
    });

    socket.on('guestLogin', (data) => {
        players[socket.id] = { name: data.name, roomId: null, isSpectator: false };
    });

    socket.on('createRoom', (isAI = false) => {
        const roomId = Math.random().toString(36).substring(2, 8);
        const playerName = players[socket.id]?.name || `Guest${socket.id}`;
        initializeRoom(roomId, isAI);
        rooms[roomId].players.push(socket.id);
        players[socket.id] = { roomId, isSpectator: false, name: playerName };
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        io.to(roomId).emit('board', rooms[roomId].board);
        io.to(roomId).emit('chatMessage', { message: 'Select your color.', playerName: 'System' });
        io.to(roomId).emit('resetPlayerColors');
        updateRoomList();
    });

    socket.on('joinRoom', (data) => {
        const { roomId, playerName } = data;
        if (rooms[roomId]) {
            if (rooms[roomId].deleteTimeout) {
                clearTimeout(rooms[roomId].deleteTimeout);
                delete rooms[roomId].deleteTimeout;
            }

            if (rooms[roomId].players.length < 2 && !rooms[roomId].isAI) {
                rooms[roomId].players.push(socket.id);
                players[socket.id] = { roomId, isSpectator: false, name: playerName || `Guest${socket.id}` };
                socket.join(roomId);
                socket.emit('roomJoined', { roomId, isSpectator: false, currentColors: getCurrentColors(roomId), board: rooms[roomId].board });
                io.to(roomId).emit('board', rooms[roomId].board);
                io.to(roomId).emit('playerJoined', { name: players[socket.id].name });

                Object.entries(rooms[roomId].playerColors).forEach(([playerId, color]) => {
                    socket.emit('playerColorSelected', {
                        playerId,
                        color,
                        playerName: players[playerId].name,
                        remainingTimes: rooms[roomId].remainingTimes
                    });
                });

                if (rooms[roomId].players.length === 2) {
                    io.to(roomId).emit('colorSelection');
                }
            } else {
                players[socket.id] = { roomId, isSpectator: true, name: playerName || `Guest${socket.id}` };
                rooms[roomId].spectators.push(socket.id);
                socket.join(roomId);
                socket.emit('roomJoined', { roomId, isSpectator: true, isAI: rooms[roomId].isAI, currentColors: getCurrentColors(roomId), board: rooms[roomId].board });
                io.to(roomId).emit('board', rooms[roomId].board);
                io.to(roomId).emit('chatMessage', { message: 'A spectator has joined', playerName: 'System' });


                Object.entries(rooms[roomId].playerColors).forEach(([playerId, color]) => {
                    socket.emit('playerColorSelected', {
                        playerId,
                        color,
                        playerName: players[playerId] ? players[playerId].name : 'AI',
                        remainingTimes: rooms[roomId].remainingTimes
                    });
                });


                if (rooms[roomId].isAI) {
                    socket.emit('hideResignButton');
                }
            }
        } else {
            socket.emit('roomNotFound');
        }
    });

    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });

    socket.on('leaveRoom', () => {
        handleDisconnect(socket);
        updateRoomList();
    });

    socket.on('resetGame', () => {
        const player = players[socket.id];
        if (!player || player.isSpectator) return;

        const { roomId } = player;
        resetGameRoom(roomId);
    });

    socket.on('systemMessage', (data) => {
        const player = players[socket.id];
        if (!player) return;

        const { roomId } = player;
        io.to(roomId).emit('systemMessage', data);
    });

    socket.on('selectColor', (data) => {
        const player = players[socket.id];
        if (!player || player.isSpectator) return;

        const { roomId } = player;
        if (rooms[roomId].players.includes(socket.id)) {
            if (!rooms[roomId].playerColors[socket.id]) {
                const selectedColors = Object.values(rooms[roomId].playerColors);
                if (!selectedColors.includes(data.color)) {
                    rooms[roomId].playerColors[socket.id] = data.color;

                    rooms[roomId].remainingTimes = { w: gameDuration, b: gameDuration };
                    clearInterval(rooms[roomId].timers['w']);
                    clearInterval(rooms[roomId].timers['b']);
                    rooms[roomId].timers = { w: null, b: null };

                    const playerName = data.playerName || `Guest${socket.id}`;
                    players[socket.id].name = playerName;

                    const playerNames = loadPlayerNames(roomId);
                    playerNames[data.color === 'w' ? 'white' : 'black'] = playerName;
                    savePlayerNames(roomId, playerNames);

                    io.to(roomId).emit('playerColorSelected', {
                        playerId: socket.id,
                        color: data.color,
                        playerName: playerName,
                        remainingTimes: rooms[roomId].remainingTimes
                    });

                    if (rooms[roomId].isAI) {
                        const aiColor = data.color === 'w' ? 'b' : 'w';
                        rooms[roomId].playerColors['AI'] = aiColor;
                        playerNames[aiColor === 'w' ? 'white' : 'black'] = 'AI';
                        savePlayerNames(roomId, playerNames);

                        io.to(roomId).emit('playerColorSelected', {
                            playerId: 'AI',
                            color: aiColor,
                            playerName: 'AI',
                            remainingTimes: rooms[roomId].remainingTimes
                        });
                        startGameIfReady(roomId, socket.id);
                        if (aiColor === 'w') {

                        }
                    } else {
                        startGameIfReady(roomId, socket.id);
                    }
                }
            }
        }
    });

    socket.on('playWithAI', () => {
        const roomId = Math.random().toString(36).substring(2, 8);
        const playerName = players[socket.id]?.name || `Guest${socket.id}`;
        rooms[roomId] = {
            board: initializeBoard(),
            moveHistory: [],
            capturedPieces: { black: [], white: [] },
            players: [socket.id],
            spectators: [],
            currentPlayer: 'w',
            gameActive: false,
            timers: { w: null, b: null },
            remainingTimes: { w: gameDuration, b: gameDuration },
            playerColors: {},
            isAI: true
        };
        players[socket.id] = { roomId, isSpectator: false, name: playerName };
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        io.to(roomId).emit('board', rooms[roomId].board);
        io.to(roomId).emit('chatMessage', { message: 'Select your color.', playerName: 'System' });
        io.to(roomId).emit('resetPlayerColors');
        socket.emit('hideResignButton');
        updateRoomList();
    });


    socket.on('roomList', (roomList) => {
        updateRoomList();
    });

    socket.on('move', (data) => {
        const player = players[socket.id];
        if (!player || player.isSpectator) return;

        const { roomId } = player;
        if (!rooms[roomId].gameActive) return;
        const { move, captures } = data;

        performMove(move, roomId, false);

        if (hasNoPieces(rooms[roomId].board, 'w')) {
            endGame(roomId, 'b', '0-1');
        } else if (hasNoPieces(rooms[roomId].board, 'b')) {
            endGame(roomId, 'w', '1-0');
        } else if (!hasValidMoves(rooms[roomId].board, rooms[roomId].currentPlayer)) {
            endGame(roomId, rooms[roomId].currentPlayer === 'w' ? 'b' : 'w', rooms[roomId].currentPlayer === 'w' ? '0-1' : '1-0');
        } else {
            const previousPlayer = rooms[roomId].currentPlayer;
            rooms[roomId].currentPlayer = rooms[roomId].currentPlayer === 'w' ? 'b' : 'w';
            startGameTimer(roomId, rooms[roomId].currentPlayer);


            if (previousPlayer === 'w') {
                clearInterval(rooms[roomId].timers['w']);
            } else {
                clearInterval(rooms[roomId].timers['b']);
            }

            if (rooms[roomId].isAI && rooms[roomId].currentPlayer !== rooms[roomId].playerColors[socket.id]) {
                const aiColor = rooms[roomId].currentPlayer;
                io.to(roomId).emit('chatMessage', { playerName: 'System', message: 'AI is thinking.' });
                setTimeout(() => {
                    socket.emit('requestAIMove', { roomId, aiColor });
                }, 1000);
            } else {
                io.to(roomId).emit('turnSwitch', rooms[roomId].currentPlayer);
            }
        }
    });


    socket.on('getPlayerNames', () => {
        const player = players[socket.id];
        if (!player) return;

        const { roomId } = player;
        if (!rooms[roomId]) return;

        const playerNames = {};
        Object.entries(rooms[roomId].playerColors).forEach(([playerId, color]) => {
            playerNames[color] = players[playerId].name || `Guest${playerId}`;
        });

        socket.emit('playerNames', playerNames);
    });

    socket.on('resetPlayerColors', () => {
        const colorButtons = document.querySelectorAll('.color-select');
        socket.emit('getPlayerNames');
        colorButtons.forEach(button => {
            button.disabled = false;
            button.textContent = button.dataset.color === 'w' ? 'Select White' : 'Select Black';
        });
        document.getElementById('colorSelectButtons').style.display = 'block';
        pauseTimer(whiteTimerDisplay);
        pauseTimer(blackTimerDisplay);
    });

    socket.on('turnSwitch', (newCurrentPlayer) => {
        const player = players[socket.id];
        if (!player || player.isSpectator) return;

        const { roomId } = player;
        const otherPlayer = newCurrentPlayer === 'w' ? 'b' : 'w';

        clearInterval(rooms[roomId].timers[otherPlayer]);
        startGameTimer(roomId, newCurrentPlayer);

        rooms[roomId].currentPlayer = newCurrentPlayer;
        io.to(roomId).emit('turnSwitch', newCurrentPlayer);
    });

    socket.on('aiNoMoves', (data) => {
        const player = players[socket.id];
        if (!player) return;

        const { roomId } = player;
        if (rooms[roomId]) {
            endGame(roomId, data.winner, data.winner === 'w' ? '1-0' : '0-1');
            console.log(`AI could not make a move. ${data.winner === 'w' ? 'White' : 'Black'} wins the game!`);
        }
    });

    socket.on('requestReset', () => {
        const player = players[socket.id];
        if (!player || player.isSpectator) return;

        const { roomId } = player;

        if (rooms[roomId].isAI) {
            resetGameRoom(roomId);
        } else {
            const playerName = players[socket.id].name;
            socket.broadcast.to(roomId).emit('resetRequest', { playerId: socket.id, playerName });
        }
    });

    socket.on('confirmReset', () => {
        const player = players[socket.id];
        if (!player || player.isSpectator) return;

        const { roomId } = player;
        if (rooms[roomId].isAI) {
            resetAIPlayerRoom(roomId);
        } else {
            resetGameRoom(roomId);
        }
    });

    socket.on('resign', (data) => {
        const player = players[socket.id];
        if (!player || player.isSpectator) return;

        const { roomId } = player;
        const playerName = data.playerName || `Guest${socket.id}`;

        if (!rooms[roomId].gameEnded) {
            console.log(`Player ${playerName} with color ${data.color} is resigning in room ${roomId}`);
            endGame(roomId, data.color === 'w' ? 'b' : 'w', data.color === 'w' ? '0-1 (surrender)' : '1-0 (surrender)');
            clearInterval(rooms[roomId].timers['w']);
            clearInterval(rooms[roomId].timers['b']);

            io.to(roomId).emit('chatMessage', { message: `${playerName} has surrender. Game over.`, playerName: 'System' });
            io.to(roomId).emit('gameOver', { color: data.color });
        }
    });

    socket.on('chatMessage', (data) => {
        const player = players[socket.id];
        if (!player) return;

        const { roomId } = player;
        player.name = data.playerName;
        io.to(roomId).emit('chatMessage', { playerName: data.playerName, message: data.message });
    });

    socket.on('playerJoined', (data) => {
        const chatDisplay = document.getElementById('chatDisplay');
        const messageDiv = document.createElement('div');
        messageDiv.textContent = `System: ${data.name} joined.`;
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    });

    socket.on('requestRoomList', () => {
        updateRoomList();
    });

    socket.on('aiMove', (data) => {
        const { roomId, move } = data;
        if (rooms[roomId]) {
            performMove(move, roomId, true);
            rooms[roomId].currentPlayer = move.piece.color === 'w' ? 'b' : 'w';
            startGameTimer(roomId, rooms[roomId].currentPlayer);
            io.to(roomId).emit('turnSwitch', rooms[roomId].currentPlayer);
            io.to(roomId).emit('chatMessage', { playerName: 'System', message: 'AI has moved.' });
        }
    });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});