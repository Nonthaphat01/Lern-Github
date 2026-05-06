const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// 🛡️ ระบบอมตะ (Crash-Proof)
process.on('uncaughtException', (err) => { console.error('เจอ Error (แต่ไม่ดับ):', err); });
process.on('unhandledRejection', (reason, promise) => { console.error('เจอ Rejection (แต่ไม่ดับ):', reason); });

const app = express();
app.use(cors());

app.get('/', (req, res) => {
    res.send('<h1 style="color:green; text-align:center;">✅ Game Server is Online (True Multiplayer Stable Mode 🚀)</h1>');
});

const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*", methods: ["GET", "POST"] },
    allowEIO3: true
});

const rooms = {};

const mjSyms = ['🀄', '🀙', '🀚', '🀐', '🀇', '🀫', '🀅', '🀆'];
const mwSyms = ['s1','s2','s3','s4','s5','s6','s7'];
const plMults = [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.5, 1, 1.5, 3, 5, 10, 41, 110]; 
const plChancesNormal = [0.05, 0.1, 0.2, 0.5, 1.5, 4, 10, 33.65, 33.65, 10, 4, 1.5, 0.5, 0.2, 0.1, 0.05];

let onlineCount = 0;
let chatHistory = [];

io.on('connection', (socket) => {
    onlineCount++;
    io.emit('onlineUpdate', onlineCount); 
    socket.emit('chatHistory', chatHistory); 

    socket.on('sendChat', (data) => {
        try {
            const msgObj = { u: data.user, msg: data.msg };
            chatHistory.push(msgObj);
            if(chatHistory.length > 50) chatHistory.shift(); 
            io.emit('newChatMessage', msgObj); 
        } catch (e) { console.error(e); }
    });

    // ==========================================
    // 🧟 ZOMBIE DEFENSE (Stable Sync Mode)
    // ==========================================
    socket.on('requestRooms', () => {
        try {
            let activeRooms = [];
            for(let r in rooms) {
                if(!r.startsWith('SOLO_') && (rooms[r].state === 'waiting' || rooms[r].state === 'playing')) {
                    activeRooms.push({ name: r, players: Object.keys(rooms[r].players).length });
                }
            }
            socket.emit('activeRoomsList', activeRooms);
        } catch (e) { console.error(e); }
    });

    socket.on('joinRoom', (data) => {
        try {
            const roomName = data.roomName;
            socket.join(roomName);
            if (!rooms[roomName]) rooms[roomName] = { host: socket.id, state: 'waiting', players: {}, bunkers: null };
            rooms[roomName].players[socket.id] = { name: data.playerName, id: socket.id };
            
            io.to(roomName).emit('roomUpdated', { 
                host: rooms[roomName].host, 
                players: Object.values(rooms[roomName].players),
                state: rooms[roomName].state 
            });
        } catch (e) { console.error(e); }
    });

    socket.on('startGame', (roomName) => { 
        try {
            if (rooms[roomName] && rooms[roomName].host === socket.id) { 
                rooms[roomName].state = 'playing'; 
                io.to(roomName).emit('gameStarted', { host: rooms[roomName].host }); 
            } 
        } catch (e) { console.error(e); }
    });

    socket.on('syncMap', (data) => {
        if(data && data.room) {
            if (rooms[data.room]) rooms[data.room].bunkers = data.bunkers;
            socket.to(data.room).emit('syncMap', data.bunkers);
        }
    });

    socket.on('requestMap', (roomName) => {
        if(rooms[roomName] && rooms[roomName].bunkers) {
            socket.emit('syncMap', rooms[roomName].bunkers); 
        }
    });

    // 🔫 ส่งกระสุนและอาวุธแบบเสถียร
    socket.on('playerShoot', (data) => {
        if (data && data.room) {
            socket.to(data.room).emit('otherShoot', { id: socket.id, ...data });
        }
    });

    // 💬 สติ๊กเกอร์
    socket.on('sendSticker', (data) => {
        if (data && data.room) {
            io.to(data.room).emit('playerSticker', { id: socket.id, sticker: data.sticker });
        }
    });

    // 🚀 ส่งข้อมูลพิกัด 
    socket.on('updatePlayer', (data) => { 
        if (data && data.room && rooms[data.room] && rooms[data.room].state === 'playing') {
            socket.to(data.room).emit('updateOthers', { id: socket.id, ...data }); 
        }
    });

    socket.on('syncZombies', (data) => { 
        if (data && data.room) {
            socket.to(data.room).emit('syncZombies', data); 
        }
    });

    socket.on('damageZombie', (data) => { 
        if (data && data.room && rooms[data.room]) {
            io.to(rooms[data.room].host).emit('zombieDamaged', data); 
        }
    });

    // ==========================================
    // 🀄 MAHJONG & MEGAWAYS & PLINKO
    // ==========================================
    socket.on('spinMahjong', (data) => {
        try {
            let bet = data.bet; let isFS = data.isFS || false; let diff = data.difficulty || "Normal"; 
            let winProb = 0.45, fsWinProb = 0.65, scChance = 0.03;
            if(diff === "Very Easy") { winProb = 0.80; fsWinProb = 0.90; scChance = 0.08; }
            else if(diff === "Easy") { winProb = 0.60; fsWinProb = 0.75; scChance = 0.05; }
            else if(diff === "Hard") { winProb = 0.20; fsWinProb = 0.40; scChance = 0.01; }
            else if(diff === "Super Hard") { winProb = 0.05; fsWinProb = 0.15; scChance = 0.005; }

            let isWin = Math.random() < (isFS ? fsWinProb : winProb); 
            let forceWinTarget = isWin ? Math.floor(Math.random() * 4) + 1 : 0; 
            let mjCols = [4, 5, 5, 5, 4]; let mults = isFS ? [2, 4, 6, 10] : [1, 2, 3, 5]; 
            let steps = []; let totalPayout = 0; let currentMultIdx = 0; let scCount = 0; scChance = isFS ? 0 : scChance; 

            let currentGrid = [];
            for (let c = 0; c < 5; c++) {
                let col = [];
                for (let r = 0; r < mjCols[c]; r++) {
                    let isGoldZone = (c >= 1 && c <= 3); 
                    let sym = mjSyms[Math.floor(Math.random() * mjSyms.length)];
                    if (!isFS && Math.random() < scChance && scCount < 4) { sym = '🧧'; scCount++; }
                    col.push({ sym: sym, gold: (isGoldZone && Math.random() < 0.35 && sym !== '🧧'), wild: false, isNew: true, isFall: false, dropDist: mjCols[c] });
                }
                currentGrid.push(col);
            }

            if (!isFS && (Math.random() < (scChance/2) || data.buyFS)) {
                scCount = 3;
                currentGrid[0][0] = {sym: '🧧', gold: false, wild: false, isNew: true, isFall: false, dropDist: mjCols[0]};
                currentGrid[2][0] = {sym: '🧧', gold: false, wild: false, isNew: true, isFall: false, dropDist: mjCols[2]};
                currentGrid[4][0] = {sym: '🧧', gold: false, wild: false, isNew: true, isFall: false, dropDist: mjCols[4]};
            }

            let currentCascade = 0;
            while(currentCascade <= 15) { 
                if (currentCascade === 0) {
                    if (forceWinTarget > 0) {
                        let winSym = mjSyms[Math.floor(Math.random() * mjSyms.length)];
                        if(winSym === '🧧') winSym = mjSyms[0]; 
                        let winLen = Math.random() < 0.2 ? 5 : (Math.random() < 0.5 ? 4 : 3);
                        for(let c=0; c<winLen; c++) {
                            let numSyms = Math.floor(Math.random() * 3) + 1; numSyms = Math.min(numSyms, mjCols[c]);
                            let rows = [0,1,2,3,4].slice(0, mjCols[c]).sort(()=>Math.random()-0.5);
                            for(let i=0; i<numSyms; i++) { currentGrid[c][rows[i]].sym = winSym; currentGrid[c][rows[i]].wild = false; }
                        }
                    } else if (!isWin) {
                        let col0 = currentGrid[0].map(c => c.sym); let col1 = currentGrid[1].map(c => c.sym);
                        let common = col0.filter(s => col1.includes(s) && s !== '🧧');
                        if (common.length > 0) {
                            for (let r=0; r < mjCols[2]; r++) {
                                if (common.includes(currentGrid[2][r].sym)) {
                                    let safeSyms = mjSyms.filter(s => !common.includes(s) && s !== '🧧');
                                    currentGrid[2][r].sym = safeSyms[Math.floor(Math.random() * safeSyms.length)];
                                }
                            }
                        }
                    }
                }

                let dropStep = { grid: JSON.parse(JSON.stringify(currentGrid)), payout: 0, mult: mults[currentMultIdx], action: 'drop' };
                let winningCells = Array(5).fill(0).map((_, i) => Array(mjCols[i]).fill(false));
                let stepPayout = 0; let hasWin = false;

                mjSyms.forEach(sym => {
                    if (sym === '🧧') return; 
                    let m = 0; let ways = 1; let winReels = [];
                    for(let c = 0; c < 5; c++) {
                        let countInCol = 0; let matchedIndices = [];
                        for(let r = 0; r < mjCols[c]; r++) {
                            let cellSym = dropStep.grid[c][r].sym;
                            if(cellSym === sym || cellSym === 'WILD' || dropStep.grid[c][r].wild) { countInCol++; matchedIndices.push(r); }
                        }
                        if(countInCol > 0) { m++; ways *= countInCol; winReels.push(matchedIndices); } else { break; } 
                    }
                    if (m >= 3) { 
                        hasWin = true; let pt = {3: 0.5, 4: 1, 5: 2}; let baseWin = pt[m] * bet;
                        stepPayout += baseWin * ways * dropStep.mult; 
                        for(let c = 0; c < m; c++) { winReels[c].forEach(r => { winningCells[c][r] = true; }); }
                    }
                });

                if (hasWin) {
                    steps.push(dropStep); 
                    let explodeStep = { grid: JSON.parse(JSON.stringify(dropStep.grid)), payout: Math.floor(stepPayout) || Math.floor(bet * 0.5), mult: mults[currentMultIdx], action: 'explode' };
                    totalPayout += explodeStep.payout;
                    for(let c = 0; c < 5; c++) { for(let r = 0; r < mjCols[c]; r++) { if(winningCells[c][r]) { explodeStep.grid[c][r].explode = true; } } }
                    steps.push(explodeStep);

                    let nextGrid = [];
                    for(let c=0; c<5; c++) {
                        let newCol = []; let explodeCount = 0; let survivors = [];
                        for(let r=0; r<mjCols[c]; r++) {
                            let cell = explodeStep.grid[c][r];
                            if(cell.explode) { if(cell.gold) survivors.push({sym: 'WILD', gold: false, wild: true, oldR: r}); else explodeCount++; } 
                            else { survivors.push({sym: cell.sym, gold: cell.gold, wild: cell.wild, oldR: r}); }
                        }
                        let isGoldZone = (c >= 1 && c <= 3);
                        for(let i=0; i<explodeCount; i++) { newCol.push({ sym: mjSyms[Math.floor(Math.random() * mjSyms.length)], gold: (isGoldZone && Math.random() < 0.35), wild: false, isNew: true, isFall: false, dropDist: mjCols[c] }); }
                        for(let i=0; i<survivors.length; i++) { let newR = explodeCount + i; let dropDist = newR - survivors[i].oldR; newCol.push({ sym: survivors[i].sym, gold: survivors[i].gold, wild: survivors[i].wild, isNew: false, isFall: (dropDist > 0), dropDist: dropDist }); }
                        nextGrid.push(newCol);
                    }
                    currentGrid = nextGrid; if(currentMultIdx < 3) currentMultIdx++; currentCascade++;
                } else { steps.push(dropStep); break; }
            }
            socket.emit('mahjongResult', { success: true, steps: steps, totalPayout: totalPayout, isFreeSpin: (scCount >= 3) });
        } catch (e) { console.error(e); socket.emit('mahjongResult', { error: "Server Error" }); }
    });

    socket.on('spinMegaways', (data) => {
        try {
            let bet = data.bet; let isFS = data.isFS; let accMult = data.accMult;
            let diff = data.difficulty || "Normal"; 
            
            let winProb = 0.40, scChanceBase = 0.03;
            if(diff === "Very Easy") { winProb = 0.80; scChanceBase = 0.08; }
            else if(diff === "Easy") { winProb = 0.60; scChanceBase = 0.05; }
            else if(diff === "Hard") { winProb = 0.20; scChanceBase = 0.01; }
            else if(diff === "Super Hard") { winProb = 0.05; scChanceBase = 0.005; }

            let isWin = Math.random() < winProb; let scChance = isFS ? 0 : scChanceBase; 
            let reels = []; let scCount = 0; let ways = 1;
            for (let c=0; c<6; c++) {
                let num = Math.floor(Math.random() * 5) + 3; ways *= num;
                let col = [];
                for (let r=0; r<num; r++) { if (Math.random() < scChance && scCount < 5) { col.push('sc'); scCount++; } else col.push(mwSyms[Math.floor(Math.random()*mwSyms.length)]); }
                reels.push(col);
            }

            if (isWin) {
                let winSym = mwSyms[Math.floor(Math.random()*mwSyms.length)];
                let len = Math.floor(Math.random() * 3) + 3; 
                for (let c=0; c<len; c++) reels[c][0] = winSym;
            } else {
                let col0 = reels[0]; let col1 = reels[1]; let common = col0.filter(s => col1.includes(s) && s !== 'sc');
                if (common.length > 0) {
                    for(let r=0; r<reels[2].length; r++) {
                        if (common.includes(reels[2][r])) {
                            let safeSyms = mwSyms.filter(s => !common.includes(s) && s !== 'sc');
                            reels[2][r] = safeSyms[Math.floor(Math.random() * safeSyms.length)];
                        }
                    }
                }
            }

            let roundMult = isWin ? (Math.random() * 5 + 1) : 0;
            let finalMult = roundMult; let newAcc = accMult;
            if (isFS) { if (roundMult > 0) newAcc += roundMult; finalMult = newAcc; }
            let payout = isWin ? Math.floor(bet * (Math.random() * 2 + 0.5) * (finalMult > 0 ? finalMult : 1)) : 0;
            socket.emit('megawaysResult', { success: true, result: { reels: reels, ways: ways, isFreeSpin: (scCount >= 4) }, payout: payout, multiplier: finalMult, roundMultiplier: roundMult, newAccumulatedMult: newAcc });
        } catch (e) { console.error(e); socket.emit('megawaysResult', { error: "Server Error" }); }
    });

    socket.on('dropPlinko', (data) => {
        try {
            let count = data.count; let bet = data.bet; let diff = data.difficulty || "Normal"; 
            let activeChances = plChancesNormal;
            if(diff === "Very Easy") activeChances = [2, 3, 4, 5, 6, 8, 10, 12, 12, 10, 8, 6, 5, 4, 3, 2]; 
            else if(diff === "Easy") activeChances = [0.5, 1, 2, 4, 5, 8, 10, 19.5, 19.5, 10, 8, 5, 4, 2, 1, 0.5];
            else if(diff === "Hard") activeChances = [0.01, 0.02, 0.05, 0.1, 0.5, 2, 5, 42.32, 42.32, 5, 2, 0.5, 0.1, 0.05, 0.02, 0.01]; 
            else if(diff === "Super Hard") activeChances = [0.001, 0.005, 0.01, 0.05, 0.1, 1, 2, 46.834, 46.834, 2, 1, 0.1, 0.05, 0.01, 0.005, 0.001];

            let results = []; let totalPayout = 0;
            for(let i=0; i<count; i++) {
                let sum = activeChances.reduce((a, b) => a + b, 0); 
                let r = Math.random() * sum; let bin = 0; let current = 0; 
                for (let j = 0; j < 16; j++) { current += activeChances[j]; if (r <= current) { bin = j; break; } } 
                let payout = bet * plMults[bin]; totalPayout += payout; 
                results.push({ bin: bin, multiplier: plMults[bin], payout: payout }); 
            }
            socket.emit('plinkoResult', { success: true, results: results, totalPayout: totalPayout });
        } catch (e) { console.error(e); }
    });

    socket.on('disconnect', () => {
        try {
            onlineCount--;
            io.emit('onlineUpdate', onlineCount);
            for (let roomName in rooms) {
                if (rooms[roomName].players[socket.id]) {
                    delete rooms[roomName].players[socket.id];
                    if (Object.keys(rooms[roomName].players).length === 0) { delete rooms[roomName]; } 
                    else { io.to(roomName).emit('roomUpdated', { host: rooms[roomName].host, players: Object.values(rooms[roomName].players), state: rooms[roomName].state }); }
                }
            }
        } catch (e) { console.error(e); }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`🚀 Game Server is running on port ${PORT}`); });
