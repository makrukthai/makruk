const initialBoard = [
  ['Rb','Nb','Bb','Qb','Kb','Bb','Nb','Rb'],
  [null,null,null,null,null,null,null,null],
  ['Pb','Pb','Pb','Pb','Pb','Pb','Pb','Pb'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['Pw','Pw','Pw','Pw','Pw','Pw','Pw','Pw'],
  [null,null,null,null,null,null,null,null],
  ['Rw','Nw','Bw','Kw','Qw','Bw','Nw','Rw'],
];

const pieceNames = {
  K: 'ขุน',
  Q: 'เม็ด',
  B: 'โคน',
  N: 'ม้า',
  R: 'เรือ',
  P: 'เบี้ย',
};

const colorNames = {
  w: 'ขาว',
  b: 'ดำ',
};

const boardEl = document.getElementById('chess-board');
const statusEl = document.getElementById('game-status');
const whiteStateEl = document.getElementById('white-state');
const blackStateEl = document.getElementById('black-state');
const capturedByWhiteEl = document.getElementById('captured-by-white');
const capturedByBlackEl = document.getElementById('captured-by-black');
const resetButton = document.getElementById('reset-game');
const flipButton = document.getElementById('flip-board');

let boardState = cloneBoard(initialBoard);
let turn = 'w';
let selected = null;
let legalForSelected = [];
let lastMove = null;
let flipped = false;
let gameOver = false;
let capturedByWhite = [];
let capturedByBlack = [];

function cloneBoard(board) {
  return board.map(row => [...row]);
}

function calcCellSize() {
  const topbarH = document.querySelector('.topbar')?.offsetHeight || 64;
  const availableHeight = window.innerHeight - topbarH - 110;
  const availableWidth = window.innerWidth > 900 ? window.innerWidth - 460 : window.innerWidth - 80;
  const cell = Math.floor(Math.min(availableHeight, availableWidth) / 8);
  return Math.max(38, Math.min(cell, 74));
}

function applyCell(size) {
  document.documentElement.style.setProperty('--cell', `${size}px`);
  const left = document.getElementById('coords-left');
  const bottom = document.getElementById('coords-bottom');
  if (left) left.style.height = `${size * 8}px`;
  if (bottom) bottom.style.width = `${size * 8}px`;
}

function setupCoords() {
  const cols = ['ก','ข','ค','ง','จ','ฉ','ช','ซ'];
  const rows = [8,7,6,5,4,3,2,1];
  const left = document.getElementById('coords-left');
  const bottom = document.getElementById('coords-bottom');
  left.replaceChildren();
  bottom.replaceChildren();

  const visibleRows = flipped ? [...rows].reverse() : rows;
  const visibleCols = flipped ? [...cols].reverse() : cols;

  visibleRows.forEach(value => {
    const el = document.createElement('span');
    el.className = 'coord';
    el.textContent = value;
    left.appendChild(el);
  });

  visibleCols.forEach(value => {
    const el = document.createElement('span');
    el.className = 'coord';
    el.textContent = value;
    bottom.appendChild(el);
  });
}

function renderBoard() {
  boardEl.replaceChildren();
  const rows = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const cols = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const checkedKing = findKingInCheck(turn);

  rows.forEach(row => {
    cols.forEach(col => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `chess-cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
      cell.dataset.row = row;
      cell.dataset.col = col;

      if (selected && selected.row === row && selected.col === col) {
        cell.classList.add('selected');
      }
      if (lastMove && ((lastMove.from.row === row && lastMove.from.col === col) || (lastMove.to.row === row && lastMove.to.col === col))) {
        cell.classList.add('last-move');
      }
      if (checkedKing && checkedKing.row === row && checkedKing.col === col) {
        cell.classList.add('in-check');
      }

      const legalMove = legalForSelected.find(move => move.to.row === row && move.to.col === col);
      if (legalMove) {
        cell.classList.add(boardState[row][col] ? 'capture' : 'legal');
      }

      const piece = boardState[row][col];
      if (piece) {
        const img = document.createElement('img');
        img.className = 'piece-img';
        img.src = `../Pieces/${piece}.png`;
        img.alt = `${pieceNames[typeOf(piece)]}${colorNames[colorOf(piece)]}`;
        img.draggable = true;
        img.addEventListener('dragstart', event => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', JSON.stringify({ row, col }));
          selected = { row, col };
          legalForSelected = getLegalMovesForPiece(boardState, row, col);
          renderBoard();
        });
        cell.appendChild(img);
      }

      cell.addEventListener('click', () => handleCellClick(row, col));
      cell.addEventListener('dragover', event => {
        event.preventDefault();
      });
      cell.addEventListener('drop', event => {
        event.preventDefault();
        const payload = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
        if (!payload) return;
        let from;
        try {
          from = JSON.parse(payload);
        } catch (e) {
          return;
        }
        if (from.row === row && from.col === col) return;
        attemptDropMove(from, { row, col });
      });
      boardEl.appendChild(cell);
    });
  });
  renderStatus();
}

function renderStatus() {
  const check = isInCheck(boardState, turn);
  const moves = getAllLegalMoves(boardState, turn);
  const turnText = `ตา${colorNames[turn]}เดิน`;
  whiteStateEl.textContent = turn === 'w' && !gameOver ? 'ตาเดิน' : 'รอเดิน';
  blackStateEl.textContent = turn === 'b' && !gameOver ? 'ตาเดิน' : 'รอเดิน';

  if (moves.length === 0) {
    gameOver = true;
    if (check) {
      const winner = opposite(turn);
      statusEl.textContent = `รุกจน ${colorNames[winner]}ชนะ`;
    } else {
      statusEl.textContent = 'อับ เสมอ';
    }
    whiteStateEl.textContent = 'จบเกม';
    blackStateEl.textContent = 'จบเกม';
    return;
  }

  statusEl.textContent = check ? `${turnText} - ขุนถูกรุก` : turnText;
}

function renderCaptured() {
  renderCapturedList(capturedByWhiteEl, capturedByWhite);
  renderCapturedList(capturedByBlackEl, capturedByBlack);
}

function renderCapturedList(container, pieces) {
  container.replaceChildren();
  pieces.forEach(piece => {
    const img = document.createElement('img');
    img.src = `../Pieces/${piece}.png`;
    img.alt = piece;
    container.appendChild(img);
  });
}

function handleCellClick(row, col) {
  if (gameOver) return;
  const piece = boardState[row][col];

  if (selected) {
    const move = legalForSelected.find(item => item.to.row === row && item.to.col === col);
    if (move) {
      makeMove(move);
      return;
    }
  }

  if (piece && colorOf(piece) === turn) {
    selected = { row, col };
    legalForSelected = getLegalMovesForPiece(boardState, row, col);
  } else {
    selected = null;
    legalForSelected = [];
  }
  renderBoard();
}

function makeMove(move) {
  const piece = boardState[move.from.row][move.from.col];
  const captured = boardState[move.to.row][move.to.col];
  boardState[move.to.row][move.to.col] = promoteIfNeeded(piece, move.to.row);
  boardState[move.from.row][move.from.col] = null;

  if (captured) {
    if (colorOf(piece) === 'w') capturedByWhite.push(captured);
    else capturedByBlack.push(captured);
  }

  lastMove = move;
  selected = null;
  legalForSelected = [];
  turn = opposite(turn);
  renderCaptured();
  renderBoard();
}

function promoteIfNeeded(piece, row) {
  if (typeOf(piece) !== 'P') return piece;
  if (colorOf(piece) === 'w' && row === 2) return 'Qw';
  if (colorOf(piece) === 'b' && row === 5) return 'Qb';
  return piece;
}

function getLegalMovesForPiece(board, row, col) {
  const piece = board[row][col];
  if (!piece) return [];
  return getPseudoMoves(board, row, col).filter(move => {
    const next = applyMoveToClone(board, move);
    return !isInCheck(next, colorOf(piece));
  });
}

function getAllLegalMoves(board, color) {
  const moves = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && colorOf(piece) === color) {
        moves.push(...getLegalMovesForPiece(board, row, col));
      }
    }
  }
  return moves;
}

function getPseudoMoves(board, row, col) {
  const piece = board[row][col];
  const type = typeOf(piece);
  const color = colorOf(piece);
  const moves = [];

  if (type === 'K') addStepMoves(board, row, col, moves, allDirections());
  if (type === 'Q') addStepMoves(board, row, col, moves, diagonalDirections());
  if (type === 'B') {
    const forward = color === 'w' ? -1 : 1;
    addStepMoves(board, row, col, moves, [[forward, 0], [forward, -1], [forward, 1], [-forward, -1], [-forward, 1]]);
  }
  if (type === 'N') addStepMoves(board, row, col, moves, [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]);
  if (type === 'R') addSlideMoves(board, row, col, moves, [[-1,0],[1,0],[0,-1],[0,1]]);
  if (type === 'P') addPawnMoves(board, row, col, moves, color);

  return moves;
}

function addStepMoves(board, row, col, moves, offsets) {
  offsets.forEach(([dr, dc]) => {
    const to = { row: row + dr, col: col + dc };
    if (canLand(board, row, col, to.row, to.col)) moves.push({ from: { row, col }, to });
  });
}

function addSlideMoves(board, row, col, moves, directions) {
  directions.forEach(([dr, dc]) => {
    let nextRow = row + dr;
    let nextCol = col + dc;
    while (isInside(nextRow, nextCol)) {
      if (!board[nextRow][nextCol]) {
        moves.push({ from: { row, col }, to: { row: nextRow, col: nextCol } });
      } else {
        if (colorOf(board[nextRow][nextCol]) !== colorOf(board[row][col])) {
          moves.push({ from: { row, col }, to: { row: nextRow, col: nextCol } });
        }
        break;
      }
      nextRow += dr;
      nextCol += dc;
    }
  });
}

function addPawnMoves(board, row, col, moves, color) {
  const dir = color === 'w' ? -1 : 1;
  const forwardRow = row + dir;
  if (isInside(forwardRow, col) && !board[forwardRow][col]) {
    moves.push({ from: { row, col }, to: { row: forwardRow, col } });
  }
  [col - 1, col + 1].forEach(nextCol => {
    if (!isInside(forwardRow, nextCol)) return;
    const target = board[forwardRow][nextCol];
    if (target && colorOf(target) !== color) {
      moves.push({ from: { row, col }, to: { row: forwardRow, col: nextCol } });
    }
  });
}

function isInCheck(board, color) {
  const king = findKing(board, color);
  if (!king) return false;
  return isSquareAttacked(board, king.row, king.col, opposite(color));
}

function findKingInCheck(color) {
  if (!isInCheck(boardState, color)) return null;
  return findKing(boardState, color);
}

function isSquareAttacked(board, row, col, attackerColor) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || colorOf(piece) !== attackerColor) continue;
      if (getPseudoMoves(board, r, c).some(move => move.to.row === row && move.to.col === col)) {
        return true;
      }
    }
  }
  return false;
}

function findKing(board, color) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (board[row][col] === `K${color}`) return { row, col };
    }
  }
  return null;
}

function applyMoveToClone(board, move) {
  const next = cloneBoard(board);
  const piece = next[move.from.row][move.from.col];
  next[move.to.row][move.to.col] = promoteIfNeeded(piece, move.to.row);
  next[move.from.row][move.from.col] = null;
  return next;
}

function canLand(board, fromRow, fromCol, toRow, toCol) {
  if (!isInside(toRow, toCol)) return false;
  const target = board[toRow][toCol];
  return !target || colorOf(target) !== colorOf(board[fromRow][fromCol]);
}

function typeOf(piece) {
  return piece[0];
}

function colorOf(piece) {
  return piece[1];
}

function opposite(color) {
  return color === 'w' ? 'b' : 'w';
}

function isInside(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function allDirections() {
  return [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
}

function diagonalDirections() {
  return [[-1,-1],[-1,1],[1,-1],[1,1]];
}

function resetGame() {
  boardState = cloneBoard(initialBoard);
  turn = 'w';
  selected = null;
  legalForSelected = [];
  lastMove = null;
  gameOver = false;
  capturedByWhite = [];
  capturedByBlack = [];
  renderCaptured();
  renderBoard();
}

function attemptDropMove(from, to) {
  const piece = boardState[from.row]?.[from.col];
  if (!piece || colorOf(piece) !== turn) return false;
  const moves = getLegalMovesForPiece(boardState, from.row, from.col);
  const move = moves.find(item => item.to.row === to.row && item.to.col === to.col);
  if (!move) return false;
  makeMove(move);
  return true;
}

function loadPlayer() {
  try {
    const raw = localStorage.getItem('rukthai_current_user') || localStorage.getItem('makruk_current_user') || localStorage.getItem('currentUser');
    if (!raw) return;
    const user = JSON.parse(raw);
    if (user?.name) document.getElementById('my-name').textContent = user.name;
    if (user?.avatar) {
      document.getElementById('my-avatar').innerHTML = `<img src="${user.avatar}" alt="${user.name || 'avatar'}">`;
    } else if (user?.name) {
      document.getElementById('my-avatar').textContent = user.name[0].toUpperCase();
    }
  } catch (error) {
    console.warn('Cannot load player profile', error);
  }
}

applyCell(calcCellSize());
setupCoords();
loadPlayer();
renderCaptured();
renderBoard();

window.addEventListener('resize', () => applyCell(calcCellSize()));
resetButton.addEventListener('click', resetGame);
flipButton.addEventListener('click', () => {
  flipped = !flipped;
  setupCoords();
  renderBoard();
});
