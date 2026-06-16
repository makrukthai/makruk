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
    [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>add(row+dr,col+dc));
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
  
  el.style.touchAction = 'none';

  // 📌 1. อ่านการตั้งค่าจาก Local Storage แบบ Real-time
  const userSettings = JSON.parse(localStorage.getItem('rukthai_settings')) || {};
  const moveMethod = userSettings.moveMethod || 'both'; // 'both' | 'drag' | 'click'
  const showMoves = userSettings.showMoves || 'show';   // 'show' | 'hide'

  const rowOrder = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const colOrder = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

  rowOrder.forEach(row => {
    colOrder.forEach(col => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `chess-cell ${(row+col)%2===0?'light':'dark'}`;
      
      cell.dataset.row = row;
      cell.dataset.col = col;

      if (lastMove && ((lastMove.from.row===row&&lastMove.from.col===col) || (lastMove.to.row===row&&lastMove.to.col===col))) 
        cell.classList.add('last-move');
      
      if (selected && selected.row===row && selected.col===col) 
        cell.classList.add('selected');

      const isLegal = legalForSelected && legalForSelected.some(m=>m.to.row===row&&m.to.col===col);
      // 📌 2. แสดงจุดตาเดินเฉพาะเมื่อตั้งค่าเป็น 'show' (แสดง) เท่านั้น
      if (isLegal && showMoves === 'show') cell.classList.add(boardState[row][col] ? 'capture' : 'legal');

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
        
        img.draggable = false; 

        img.addEventListener('pointerdown', (e) => {
          if (window.gameOver) return;

          const movingColor = colorOf(piece);
          
          if (window.myColor !== null && window.myColor !== movingColor) {
             if (typeof currentMode === 'undefined' || currentMode !== 'setup') {
                // เป็นหมากของศัตรู — เลือก/ลากไม่ได้ แต่ "คลิกเพื่อกิน" ได้
                // ส่งต่อให้หน้าเพจตัดสินใจ (ถ้ามีหมากที่เลือกไว้และช่องนี้เป็นตาเดินถูกกฎ = กิน)
                e.preventDefault();
                e.stopPropagation();
                if (moveMethod !== 'drag' && onCellClick) onCellClick(row, col);
                return;
             }
          }

          e.preventDefault(); 
          e.stopPropagation();

          let moves = [];
          if (!window.myColor || (window.myColor === movingColor && turn === movingColor)) {
              moves = window.getLegalMoves(boardState, row, col);
          }

          const chessCells = el.querySelectorAll('.chess-cell');
          chessCells.forEach(c => {
             const cr = parseInt(c.dataset.row);
             const cc = parseInt(c.dataset.col);
             
             if (cr === row && cc === col) {
                c.classList.add('selected'); 
             }

             const isLegalMove = moves.some(m => m.to.row === cr && m.to.col === cc);
             // 📌 3. ไฮไลต์ตอนจับหมากก็แสดงเฉพาะเมื่อตั้งเป็น 'show'
             if (isLegalMove && showMoves === 'show') {
                c.classList.add(boardState[cr][cc] ? 'capture' : 'legal');
             }
          });

          // 📌 4. ถ้าระบบตั้งให้เป็น 'click' อย่างเดียว จะห้ามโคลนภาพและห้ามลากเด็ดขาด
          if (moveMethod === 'click') {
             if (onCellClick) onCellClick(row, col);
             return; 
          }

          const rect = img.getBoundingClientRect();
          const clone = img.cloneNode(true);
          clone.classList.add('dragging-piece');
          clone.style.width = `${rect.width}px`;
          clone.style.height = `${rect.height}px`;
          document.body.appendChild(clone);

          img.style.opacity = '0.3'; 
          
          const moveAt = (pageX, pageY) => {
            clone.style.left = pageX - rect.width / 2 + 'px';
            clone.style.top = pageY - rect.height / 2 + 'px';
          };
          moveAt(e.pageX, e.pageY);

          let startX = e.pageX;
          let startY = e.pageY;
          let isDragging = false;

          const onPointerMove = (moveEvent) => {
            moveEvent.preventDefault();
            if (Math.abs(moveEvent.pageX - startX) > 5 || Math.abs(moveEvent.pageY - startY) > 5) {
               isDragging = true;
            }
            moveAt(moveEvent.pageX, moveEvent.pageY);
          };

          const onPointerUp = (upEvent) => {
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            clone.remove(); 
            img.style.opacity = '1'; 

            chessCells.forEach(c => {
                c.classList.remove('legal', 'capture', 'selected');
            });

            clone.hidden = true; 
            const elemBelow = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
            clone.hidden = false;

            if (!isDragging) {
                // 📌 5. ถ้าไม่ลาก แต่ตั้งค่าบังคับเป็น 'drag' (ห้ามคลิก) จะไม่ส่ง Event คลิก
                if (moveMethod !== 'drag') {
                   if (onCellClick) onCellClick(row, col);
                }
            } else {
                if (elemBelow) {
                  const targetCell = elemBelow.closest('.chess-cell');
                  if (targetCell) {
                    const targetRow = parseInt(targetCell.dataset.row);
                    const targetCol = parseInt(targetCell.dataset.col);
                    
                    if (targetRow !== row || targetCol !== col) {
                      if (onDropMove) onDropMove({row, col}, {row: targetRow, col: targetCol});
                    } else {
                      if (moveMethod !== 'drag') {
                        if (onCellClick) onCellClick(row, col);
                      }
                    }
                  }
                }
            }
          };

          document.addEventListener('pointermove', onPointerMove, {passive: false});
          document.addEventListener('pointerup', onPointerUp);
        });

        cell.appendChild(img);
      }

      if (turn !== window.myColor && !window.gameOver && window.myColor !== null && window.myColor !== turn) {
        cell.classList.add('not-my-turn');
      }
      
      cell.addEventListener('pointerdown', (e) => {
        if (window.gameOver) return;
        
        // 📌 6. ถ้าเป็นโหมด 'drag' อย่างเดียว จะไม่อนุญาตให้คลิกช่องว่างหรือศัตรูเพื่อเดิน
        if (moveMethod === 'drag') return;

        if (e.target.tagName !== 'IMG' && onCellClick) {
           onCellClick(row, col);
        }
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