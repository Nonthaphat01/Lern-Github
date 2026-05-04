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

const rooms = {}; 

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('joinRoom', (data) => {
        const roomName = data.roomName;
        const playerName = data.playerName;
        
        socket.join(roomName);
        
        if (!rooms[roomName]) {
            rooms[roomName] = { host: socket.id, state: 'waiting', players: {} };
        }
        
        rooms[roomName].players[socket.id] = { name: playerName, id: socket.id };
        
        if (rooms[roomName].state === 'playing') {
            socket.emit('gameStarted', { host: rooms[roomName].host });
        } else {
            io.to(roomName).emit('roomUpdated', {
                host: rooms[roomName].host,
                players: Object.values(rooms[roomName].players)
            });
        }
    });

    socket.on('startGame', (roomName) => {
        if (rooms[roomName] && rooms[roomName].host === socket.id) {
            rooms[roomName].state = 'playing';
            io.to(roomName).emit('gameStarted', { host: rooms[roomName].host });
        }
    });

    socket.on('updatePlayer', (data) => {
        const roomName = data.room;
        if (rooms[roomName] && rooms[roomName].state === 'playing') {
            socket.to(roomName).emit('updateOthers', { id: socket.id, ...data });
        }
    });

    // 🌟 ส่งพิกัดซอมบี้และกระสุนบอส จาก Host ไปให้ทุกคนในห้อง 🌟
    socket.on('syncZombies', (data) => {
        if (rooms[data.room] && rooms[data.room].host === socket.id) {
            socket.to(data.room).emit('syncZombies', { zombies: data.zombies, enemyBullets: data.enemyBullets });
        }
    });

    // 🌟 เมื่อลูกห้องยิงซอมบี้โดน ให้ส่งคำสั่งไปบอก Host ให้ลดเลือดซอมบี้ 🌟
    socket.on('damageZombie', (data) => {
        if (rooms[data.room]) {
            io.to(rooms[data.room].host).emit('zombieDamaged', data);
        }
    });

    socket.on('disconnect', () => {
        for (const roomName in rooms) {
            if (rooms[roomName].players[socket.id]) {
                delete rooms[roomName].players[socket.id];
                
                if (Object.keys(rooms[roomName].players).length === 0) {
                    delete rooms[roomName]; 
                } else {
                    if (rooms[roomName].host === socket.id) {
                        rooms[roomName].host = Object.keys(rooms[roomName].players)[0];
                        io.to(roomName).emit('hostChanged', rooms[roomName].host);
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
