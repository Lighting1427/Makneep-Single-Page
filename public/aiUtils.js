import { checkCaptures } from './captureUtils.js';

export function getBestMove(board, color) {
    let bestMove = null;
    let bestMoveValue = -Infinity;

    console.log("Evaluating best move for color:", color);

    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
            if (board[y][x] && board[y][x].color === color) {
                const piece = board[y][x];
                const validMoves = getValidMoves(board, piece);

                validMoves.forEach(move => {
                    const testBoard = cloneBoard(board);
                    testBoard[piece.y][piece.x] = null;
                    testBoard[move.y][move.x] = piece;

                    
                    const captures = checkCaptures(testBoard, { x: move.x, y: move.y, color });
                    if (captures.length > 0) {
                        bestMove = { piece, x: move.x, y: move.y, prevX: piece.x, prevY: piece.y };
                        console.log("Capturing move found:", bestMove);
                        bestMoveValue = 1000; 
                        return;
                    }

                    const moveValue = minimax(testBoard, color, 3, false, -Infinity, Infinity);
                    console.log(`Move from (${piece.x}, ${piece.y}) to (${move.x}, ${move.y}) has value: ${moveValue}`);

                    if (moveValue > bestMoveValue) {
                        bestMoveValue = moveValue;
                        bestMove = {
                            piece,
                            x: move.x,
                            y: move.y,
                            prevX: piece.x,
                            prevY: piece.y
                        };
                    }
                });
            }
        }
    }

    console.log("Best move selected:", bestMove);

    return bestMove;
}

function minimax(board, color, depth, isMaximizing, alpha, beta, transpositionTable = {}) {
    const boardHash = hashBoard(board);
    if (transpositionTable[boardHash] !== undefined) {
        return transpositionTable[boardHash];
    }

    if (depth === 0) {
        return evaluateBoard(board, color);
    }

    const opponentColor = color === 'w' ? 'b' : 'w';
    let bestValue = isMaximizing ? -Infinity : Infinity;
    const potentialMoves = [];

    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
            if (board[y][x] && board[y][x].color === (isMaximizing ? color : opponentColor)) {
                const piece = board[y][x];
                const validMoves = getValidMoves(board, piece);

                validMoves.forEach(move => {
                    potentialMoves.push({ piece, move });
                });
            }
        }
    }

    potentialMoves.sort((a, b) => {
        return evaluateMove(a, color) - evaluateMove(b, color);
    });

    for (let i = 0; i < potentialMoves.length; i++) {
        const { piece, move } = potentialMoves[i];
        const testBoard = cloneBoard(board);
        testBoard[piece.y][piece.x] = null;
        testBoard[move.y][move.x] = piece;

        if (!isMoveSafe(testBoard, piece, move)) {
            continue;
        }

        const boardValue = minimax(testBoard, color, depth - 1, !isMaximizing, alpha, beta, transpositionTable);

        if (isMaximizing) {
            bestValue = Math.max(bestValue, boardValue);
            alpha = Math.max(alpha, bestValue);
        } else {
            bestValue = Math.min(bestValue, boardValue);
            beta = Math.min(beta, bestValue);
        }

        if (beta <= alpha) {
            break; 
        }
    }

    transpositionTable[boardHash] = bestValue;
    return bestValue;
}

function evaluateMove(move, color) {
    const centerX = 4.5;
    const centerY = 4.5;
    const distanceToCenter = Math.abs(move.x - centerX) + Math.abs(move.y - centerY);
    
    return -distanceToCenter;
}

function isMoveSafe(board, piece, move) {
    const testBoard = cloneBoard(board);
    testBoard[piece.y][piece.x] = null;
    testBoard[move.y][move.x] = piece;
    const opponentColor = piece.color === 'w' ? 'b' : 'w';

    
    if (checkCaptures(testBoard, { x: move.x, y: move.y, color: opponentColor }).length > 0) {
        return false;
    }

    
    if (createsMiddleCaptureOpportunity(testBoard, move, piece.color)) {
        return false;
    }

    
    if (exposesToFutureCaptures(testBoard, move, piece.color)) {
        return false;
    }

    return true;
}

function cloneBoard(board) {
    return board.map(row => row.slice());
}

function hashBoard(board) {
    return board.map(row => row.join('')).join('|');
}

function createsMiddleCaptureOpportunity(board, move, color) {
    const opponentColor = color === 'w' ? 'b' : 'w';
    const directions = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 }
    ];

    for (let direction of directions) {
        const middleX = move.x + direction.dx;
        const middleY = move.y + direction.dy;
        const oppositeX = move.x - direction.dx;
        const oppositeY = move.y - direction.dy;

        if (
            isInBounds(middleX, middleY, board) && isInBounds(oppositeX, oppositeY, board) &&
            board[middleY][middleX] && board[oppositeY][oppositeX] && 
            board[middleY][middleX].color === opponentColor &&
            board[oppositeY][oppositeX].color === opponentColor
        ) {
            return true;
        }
    }

    return false;
}

function exposesToFutureCaptures(board, move, color) {
    const opponentColor = color === 'w' ? 'b' : 'w';
    const directions = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 }
    ];

    for (let dir of directions) {
        const x = move.x + dir.dx;
        const y = move.y + dir.dy;

        if (isInBounds(x, y, board) && board[y][x] && board[y][x].color === opponentColor) {
            const testBoard = cloneBoard(board);
            testBoard[move.y][move.x] = null;
            testBoard[y][x] = { color: opponentColor }; 

            if (checkCaptures(testBoard, { x, y, color }).length > 0) {
                return true;
            }
        }
    }

    return false;
}

function evaluateBoard(board, color) {
    const opponentColor = color === 'w' ? 'b' : 'w';
    const captures = countCaptures(board, color) - countCaptures(board, opponentColor);
    const threats = countThreats(board, opponentColor) - countThreats(board, color);
    const baiting = countBaiting(board, color) - countBaiting(board, opponentColor);
    const safety = assessSafety(board, color) - assessSafety(board, opponentColor);

    return captures * 20 + baiting * 10 - threats * 5 + safety * 3;
}

function countCaptures(board, color) {
    let captures = 0;
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
            if (board[y][x] && board[y][x].color === color) {
                captures += checkCaptures(board, { x, y, color }).length;
            }
        }
    }
    return captures;
}

function countThreats(board, color) {
    let threats = 0;
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
            if (board[y][x] && board[y][x].color === color) {
                threats += countThreatsAfterMove(board, { x, y, color });
            }
        }
    }
    return threats;
}

function countThreatsAfterMove(board, piece) {
    let threats = 0;
    const opponentColor = piece.color === 'w' ? 'b' : 'w';
    const directions = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 }
    ];

    directions.forEach(direction => {
        let x = piece.x + direction.dx;
        let y = piece.y + direction.dy;
        if (isInBounds(x, y, board) && board[y][x] && board[y][x].color === opponentColor) {
            threats++;
        }
    });

    return threats;
}

function countBaiting(board, color) {
    let baiting = 0;
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
            if (board[y][x] && board[y][x].color === color) {
                baiting += countBaitingAfterMove(board, { x, y, color });
            }
        }
    }
    return baiting;
}

function countBaitingAfterMove(board, piece) {
    let baiting = 0;
    const directions = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 }
    ];

    directions.forEach(direction => {
        const midX = piece.x + direction.dx;
        const midY = piece.y + direction.dy;
        const oppositeX = piece.x + 2 * direction.dx;
        const oppositeY = piece.y + 2 * direction.dy;

        if (
            isInBounds(midX, midY, board) && isInBounds(oppositeX, oppositeY, board) &&
            board[midY][midX] && board[midY][midX].color !== piece.color &&
            board[oppositeY][oppositeX] && board[oppositeY][oppositeX].color === piece.color
        ) {
            baiting++;
        }
    });

    return baiting;
}

function assessSafety(board, color) {
    let safety = 0;
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
            if (board[y][x] && board[y][x].color === color) {
                safety += calculateSafety(board, { x, y, color });
            }
        }
    }
    return safety;
}

function calculateSafety(board, piece) {
    const directions = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 }
    ];
    const opponentColor = piece.color === 'w' ? 'b' : 'w';
    let safety = 0;

    directions.forEach(direction => {
        let x = piece.x + direction.dx;
        let y = piece.y + direction.dy;
        if (isInBounds(x, y, board) && board[y][x] && board[y][x].color === opponentColor) {
            safety--;
        } else if (isInBounds(x, y, board) && board[y][x] && board[y][x].color === piece.color) {
            safety++;
        }
    });

    return safety;
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

        while (x >= 0 && x < board.length && y >= 0 && y < board[0].length && !board[y][x]) {
            moves.push({ x, y });
            x += direction.x;
            y += direction.y;
        }
    }

    return moves;
}

function isInBounds(x, y, board) {
    return y >= 0 && y < board.length && x >= 0 && x < board[0].length;
}
