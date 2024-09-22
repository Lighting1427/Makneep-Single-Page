const pgnBoardDiv = document.getElementById('pgnBoard');
const pgnText = document.getElementById('pgnText');
let pgnData = JSON.parse(localStorage.getItem('selectedGame'));
let moveHistory = [];
let pgnIndex = -1;

if (pgnData) {
    moveHistory = parseMoves(pgnData.Moves);
    displayMoves();
    updatePgnBoard();
}

document.getElementById('prevMoveButton').addEventListener('click', () => {
    if (pgnIndex > 0) {
        pgnIndex--;
        updatePgnBoard();
    }
});

document.getElementById('nextMoveButton').addEventListener('click', () => {
    if (pgnIndex < moveHistory.length - 1) {
        pgnIndex++;
        updatePgnBoard();
    }
});

document.getElementById('exportPgnButton').addEventListener('click', () => {
    const pgnString = generatePgnString();
    const blob = new Blob([pgnString], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'game.txt';
    link.click();
});

function displayMoves() {
    const movesContainer = document.createElement('div');
    moveHistory.forEach((move, index) => {
        const moveSpan = document.createElement('span');
        moveSpan.classList.add('move');
        moveSpan.textContent = `${index + 1}. ${formatPosition(move.prevX, move.prevY)} - ${formatPosition(move.x, move.y)} `;
        moveSpan.addEventListener('click', () => {
            pgnIndex = index;
            updatePgnBoard();
        });
        movesContainer.appendChild(moveSpan);
    });
    pgnText.innerHTML = '';
    pgnText.appendChild(movesContainer);
}

function parseMoves(movesString) {
    const moves = movesString.trim().split(/\d+\.\s*/).filter(Boolean);
    return moves.map(move => {
        const [prev, next] = move.trim().split(' - ').map(pos => pos.split(',').map(Number));
        return {
            prevX: prev[0],
            prevY: prev[1],
            x: next[0],
            y: next[1]
        };
    });
}

function updatePgnBoard() {
    const currentBoardState = generateBoardState(pgnIndex);
    renderBoard(currentBoardState);
    highlightCurrentMove();
}

function generateBoardState(upToIndex) {
    const boardSize = 8;
    const board = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    for (let i = 0; i < boardSize; i++) {
        board[0][i] = { type: 'p', color: 'b', x: i, y: 0 };
        board[boardSize - 1][i] = { type: 'p', color: 'w', x: i, y: boardSize - 1 };
    }
    for (let i = 0; i <= upToIndex; i++) {
        const move = moveHistory[i];
        if (move) {
            const piece = board[move.prevY][move.prevX];
            board[move.prevY][move.prevX] = null;
            board[move.y][move.x] = piece;
        }
    }
    return board;
}

function renderBoard(board) {
    pgnBoardDiv.innerHTML = '';

    const boardSize = 8;
    let lastMove = null;
    if (pgnIndex >= 0) {
        lastMove = moveHistory[pgnIndex];
    }

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            const cellDiv = document.createElement('div');
            cellDiv.classList.add('cell');
            if (lastMove) {
                const [prevX, prevY] = [lastMove.prevX, lastMove.prevY];
                const [newX, newY] = [lastMove.x, lastMove.y];
                if (x === prevX && y === prevY) {
                    cellDiv.classList.add('highlight-previous');
                } else if (x === newX && y === newY) {
                    cellDiv.classList.add('highlight-new');
                }
            }
            if (board[y] && board[y][x]) {
                const pieceDiv = document.createElement('div');
                pieceDiv.classList.add('piece');
                pieceDiv.classList.add(board[y][x].color === 'w' ? 'white' : 'black');
                cellDiv.appendChild(pieceDiv);
            }
            pgnBoardDiv.appendChild(cellDiv);
        }
    }
}

function highlightCurrentMove() {
    const moveSpans = pgnText.querySelectorAll('.move');
    moveSpans.forEach((span, index) => {
        if (index === pgnIndex) {
            span.classList.add('highlighted');
        } else {
            span.classList.remove('highlighted');
        }
    });
}

function formatPosition(x, y) {
    const letters = 'abcdefgh';
    return `${letters[x]}${8 - y}`;
}

function generatePgnString() {
    const event = "[Event \"เกมหมากหนีบ\"]";
    const site = "[Site \"MakNeep\"]";
    const date = `[Date "${pgnData.Date}"]`;
    const round = `[Round "${pgnData.Round}"]`;
    const white = `[White "${pgnData.White}"]`;
    const black = `[Black "${pgnData.Black}"]`;
    const result = `[Result "${pgnData.Result}"]`;

    const utcTime = new Date(`${pgnData.Date}T${pgnData.Time}Z`);
    const localTime = utcTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const time = `[Time "${localTime}"]`;

    const timeControl = "[TimeControl \"600 second\"]";
    const moves = generateMoveString();

    return `${event}\n${site}\n${date}\n${round}\n${white}\n${black}\n${result}\n${time}\n${timeControl}\n\n${moves}`;
}

function generateMoveString() {
    let movesString = '';
    for (let i = 0; i < moveHistory.length; i += 2) {
        const moveNumber = `${Math.floor(i / 2) + 1}. `;
        const whiteMove = moveHistory[i];
        const whiteMoveString = whiteMove ? `${formatPosition(whiteMove.prevX, whiteMove.prevY)} - ${formatPosition(whiteMove.x, whiteMove.y)}` : '';

        movesString += moveNumber + whiteMoveString;

        if (i + 1 < moveHistory.length) {
            const blackMove = moveHistory[i + 1];
            const blackMoveString = blackMove ? `${formatPosition(blackMove.prevX, blackMove.prevY)} - ${formatPosition(blackMove.x, blackMove.y)}` : '';
            movesString += ` ${blackMoveString}`;
        }

        movesString += ' ';
    }
    return movesString.trim();
}

if (moveHistory.length > 0) {
    pgnIndex = 0;
    updatePgnBoard();
}
