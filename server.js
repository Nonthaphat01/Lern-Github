const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/', (req, res) => {
    res.send('<h1 style="color:green; text-align:center;">✅ Game Server & Slot RNG is Online!</h1>');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const rooms = {};

const mjSyms = ['🀄', '🀙', '🀚', '🀐', '🀇', '🀫', '🀅', '🀆'];
const mwSyms = ['s1','s2','s3','s4','s5','s6','s7'];

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // ==========================================
    // 🧟 ระบบเกมซอมบี้
    // ==========================================
    socket.on('joinRoom', (data) => {
        const roomName = data.roomName;
        socket.join(roomName);
        if (!rooms[roomName]) rooms[roomName] = { host: socket.id, state: 'waiting', players: {} };
        rooms[roomName].players[socket.id] = { name: data.playerName, id: socket.id };
        
        if (rooms[roomName].state === 'playing') {
            socket.emit('gameStarted', { host: rooms[roomName].host });
        } else {
            io.to(roomName).emit('roomUpdated', { host: rooms[roomName].host, players: Object.values(rooms[roomName].players) });
        }
    });

    socket.on('startGame', (roomName) => {
        if (rooms[roomName] && rooms[roomName].host === socket.id) {
            rooms[roomName].state = 'playing';
            io.to(roomName).emit('gameStarted', { host: rooms[roomName].host });
        }
    });

    socket.on('updatePlayer', (data) => {
        if (rooms[data.room] && rooms[data.room].state === 'playing') {
            socket.to(data.room).emit('updateOthers', { id: socket.id, ...data });
        }
    });

    socket.on('syncZombies', (data) => {
        if (rooms[data.room] && rooms[data.room].host === socket.id) {
            socket.to(data.room).emit('syncZombies', { zombies: data.zombies, enemyBullets: data.enemyBullets });
        }
    });

    socket.on('damageZombie', (data) => {
        if (rooms[data.room]) io.to(rooms[data.room].host).emit('zombieDamaged', data);
    });

// ==========================================
    // 🀄 ระบบสล็อต MAHJONG (แก้ไขระบบ Cascade สมจริง 100%)
    // ==========================================
    const mjSyms = ['🀄', '🀙', '🀚', '🀐', '🀇', '🀫', '🀅', '🀆'];
    
    socket.on('spinMahjong', (data) => {
        let bet = data.bet;
        let isFS = data.isFS || false;
        
        let isWin = Math.random() < (isFS ? 0.60 : 0.35); 
        let forceWinTarget = isWin ? Math.floor(Math.random() * 4) + 1 : 0; 
        
        let mjCols = [4, 5, 5, 5, 4];
        let mults = isFS ? [2, 4, 6, 10] : [1, 2, 3, 5]; 
        let steps = [];
        let totalPayout = 0;
        let currentMultIdx = 0;
        
        let scCount = 0;
        let scChance = isFS ? 0 : 0.03; 

        // 1. สร้างตารางเริ่มต้น
        let currentGrid = [];
        for (let c = 0; c < 5; c++) {
            let col = [];
            for (let r = 0; r < mjCols[c]; r++) {
                let isGoldZone = (c >= 1 && c <= 3); 
                let sym = mjSyms[Math.floor(Math.random() * mjSyms.length)];
                if (!isFS && Math.random() < scChance && scCount < 4) { sym = '🧧'; scCount++; }
                // isNew = ลงมาจากฟ้า
                col.push({ sym: sym, gold: (isGoldZone && Math.random() < 0.35 && sym !== '🧧'), wild: false, isNew: true, isFall: false });
            }
            currentGrid.push(col);
        }

        if (!isFS && (Math.random() < 0.015 || data.buyFS)) {
            scCount = 3;
            currentGrid[0][0] = {sym: '🧧', gold: false, wild: false, isNew: true, isFall: false};
            currentGrid[2][0] = {sym: '🧧', gold: false, wild: false, isNew: true, isFall: false};
            currentGrid[4][0] = {sym: '🧧', gold: false, wild: false, isNew: true, isFall: false};
        }

        let currentCascade = 0;
        while(currentCascade <= 15) { 
            
            if (currentCascade === 0 && forceWinTarget > 0) {
                let winSym = mjSyms[Math.floor(Math.random() * mjSyms.length)];
                if(winSym === '🧧') winSym = mjSyms[0]; 
                let winLen = Math.random() < 0.2 ? 5 : (Math.random() < 0.5 ? 4 : 3);
                for(let c=0; c<winLen; c++) {
                    let r = Math.floor(Math.random() * mjCols[c]);
                    currentGrid[c][r].sym = winSym;
                    currentGrid[c][r].wild = false;
                }
            }

            // 🌟 STEP A: จังหวะของร่วงหล่นลงมาแตะพื้น (รอให้คนดูเห็นภาพก่อน)
            let dropStep = { grid: JSON.parse(JSON.stringify(currentGrid)), payout: 0, mult: mults[currentMultIdx], action: 'drop' };

            let winningCells = Array(5).fill(0).map((_, i) => Array(mjCols[i]).fill(false));
            let stepPayout = 0;
            let hasWin = false;

            // ค้นหาไลน์จ่ายเงิน
            mjSyms.forEach(sym => {
                if (sym === '🧧') return; 
                let m = 0; let ways = 1; let winReels = [];
                for(let c = 0; c < 5; c++) {
                    let countInCol = 0; let matchedIndices = [];
                    for(let r = 0; r < mjCols[c]; r++) {
                        let cellSym = dropStep.grid[c][r].sym;
                        if(cellSym === sym || cellSym === 'WILD' || dropStep.grid[c][r].wild) {
                            countInCol++; matchedIndices.push(r);
                        }
                    }
                    if(countInCol > 0) { m++; ways *= countInCol; winReels.push(matchedIndices); } 
                    else { break; } 
                }
                if (m >= 3) { 
                    hasWin = true;
                    let pt = {3: 0.5, 4: 1, 5: 2};
                    let baseWin = pt[m] * bet;
                    stepPayout += baseWin * ways * dropStep.mult; 
                    for(let c = 0; c < m; c++) {
                        winReels[c].forEach(r => { winningCells[c][r] = true; });
                    }
                }
            });

            if (hasWin) {
                steps.push(dropStep); // ปล่อยภาพร่วงลงมาโชว์ก่อน

                // 🌟 STEP B: จังหวะระเบิดและจ่ายเงิน
                let explodeStep = { grid: JSON.parse(JSON.stringify(dropStep.grid)), payout: Math.floor(stepPayout) || Math.floor(bet * 0.5), mult: mults[currentMultIdx], action: 'explode' };
                totalPayout += explodeStep.payout;
                
                for(let c = 0; c < 5; c++) {
                    for(let r = 0; r < mjCols[c]; r++) {
                        if(winningCells[c][r]) { explodeStep.grid[c][r].explode = true; }
                    }
                }
                steps.push(explodeStep);

                // คำนวณตารางใหม่แบบฟิสิกส์PG
                let nextGrid = [];
                for(let c=0; c<5; c++) {
                    let newCol = []; 
                    let explodeCount = 0;
                    
                    // หาตัวที่รอดจากการระเบิด
                    let survivors = [];
                    for(let r=0; r<mjCols[c]; r++) {
                        let cell = explodeStep.grid[c][r];
                        if(cell.explode) {
                            if(cell.gold) survivors.push({sym: 'WILD', gold: false, wild: true, oldR: r, isWildReveal: true});
                            else explodeCount++;
                        } else {
                            survivors.push({sym: cell.sym, gold: cell.gold, wild: cell.wild, oldR: r});
                        }
                    }
                    
                    let isGoldZone = (c >= 1 && c <= 3);
                    // ตัวใหม่ลงจากฟ้า
                    for(let i=0; i<explodeCount; i++) {
                        newCol.push({
                            sym: mjSyms[Math.floor(Math.random() * mjSyms.length)], 
                            gold: (isGoldZone && Math.random() < 0.35), 
                            wild: false, isNew: true, isFall: false 
                        });
                    }
                    
                    // ตัวเก่าที่รอดชีวิต ถ้าตำแหน่งเดิมเปลี่ยน = isFall (หล่นลงมาทับที่ว่าง)
                    for(let i=0; i<survivors.length; i++) {
                        let newR = explodeCount + i;
                        let oldR = survivors[i].oldR;
                        let isFall = (newR > oldR); 
                        newCol.push({
                            sym: survivors[i].sym, gold: survivors[i].gold, wild: survivors[i].wild,
                            isNew: false, isFall: isFall, isWildReveal: survivors[i].isWildReveal || false
                        });
                    }
                    nextGrid.push(newCol);
                }
                currentGrid = nextGrid;
                if(currentMultIdx < 3) currentMultIdx++;
                currentCascade++;
            } else {
                steps.push(dropStep); // ไม่มีเงิน จบที่ภาพร่วงลงมาปกติ
                break;
            }
        }
        
        socket.emit('mahjongResult', { success: true, steps: steps, totalPayout: totalPayout, isFreeSpin: (scCount >= 3) });
    });

    // ==========================================
    // 🎰 ระบบสล็อต MEGAWAYS
    // ==========================================
    socket.on('spinMegaways', (data) => {
        let bet = data.bet;
        let isFS = data.isFS;
        let accMult = data.accMult;
        
        let isWin = Math.random() < 0.40; 
        let scChance = isFS ? 0 : 0.03; 
        
        let reels = []; let scCount = 0; let ways = 1;
        
        for (let c=0; c<6; c++) {
            let num = Math.floor(Math.random() * 5) + 3; ways *= num;
            let col = [];
            for (let r=0; r<num; r++) {
                if (Math.random() < scChance && scCount < 5) { col.push('sc'); scCount++; } 
                else col.push(mwSyms[Math.floor(Math.random()*mwSyms.length)]);
            }
            reels.push(col);
        }

        if (isWin) {
            let winSym = mwSyms[Math.floor(Math.random()*mwSyms.length)];
            let len = Math.floor(Math.random() * 3) + 3; 
            for (let c=0; c<len; c++) reels[c][0] = winSym;
        }

        let roundMult = isWin ? (Math.random() * 5 + 1) : 0;
        let finalMult = roundMult;
        let newAcc = accMult;
        
        if (isFS) {
            if (roundMult > 0) newAcc += roundMult;
            finalMult = newAcc;
        }

        let payout = isWin ? Math.floor(bet * (Math.random() * 2 + 0.5) * (finalMult > 0 ? finalMult : 1)) : 0;

        socket.emit('megawaysResult', { 
            success: true, 
            result: { reels: reels, ways: ways, isFreeSpin: (scCount >= 4) }, 
            payout: payout, 
            multiplier: finalMult, 
            roundMultiplier: roundMult, 
            newAccumulatedMult: newAcc 
        });
    });

    socket.on('disconnect', () => {
        // ... โค้ดเดิม
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Server is running on port ${PORT}`); });
