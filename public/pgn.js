const pgnBoardDiv = document.getElementById('pgnBoard');
const pgnText = document.getElementById('pgnText');
const pgnData = JSON.parse(localStorage.getItem('pgnData'));
const moveHistory = pgnData.moveHistory;
const gameStartTime = new Date(pgnData.startTime);
const whitePlayer = pgnData.whitePlayer || 'White Player';
const blackPlayer = pgnData.blackPlayer || 'Black Player';
const gameResult = pgnData.result || '*';

let pgnIndex = -1;

document.getElementById('backToGameButton').addEventListener('click', () => {
    window.close();
});

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

function generatePgnString() {
    const event = "[Event \"เกมหมากหนีบ\"]";
    const site = "[Site \"MakNeep\"]";
    const date = `[Date "${gameStartTime.toISOString().split('T')[0]}"]`;
    const round = `[Round "${calculateRound(moveHistory)}"]`;
    const white = `[White "${whitePlayer}"]`;
    const black = `[Black "${blackPlayer}"]`;
    const result = `[Result "${gameResult}"]`;
    const time = `[Time "${gameStartTime.toTimeString().split(' ')[0]}"]`;
    const timeControl = "[TimeControl \"600 second\"]";
    const moves = generateMoveString();

    return `${event}\n${site}\n${date}\n${round}\n${white}\n${black}\n${result}\n${time}\n${timeControl}\n\n${moves}`;
}

function calculateRound(moveHistory) {
    return Math.ceil(moveHistory.length / 2);
}

function generateMoveString() {
    let movesString = '';
    for (let i = 0; i < moveHistory.length; i += 2) {
        const moveNumber = `${Math.floor(i / 2) + 1}. `;
        const whiteMove = moveHistory[i]?.move;
        const whiteMoveString = whiteMove ? `${formatPosition(whiteMove.prevX, whiteMove.prevY)} - ${formatPosition(whiteMove.x, whiteMove.y)}` : '';

        movesString += moveNumber + whiteMoveString;

        if (i + 1 < moveHistory.length) {
            const blackMove = moveHistory[i + 1]?.move;
            const blackMoveString = blackMove ? `${formatPosition(blackMove.prevX, blackMove.prevY)} - ${formatPosition(blackMove.x, blackMove.y)}` : '';
            movesString += ` ${blackMoveString}`;
        }

        movesString += ' ';
    }
    return movesString.trim();
}

function updatePgnBoard() {
    const currentBoardState = moveHistory[pgnIndex]?.boardState || [];
    renderBoard(currentBoardState);
    renderMoveHistory();
}

function renderBoard(board) {
    pgnBoardDiv.innerHTML = '';
    const boardSize = 8;
    let lastMove = null;
    if (pgnIndex >= 0) {
        lastMove = moveHistory[pgnIndex]?.move;
    }

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            const cellDiv = document.createElement('div');
            cellDiv.classList.add('cell');
            if (lastMove) {
                if (x === lastMove.prevX && y === lastMove.prevY) {
                    cellDiv.classList.add('highlight-previous');
                } else if (x === lastMove.x && y === lastMove.y) {
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

function renderMoveHistory() {
    pgnText.innerHTML = '';
    for (let i = 0; i < moveHistory.length; i += 2) {
        const movePairDiv = document.createElement('div');
        movePairDiv.classList.add('move-pair');

        const moveNumberSpan = document.createElement('span');
        moveNumberSpan.classList.add('move-number');
        moveNumberSpan.textContent = `${Math.floor(i / 2) + 1}. `;

        const whiteMoveSpan = document.createElement('span');
        whiteMoveSpan.classList.add('move');
        const whiteMove = moveHistory[i]?.move;
        whiteMoveSpan.textContent = whiteMove ? `${formatPosition(whiteMove.prevX, whiteMove.prevY)} - ${formatPosition(whiteMove.x, whiteMove.y)} ` : '';
        whiteMoveSpan.addEventListener('click', () => {
            pgnIndex = i;
            updatePgnBoard();
        });

        movePairDiv.appendChild(moveNumberSpan);
        movePairDiv.appendChild(whiteMoveSpan);

        if (i + 1 < moveHistory.length) {
            const blackMoveSpan = document.createElement('span');
            blackMoveSpan.classList.add('move');
            const blackMove = moveHistory[i + 1]?.move;
            blackMoveSpan.textContent = blackMove ? `${formatPosition(blackMove.prevX, blackMove.prevY)} - ${formatPosition(blackMove.x, blackMove.y)} ` : '';
            blackMoveSpan.addEventListener('click', () => {
                pgnIndex = i + 1;
                updatePgnBoard();
            });
            movePairDiv.appendChild(blackMoveSpan);
        }

        pgnText.appendChild(movePairDiv);
    }

    const moveSpans = pgnText.querySelectorAll('.move');
    moveSpans.forEach((span, i) => {
        if (i === pgnIndex) {
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

if (moveHistory.length > 0) {
    pgnIndex = 0;
    updatePgnBoard();
}
