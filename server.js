const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors()); // อนุญาตให้ตัวเกม(HTML) เชื่อมต่อข้ามโดเมนได้
app.get('/', (req, res) => {
    res.send('<h1 style="color:green; font-family:sans-serif; text-align:center; margin-top:50px;">✅ Zombie Server is Online and Ready!</h1>');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // ยอมรับการเชื่อมต่อจากทุกที่
        methods: ["GET", "POST"]
    }
});

// เก็บข้อมูลผู้เล่นทั้งหมด
const players = {};

io.on('connection', (socket) => {
    console.log('🔥 Player connected:', socket.id);

    // เมื่อผู้เล่นเข้าห้อง
    socket.on('joinRoom', (roomName) => {
        socket.join(roomName);
        players[socket.id] = { room: roomName };
        console.log(`👉 Player ${socket.id} joined room: ${roomName}`);
    });

    // เมื่อผู้เล่นขยับตัว หรืออัปเดตเลือด/อาวุธ
    socket.on('updatePlayer', (data) => {
        if (players[socket.id]) {
            players[socket.id] = { ...players[socket.id], ...data };
            // ส่งข้อมูลนี้ไปให้ "คนอื่นๆ" ในห้องเดียวกัน (Real-time!)
            socket.to(players[socket.id].room).emit('updateOthers', {
                id: socket.id, // ใช้รหัส socket เป็น ID แทนชื่อ
                ...data
            });
        }
    });

    // เมื่อผู้เล่นหลุด/ปิดเกม
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        if (players[socket.id]) {
            const room = players[socket.id].room;
            delete players[socket.id];
            // บอกคนอื่นในห้องว่าลบตัวละครนี้ทิ้งซะ
            io.to(room).emit('playerDisconnected', socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
