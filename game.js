const LEVELS = {
    beginner: { r: 9, c: 9, m: 10 },
    intermediate: { r: 16, c: 16, m: 40 },
    expert: { r: 16, c: 30, m: 99 }
};

let ROWS = 9, COLS = 9, MINES = 10, revealedCount = 0; // лічильник відкритих клітинок
let X_LABELS = [], gameState = [], pivot, timerInterval = null;
let gameOver = false, isFirstClick = true, flagsPlaced = 0, timeElapsed = 0;

// оптимізувати константами TODO.....
const el = id => document.getElementById(id);
const rand = max => Math.floor(Math.random() * max); //випадкові числа
const setCss = (elem, styles) => Object.assign(elem.style, styles);
const pad = num => { let s = Math.abs(num).toString(); return s.length === 1 ? "00"+s : (s.length === 2 ? "0"+s : s); };

function msg(txt, emj) { el('status').innerText = txt; el('smiley-btn').innerText = emj; }

function loopGrid(cb) {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) cb(r, c);
    }
}

function forEachNeighbor(r, c, cb) {
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr !== 0 || dc !== 0) cb(r + dr, c + dc);
        }
    }
}

function initGame() {
    let lvl = LEVELS[el('difficulty').value]; 
    ROWS = lvl.r; COLS = lvl.c; MINES = lvl.m; //записуємо значення
    
    X_LABELS = [];
    for (let i = 0; i < COLS; i++) X_LABELS.push("C" + i);
    
    gameOver = false; isFirstClick = true; 
    flagsPlaced = 0; timeElapsed = 0; revealedCount = 0;
    
    clearInterval(timerInterval); msg('Граємо!', '🙂'); //очищуємо старий таймер

    gameState = []; //сітка для сайта
    for (let r = 0; r < ROWS; r++) {
        let row = [];
        for (let c = 0; c < COLS; c++) row.push({ mine: false, count: 0, state: 'hidden' });
        gameState.push(row);
    }
    updateUI();
}

function cellCustomizer(builder, data) {
    let isValid = data && data.type === "value" && data.label && data.label.startsWith("R"); // перевірка на ігрову клітинку
    if (!isValid) return builder.text = ""; 

    let p = data.label.substring(1).split('_C'), r = Number(p[0]), c = Number(p[1]); //координати
    let cell = gameState[r][c], content = "";
    
    if (cell.state === 'flagged') { 
        content = "🚩"; builder.addClass("hidden"); 
    } else if (cell.state === 'revealed') {
        content = cell.mine ? "💣" : (cell.count || ""); builder.addClass(cell.mine ? "mine" : "revealed"); // скан на міни
    } else builder.addClass("hidden"); 
    
    builder.text = `<div class="ms-cell"><span style="display:inline-block; transform: scale(1.666, 0.833); font-size: 20px;">${content}</span></div>`;
}

function renderPivot() {
    let data = [];
    for (let r = 0; r < ROWS; r++) {
        let rowObj = {};
        for (let c = 0; c < COLS; c++) rowObj["C" + c] = "R" + r + "_C" + c;
        data.push(rowObj);
    }

    let config = {
        dataSource: { data: data },
        slice: { columns: X_LABELS.map(col => ({ uniqueName: col })) }, // що вивести на екран
        options: { grid: { type: "flat", showHeaders: false, showGrandTotals: "off", showFilter: false } }, // ховаємо рядки 
        tableSizes: { columns: X_LABELS.map((col, i) => ({ 
            idx: i, tuple: [col], measure: {uniqueName: col}, uniqueName: col, width: 60  //60 пікселів
        }))}
    };

    if (!pivot) {
        pivot = new WebDataRocks({ container: "#wdr-container", toolbar: false, width: 3000, height: 3000, report: config, customizeCell: cellCustomizer });
    } else { 
        pivot.setReport(config); pivot.customizeCell(cellCustomizer); // якщо таблиця створена раніше оновлюємо данні
    }
}

function revealCell(r, c) {  // якщо міни програш якщо немає і пусто сусідні відкриваємо
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    
    let cell = gameState[r][c];
    if (cell.state !== 'hidden') return;
    
    cell.state = 'revealed'; revealedCount++;
    
    if (cell.mine) {
        gameOver = true; clearInterval(timerInterval); msg('Ви програли! 💥', '😵');
        loopGrid((ir, ic) => { if (gameState[ir][ic].mine) gameState[ir][ic].state = 'revealed'; });
        return;
    }
    
    if (cell.count === 0) forEachNeighbor(r, c, (nr, nc) => revealCell(nr, nc));
}

window.handleOverlayClick = e => { // Головний обробник мишки: ловить кліки, ставить прапорці та генерує міни при першому ході
    e.preventDefault();
    if (gameOver) return;
    
    let rect = e.target.getBoundingClientRect();
    let c = Math.floor((e.clientX - rect.left) / 36), r = Math.floor((e.clientY - rect.top) / 36);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;

    let cell = gameState[r][c];
    
    if (e.button === 2) { 
        if (cell.state === 'hidden') { cell.state = 'flagged'; flagsPlaced++; } 
        else if (cell.state === 'flagged') { cell.state = 'hidden'; flagsPlaced--; }
    } else if (e.button === 0 && cell.state !== 'flagged') {
        if (isFirstClick) {
            isFirstClick = false; let placed = 0;
            while (placed < MINES) {
                let mr = rand(ROWS), mc = rand(COLS);
                if (Math.abs(mr - r) <= 1 && Math.abs(mc - c) <= 1) continue;
                if (!gameState[mr][mc].mine) { 
                    gameState[mr][mc].mine = true; placed++; 
                    forEachNeighbor(mr, mc, (nr, nc) => { if (gameState[nr]?.[nc]) gameState[nr][nc].count++; });
                }
            }
            timerInterval = setInterval(() => { timeElapsed++; updateUI(); }, 1000);
        }
        revealCell(r, c);
    }
    
    if (!gameOver && revealedCount === (ROWS * COLS) - MINES) {
        gameOver = true; clearInterval(timerInterval); msg('Ви перемогли! 🎉', '😎');
        loopGrid((ir, ic) => { 
            if (gameState[ir][ic].mine && gameState[ir][ic].state !== 'flagged') { 
                gameState[ir][ic].state = 'flagged'; flagsPlaced++; 
            }
        });
    }

    pivot.refresh(); updateUI();
};

function updateUI() { // Рахує залишок мін, оновлює LED-індикатори та підганяє розміри вікна під екран
    let m = MINES - flagsPlaced;
    el('mine-counter').innerText = m < 0 ? '-' + pad(m) : pad(m);
    el('timer').innerText = pad(Math.min(timeElapsed, 999));

    let gc = el('grid-container'), wc = el('wdr-container'), ov = el('click-overlay');
    if (gc && wc && ov) {
        setCss(gc, { width: (COLS * 36) + "px", height: (ROWS * 36) + "px" }); 
        setCss(ov, { width: (COLS * 36) + "px", height: (ROWS * 36) + "px" });
        setCss(wc, { 
            width: (COLS * 60 + 100) + "px", height: (ROWS * 30 + 100) + "px",
            transformOrigin: "top left", transform: `scale(0.6, 1.2)`, top: `-36px` 
        });
    }
}
 
document.addEventListener('DOMContentLoaded', () => { // Стартер гри: чекає завантаження сайту, створює скляну панель та вішає кліки на кнопки
    let ov = document.createElement('div');
    ov.id = 'click-overlay';
    setCss(ov, { position: 'absolute', top: '0', left: '0', zIndex: '1000' });
    ov.addEventListener('mousedown', window.handleOverlayClick);
    ov.addEventListener('contextmenu', e => e.preventDefault());
    
    el('grid-container').appendChild(ov);
    el('smiley-btn').addEventListener('click', () => { initGame(); renderPivot(); });
    el('difficulty').addEventListener('change', () => { initGame(); renderPivot(); });
    
    initGame(); renderPivot();
});