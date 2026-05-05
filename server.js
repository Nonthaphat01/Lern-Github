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
    // 🀄 ระบบสล็อต MAHJONG (PG Soft Style - อัปเดตแก้บั๊กไลน์จ่าย 100%)
    // ==========================================
    const mjSyms = ['🀄', '🀙', '🀚', '🀐', '🀇', '🀫', '🀅', '🀆'];
    
    socket.on('spinMahjong', (data) => {
        let bet = data.bet;
        let isFS = data.isFS || false;
        
        // โอกาสที่ระบบจะแอบช่วยเสกให้ชนะ
        let isWin = Math.random() < (isFS ? 0.60 : 0.35); 
        let forceWinTarget = isWin ? Math.floor(Math.random() * 4) + 1 : 0; 
        
        let mjCols = [4, 5, 5, 5, 4];
        let mults = isFS ? [2, 4, 6, 10] : [1, 2, 3, 5]; 
        let steps = [];
        let totalPayout = 0;
        let currentMultIdx = 0;
        
        let scCount = 0;
        let scChance = isFS ? 0 : 0.03; 

        // 1. สร้างกระดานเริ่มต้นแบบสุ่มทั้งหมด
        let currentGrid = [];
        for (let c = 0; c < 5; c++) {
            let col = [];
            for (let r = 0; r < mjCols[c]; r++) {
                let isGoldZone = (c >= 1 && c <= 3); 
                let sym = mjSyms[Math.floor(Math.random() * mjSyms.length)];
                if (!isFS && Math.random() < scChance && scCount < 4) { sym = '🧧'; scCount++; }
                col.push({ sym: sym, gold: (isGoldZone && Math.random() < 0.35 && sym !== '🧧'), wild: false });
            }
            currentGrid.push(col);
        }

        // แจ็คพอตเข้าฟรีสปิน (ถ้ากดซื้อ หรือฟลุ๊คเข้า)
        if (!isFS && (Math.random() < 0.015 || data.buyFS)) {
            scCount = 3;
            currentGrid[0][0] = {sym: '🧧', gold: false, wild: false};
            currentGrid[2][0] = {sym: '🧧', gold: false, wild: false};
            currentGrid[4][0] = {sym: '🧧', gold: false, wild: false};
        }

        let currentCascade = 0;
        while(true) { // 🌟 ไหลไปเรื่อยๆ จนกว่าภาพจะไม่ตรงกัน
            let stepObj = { grid: JSON.parse(JSON.stringify(currentGrid)), payout: 0, mult: mults[currentMultIdx] };
            
            // ถ้าระบบอยากจะช่วยให้ชนะในเทิร์นนี้ จะเสกสัญลักษณ์ให้ตรงกัน
            if (currentCascade < forceWinTarget) {
                let winSym = mjSyms[Math.floor(Math.random() * mjSyms.length)];
                if(winSym === '🧧') winSym = mjSyms[0]; // ป้องกันเสกสแกตเตอร์
                let winLen = Math.random() < 0.2 ? 5 : (Math.random() < 0.5 ? 4 : 3);
                for(let c=0; c<winLen; c++) {
                    let r = Math.floor(Math.random() * mjCols[c]);
                    stepObj.grid[c][r].sym = winSym;
                    stepObj.grid[c][r].wild = false;
                }
            }

            // 🌟 2. คำนวณการชนะจากภาพที่เห็นตรงหน้า (ตรงกับที่ผู้เล่นเห็น 100%) 🌟
            let winningCells = Array(5).fill(0).map((_, i) => Array(mjCols[i]).fill(false));
            let stepPayout = 0;
            let hasWin = false;

            mjSyms.forEach(sym => {
                if (sym === '🧧') return; // สแกตเตอร์ไม่นับวิธีชนะปกติ
                
                let m = 0; let ways = 1; let winReels = [];
                for(let c = 0; c < 5; c++) {
                    let countInCol = 0; let matchedIndices = [];
                    for(let r = 0; r < mjCols[c]; r++) {
                        let cellSym = stepObj.grid[c][r].sym;
                        if(cellSym === sym || cellSym === 'WILD' || stepObj.grid[c][r].wild) {
                            countInCol++; matchedIndices.push(r);
                        }
                    }
                    if(countInCol > 0) { m++; ways *= countInCol; winReels.push(matchedIndices); } 
                    else { break; } // ขาดตอนเมื่อไหร่ ไลน์จ่ายหยุดทันที
                }
                
                if (m >= 3) { // เรียง 3 คอลัมน์ขึ้นไปจากซ้ายถึงจะชนะ
                    hasWin = true;
                    let pt = {3: 0.5, 4: 1, 5: 2};
                    let baseWin = pt[m] * bet;
                    stepPayout += baseWin * ways * mults[currentMultIdx];
                    for(let c = 0; c < m; c++) {
                        winReels[c].forEach(r => { winningCells[c][r] = true; });
                    }
                }
            });

            // 🌟 ถ้าตารางมีไลน์ชนะ (ไม่ว่าจะฟลุ๊คตกมาตรงเอง หรือระบบช่วย) ต้องจ่ายเงินเสมอ! 🌟
            if (hasWin) {
                stepObj.payout = Math.floor(stepPayout) || Math.floor(bet * 0.5);
                totalPayout += stepObj.payout;
                
                let explodedAny = false;
                for(let c = 0; c < 5; c++) {
                    for(let r = 0; r < mjCols[c]; r++) {
                        if(winningCells[c][r]) { // ระเบิดแค่ช่องที่ได้เงินเป๊ะๆ
                            stepObj.grid[c][r].explode = true;
                            explodedAny = true;
                        }
                    }
                }
                
                steps.push(stepObj);

                // 3. สร้างกระดานใหม่ ทับช่องที่ระเบิดให้ของร่วงลงมาแบบฟิสิกส์
                let nextGrid = [];
                for(let c=0; c<5; c++) {
                    let newCol = []; let explodeCount = 0;
                    for(let r=0; r<mjCols[c]; r++) {
                        let cell = stepObj.grid[c][r];
                        if(cell.explode) {
                            if(cell.gold) {
                                newCol.push({sym: 'WILD', gold: false, wild: true, isNew: false}); // กรอบทองแตกเปลี่ยนเป็น Wild
                            } else {
                                explodeCount++;
                            }
                        } else {
                            newCol.push({sym: cell.sym, gold: cell.gold, wild: cell.wild, isNew: false});
                        }
                    }
                    
                    let isGoldZone = (c >= 1 && c <= 3);
                    for(let i=0; i<explodeCount; i++) {
                        newCol.unshift({
                            sym: mjSyms[Math.floor(Math.random() * mjSyms.length)], 
                            gold: (isGoldZone && Math.random() < 0.35), 
                            wild: false, 
                            isNew: true
                        });
                    }
                    nextGrid.push(newCol);
                }
                currentGrid = nextGrid;
                if(currentMultIdx < 3) currentMultIdx++;
                currentCascade++;
                
                if(currentCascade > 15) break; // กันระบบแตกไม่หยุดทะลุจอ
            } else {
                // ถ้าไม่มีไลน์ชนะ ก็จบเทิร์น ส่งภาพกลับไปโชว์!
                stepObj.payout = 0;
                for(let c=0;c<5;c++) for(let r=0;r<mjCols[c];r++) stepObj.grid[c][r].explode = false;
                steps.push(stepObj);
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
