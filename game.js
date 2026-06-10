/* Shared game logic for Makruk (global functions) */

var INITIAL_BOARD = [
  ['Rb','Nb','Bb','Qb','Kb','Bb','Nb','Rb'],
  [null,null,null,null,null,null,null,null],
  ['Pb','Pb','Pb','Pb','Pb','Pb','Pb','Pb'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['Pw','Pw','Pw','Pw','Pw','Pw','Pw','Pw'],
  [null,null,null,null,null,null,null,null],
  ['Rw','Nw','Bw','Kw','Qw','Bw','Nw','Rw'],
];

function cloneBoard(b) { return b.map(r => [...r]); }
function colorOf(p)    { return p ? p.slice(-1) : null; }
function typeOf(p)     { return p ? p.slice(0,-1) : null; }
function opposite(c)   { return c === 'w' ? 'b' : 'w'; }

function fmt(secs) {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function getPieceName(p) {
  if (!p) return '';
  const names = {'K':'ข','Q':'ม็','B':'ค','N':'ม','R':'ร','P':'บ'};
  return names[typeOf(p)] || '';
}

function getPosName(r, c) {
  const cols = ['ก','ข','ค','ง','จ','ฉ','ช','ซ'];
  const rows = ['8','7','6','5','4','3','2','1'];
  return cols[c] + rows[r];
}

function promoteIfNeeded(piece, toRow) {
  if (typeOf(piece) === 'P') {
    if (colorOf(piece) === 'w' && toRow <= 2) return 'Qw';
    if (colorOf(piece) === 'b' && toRow >= 5) return 'Qb';
  }
  return piece;
}

function getRawMoves(board, row, col) {
  const piece = board[row][col];
  if (!piece) return [];
  const t = typeOf(piece), c = colorOf(piece);
  const moves = [];
  const add = (r, c2) => {
    if (r<0||r>7||c2<0||c2>7) return;
    const tgt = board[r][c2];
    if (!tgt || colorOf(tgt) !== c) moves.push({from:{row,col},to:{row:r,col:c2}});
  };
  const slide = (dr, dc) => {
    let r=row+dr, c2=col+dc;
    while (r>=0&&r<8&&c2>=0&&c2<8) {
      const tgt=board[r][c2];
      if (tgt) { if (colorOf(tgt)!==c) moves.push({from:{row,col},to:{row:r,col:c2}}); break; }
      moves.push({from:{row,col},to:{row:r,col:c2}});
      r+=dr; c2+=dc;
    }
  };
  if (t==='P') {
    const dir = c==='w' ? -1 : 1;
    const nr = row+dir;
    if (nr>=0&&nr<8&&!board[nr][col]) moves.push({from:{row,col},to:{row:nr,col}});
    [[nr,col-1],[nr,col+1]].forEach(([r,c2])=>{
      if (r>=0&&r<8&&c2>=0&&c2<8&&board[r][c2]&&colorOf(board[r][c2])!==c)
        moves.push({from:{row,col},to:{row:r,col:c2}});
    });
  } else if (t==='Q') {
    [[-1,-1],[-1,1],[1,-1],[1,1],[0,-1],[0,1]].forEach(([dr,dc])=>add(row+dr,col+dc));
  } else if (t==='K') {
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc) add(row+dr,col+dc);
  } else if (t==='N') {
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>add(row+dr,col+dc));
  } else if (t==='B') {
    const fwd = c==='w' ? -1 : 1;
    [[fwd,0],[fwd,-1],[fwd,1],[-fwd,-1],[-fwd,1]].forEach(([dr,dc])=>add(row+dr,col+dc));
  } else if (t==='R') {
    [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr,dc])=>slide(dr,dc));
  }
  return moves;
}

function findKing(board, color) {
  for (let r=0;r<8;r++) for (let c=0;c<8;c++)
    if (board[r][c]==='K'+color) return {row:r,col:c};
  return null;
}

function isInCheck(board, color) {
  const king = findKing(board, color);
  if (!king) return false;
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    if (colorOf(board[r][c])===opposite(color)) {
      if (getRawMoves(board,r,c).some(m=>m.to.row===king.row&&m.to.col===king.col)) return true;
    }
  }
  return false;
}

function getLegalMoves(board, row, col) {
  const piece = board[row][col];
  if (!piece) return [];
  const color = colorOf(piece);
  return getRawMoves(board,row,col).filter(move => {
    const nb = cloneBoard(board);
    nb[move.to.row][move.to.col] = promoteIfNeeded(nb[move.from.row][move.from.col], move.to.row);
    nb[move.from.row][move.from.col] = null;
    return !isInCheck(nb, color);
  });
}

function getAllLegalMoves(board, color) {
  const moves = [];
  for (let r=0;r<8;r++) for (let c=0;c<8;c++)
    if (colorOf(board[r][c])===color) moves.push(...getLegalMoves(board,r,c));
  return moves;
}

function calcCell(hasSidebar) {
  const aw = hasSidebar ? (window.innerWidth > 700 ? window.innerWidth - 330 : window.innerWidth - 40) : (window.innerWidth - 40);
  const ah = window.innerHeight - 264;
  return Math.max(34, Math.min(Math.floor(Math.min(ah,aw)/8), 80));
}

function applyCell(size) {
  document.documentElement.style.setProperty('--cell', `${size}px`);
}

function setupCoords(flipped) {
  const cols = ['ก','ข','ค','ง','จ','ฉ','ช','ซ'];
  const rows = [8,7,6,5,4,3,2,1];
  const l = document.getElementById('coords-left');
  const b = document.getElementById('coords-bottom');
  if (!l || !b) return;
  l.replaceChildren(); b.replaceChildren();
  const vr = flipped ? [...rows].reverse() : rows;
  const vc = flipped ? [...cols].reverse() : cols;
  vr.forEach(v=>{ const e=document.createElement('span'); e.className='coord'; e.textContent=v; l.appendChild(e); });
  vc.forEach(v=>{ const e=document.createElement('span'); e.className='coord'; e.textContent=v; b.appendChild(e); });
}

function renderBoard(boardState, selected, legalForSelected, lastMove, turn, flipped, onCellClick, onDropMove) {
  const el = document.getElementById('chess-board');
  if (!el) return;
  el.replaceChildren();
  const rowOrder = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const colOrder = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  
  // เช็คว่าเป็นตาของเราหรือไม่
  const isMyTurn = (turn === window.myColor && !window.gameOver);

  rowOrder.forEach(row => {
    colOrder.forEach(col => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `chess-cell ${(row+col)%2===0?'light':'dark'}`;

      if (lastMove && ((lastMove.from.row===row&&lastMove.from.col===col) || (lastMove.to.row===row&&lastMove.to.col===col))) 
        cell.classList.add('last-move');
      if (selected && selected.row===row && selected.col===col) cell.classList.add('selected');

      const isLegal = legalForSelected && legalForSelected.some(m=>m.to.row===row&&m.to.col===col);
      if (isLegal) cell.classList.add(boardState[row][col] ? 'capture' : 'legal');

      const inCheck = isInCheck(boardState, turn);
      if (inCheck) {
        const king = findKing(boardState, turn);
        if (king && king.row===row && king.col===col) cell.classList.add('in-check');
      }

      const piece = boardState[row][col];
      if (piece) {
        const img = document.createElement('img');
        img.className = 'piece-img';
        img.src = `../Pieces/${piece}.png`;
        img.alt = piece;
        
        // 📌 เพิ่มระบบลากวาง (Drag & Drop)
        if (isMyTurn && colorOf(piece) === window.myColor) {
          img.draggable = true;
          img.addEventListener('dragstart', e => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify({row, col}));
            if (onCellClick) onCellClick(row, col); // เลือกหมากทันทีที่เริ่มลาก
          });
        }
        cell.appendChild(img);
      }

      if (!isMyTurn) cell.classList.add('not-my-turn');
      
      // 📌 Event กดคลิก และ ปล่อยหมาก (Drop)
      cell.addEventListener('click', () => onCellClick && onCellClick(row, col));
      cell.addEventListener('dragover', e => e.preventDefault());
      cell.addEventListener('drop', e => {
        e.preventDefault();
        if (!isMyTurn) return;
        const payload = e.dataTransfer.getData('text/plain');
        if (!payload) return;
        try {
          const from = JSON.parse(payload);
          if (from.row === row && from.col === col) return;
          if (onDropMove) onDropMove(from, {row, col});
        } catch(err) {}
      });
      el.appendChild(cell);
    });
  });
}

function renderCaptures(capturedByW, capturedByB, myColor) {
  const pieceOrder = { 'P': 1, 'Q': 2, 'B': 3, 'N': 4, 'R': 5 };

  const renderList = (id, list) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.replaceChildren();

    const sortedList = list.slice().sort((a, b) => {
      return (pieceOrder[a[0]] || 99) - (pieceOrder[b[0]] || 99);
    });

    let lastType = null;

    sortedList.forEach(p => {
      const currentType = p[0];
      const img = document.createElement('img');
      img.src = `../Pieces/${p}.png`;
      img.alt = p;
      if (currentType === lastType) img.style.marginLeft = '-15px';
      el.appendChild(img);
      lastType = currentType;
    });
  };

  if (myColor === 'w') {
    renderList('cap-opp', capturedByB || []);
    renderList('cap-me',  capturedByW || []);
  } else {
    renderList('cap-opp', capturedByW || []);
    renderList('cap-me',  capturedByB || []);
  }
}