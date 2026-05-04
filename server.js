const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/', (req, res) => {
    res.send('<h1 style="color:green; font-family:sans-serif; text-align:center; margin-top:50px;">✅ Zombie Server is Online and Ready!</h1>');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// เก็บข้อมูลห้องทั้งหมด
const rooms = {}; 

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // เมื่อผู้เล่นเข้าห้อง
    socket.on('joinRoom', (data) => {
        const roomName = data.roomName;
        const playerName = data.playerName;
        
        socket.join(roomName);
        
        // ถ้าห้องยังไม่มี ให้สร้างใหม่และตั้งคนแรกเป็น Host
        if (!rooms[roomName]) {
            rooms[roomName] = { host: socket.id, state: 'waiting', players: {} };
        }
        
        // เพิ่มผู้เล่นเข้าห้อง
        rooms[roomName].players[socket.id] = { name: playerName, id: socket.id };
        
        if (rooms[roomName].state === 'playing') {
            // ถ้าเกมเริ่มไปแล้ว ให้คนที่เข้ามาทีหลังเข้าเกมเลย
            socket.emit('gameStarted');
        } else {
            // ถ้ายังไม่เริ่ม ให้อัปเดตหน้าล็อบบี้ส่งให้ทุกคนในห้องเห็น
            io.to(roomName).emit('roomUpdated', {
                host: rooms[roomName].host,
                players: Object.values(rooms[roomName].players)
            });
        }
    });

    // เมื่อ Host กดเริ่มเกม
    socket.on('startGame', (roomName) => {
        if (rooms[roomName] && rooms[roomName].host === socket.id) {
            rooms[roomName].state = 'playing';
            io.to(roomName).emit('gameStarted'); // ส่งคำสั่งเริ่มเกมให้ทุกคน
        }
    });

    // รับข้อมูลตำแหน่ง/การยิง แล้วส่งให้คนอื่นในห้อง
    socket.on('updatePlayer', (data) => {
        const roomName = data.room;
        if (rooms[roomName] && rooms[roomName].state === 'playing') {
            socket.to(roomName).emit('updateOthers', { id: socket.id, ...data });
        }
    });

    // เมื่อผู้เล่นหลุด/ออกเกม
    socket.on('disconnect', () => {
        for (const roomName in rooms) {
            if (rooms[roomName].players[socket.id]) {
                delete rooms[roomName].players[socket.id];
                
                if (Object.keys(rooms[roomName].players).length === 0) {
                    delete rooms[roomName]; // ถ้าห้องว่างให้ลบทิ้ง
                } else {
                    // ถ้าคนที่ออกเป็น Host ให้โยนตำแหน่ง Host ให้คนถัดไป
                    if (rooms[roomName].host === socket.id) {
                        rooms[roomName].host = Object.keys(rooms[roomName].players)[0];
                    }
                    
                    if (rooms[roomName].state === 'waiting') {
                        io.to(roomName).emit('roomUpdated', {
                            host: rooms[roomName].host,
                            players: Object.values(rooms[roomName].players)
                        });
                    }
                    io.to(roomName).emit('playerDisconnected', socket.id);
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
