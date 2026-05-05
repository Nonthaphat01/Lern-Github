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

// 🌟 ระบบสุ่มสล็อตความเร็วแสง (Fast RNG Engine) 🌟
const mjSyms = ['🀄', '🀙', '🀚', '🀐', '🀇', '🀫', '🀅', '🀆'];
const mwSyms = ['s1','s2','s3','s4','s5','s6','s7'];

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // ==========================================
    // 🧟 ระบบเกมซอมบี้ (ของเดิม)
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
    // 🀄 ระบบสล็อต MAHJONG (สุ่มจากฝั่ง Server ทันที)
    // ==========================================
    socket.on('spinMahjong', (data) => {
        let bet = data.bet;
        let isWin = Math.random() < 0.45; // โอกาสชนะ 45% (ปรับได้)
        let cascades = isWin ? Math.floor(Math.random() * 3) + 1 : 0;
        
        let mjCols = [4, 5, 5, 5, 4];
        let mults = [1, 2, 3, 5];
        let steps = [];
        let totalPayout = 0;
        let currentMultIdx = 0;
        let currentGrid = [];

        // จำลองกระดานเริ่มต้น
        for (let c = 0; c < 5; c++) {
            let col = [];
            for (let r = 0; r < mjCols[c]; r++) {
                col.push({ sym: mjSyms[Math.floor(Math.random() * mjSyms.length)], gold: ((c==1||c==3) && Math.random()<0.25) });
            }
            currentGrid.push(col);
        }

        for(let stepCount = 0; stepCount <= cascades; stepCount++) {
            let stepObj = { grid: JSON.parse(JSON.stringify(currentGrid)), payout: 0, mult: mults[currentMultIdx] };
            if (stepCount < cascades) {
                let winPayout = Math.floor(bet * (Math.random() * 1.5 + 0.5) * stepObj.mult);
                stepObj.payout = winPayout;
                totalPayout += winPayout;
                for(let c=0; c<=2; c++) stepObj.grid[c][0].explode = true; // จำลองช่องระเบิด
                steps.push(stepObj);

                let nextGrid = [];
                for(let c=0; c<5; c++) {
                    let newCol = []; let explodeCount = 0;
                    for(let r=0; r<mjCols[c]; r++) {
                        let cell = stepObj.grid[c][r];
                        if(cell.explode) {
                            if(cell.gold) newCol.push({sym: '💰', gold: false, wild: true, isNew: false});
                            else explodeCount++;
                        } else {
                            newCol.push({sym: cell.sym, gold: cell.gold, wild: cell.wild, isNew: false});
                        }
                    }
                    for(let i=0; i<explodeCount; i++) newCol.unshift({sym: mjSyms[Math.floor(Math.random() * mjSyms.length)], gold: ((c==1||c==3) && Math.random()<0.25), wild: false, isNew: true});
                    nextGrid.push(newCol);
                }
                currentGrid = nextGrid;
                if(currentMultIdx < 3) currentMultIdx++;
            } else {
                stepObj.payout = 0; steps.push(stepObj);
            }
        }
        // ส่งผลลัพธ์กลับไปที่หน้าเว็บทันที (ใช้เวลาไม่ถึง 0.05 วินาที)
        socket.emit('mahjongResult', { success: true, steps: steps, totalPayout: totalPayout });
    });

    // ==========================================
    // 🎰 ระบบสล็อต MEGAWAYS
    // ==========================================
    socket.on('spinMegaways', (data) => {
        let bet = data.bet;
        let isFS = data.isFS;
        let accMult = data.accMult;
        
        let isWin = Math.random() < 0.40; // โอกาสชนะ
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
            let len = Math.floor(Math.random() * 3) + 3; // แตก 3-5 แถว
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
        // ... (โค้ดลบห้องเดิมของซอมบี้ ปล่อยไว้เหมือนเดิมได้เลยครับ)
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Server is running on port ${PORT}`); });
