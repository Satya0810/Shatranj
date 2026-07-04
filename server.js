import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { Chess } from 'chess.js';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PORT = process.env.PORT || 3000;

// In-memory lobby and game state
const lobby = []; // { socketId, userId, username, rating }
const nearbyLobbies = new Map(); // ipAddress -> [ { socketId, userId, username, rating, timeControl } ]
const mapPlayers = new Map(); // socketId -> { socketId, userId, username, rating, lat, lng, timeControl }
const activeGames = new Map(); // gameId -> { chess, white, black, timeControl, whiteTime, blackTime, lastMoveTime, timerInterval }
const onlineUsers = new Map(); // userId -> socketId
const onlineByIp = new Map(); // ipAddress -> [ { socketId, userId, username, rating } ]
const globalLocations = new Map(); // userId -> { lat, lng }

async function saveGameResult(gameId, game, result, reason, winner) {
  if (!game.white.userId || !game.black.userId) return;

  try {
    const { default: connectDB } = await import('./app/lib/mongodb.js');
    const { default: User } = await import('./app/models/User.js');
    const { default: Game } = await import('./app/models/Game.js');
    
    await connectDB();
    
    // Create Game record
    await Game.create({
      whitePlayer: game.white.userId,
      blackPlayer: game.black.userId,
      pgn: game.chess.pgn(),
      result,
      resultReason: reason,
      timeControl: game.timeControl,
      endedAt: new Date(),
    });

    // Update Users
    const whiteUser = await User.findById(game.white.userId);
    const blackUser = await User.findById(game.black.userId);

    if (whiteUser && blackUser) {
      whiteUser.gamesPlayed += 1;
      blackUser.gamesPlayed += 1;

      // Simple ELO calculation
      const kFactor = 32;
      const expectedWhite = 1 / (1 + Math.pow(10, (blackUser.rating - whiteUser.rating) / 400));
      const expectedBlack = 1 / (1 + Math.pow(10, (whiteUser.rating - blackUser.rating) / 400));

      let whiteScore = 0.5;
      let blackScore = 0.5;

      if (winner === 'white') {
        whiteScore = 1;
        blackScore = 0;
        whiteUser.wins += 1;
        blackUser.losses += 1;
      } else if (winner === 'black') {
        whiteScore = 0;
        blackScore = 1;
        whiteUser.losses += 1;
        blackUser.wins += 1;
      } else {
        whiteUser.draws += 1;
        blackUser.draws += 1;
      }

      const newWhiteRating = Math.max(100, Math.round(whiteUser.rating + kFactor * (whiteScore - expectedWhite)));
      const newBlackRating = Math.max(100, Math.round(blackUser.rating + kFactor * (blackScore - expectedBlack)));

      whiteUser.rating = newWhiteRating;
      blackUser.rating = newBlackRating;

      await whiteUser.save();
      await blackUser.save();
    }
  } catch (error) {
    console.error('Error saving game result:', error);
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    path: '/api/socketio',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Register user for global chat and presence
    socket.on('auth', (data) => {
      if (data && data.userId) {
        onlineUsers.set(data.userId, socket.id);
        
        // Track user by IP for nearby discovery
        const ip = getClientIp(socket);
        const ipUsers = onlineByIp.get(ip) || [];
        const existingIdx = ipUsers.findIndex(u => u.userId === data.userId);
        const entry = { socketId: socket.id, userId: data.userId, username: data.username || 'Unknown', rating: data.rating || 1200 };
        if (existingIdx === -1) {
          ipUsers.push(entry);
        } else {
          ipUsers[existingIdx] = entry;
        }
        onlineByIp.set(ip, ipUsers);
        
        // Broadcast updated nearby list to anyone in the nearby lobby on this IP
        broadcastNearbyAll(ip, socket.id);
        
        console.log(`User ${data.userId} (${data.username}) authenticated on socket ${socket.id}, IP: ${ip}`);

        // Rejoin active game if disconnected
        for (const [gameId, game] of activeGames.entries()) {
          if (game.white.userId === data.userId || game.black.userId === data.userId) {
            const isWhite = game.white.userId === data.userId;
            if (isWhite) game.white.socketId = socket.id;
            else game.black.socketId = socket.id;
            
            socket.join(gameId);
            
            const opponent = isWhite ? game.black : game.white;
            
            let currentWhiteTime = game.whiteTime;
            let currentBlackTime = game.blackTime;
            if (game.chess.turn() === 'w') currentWhiteTime -= (Date.now() - game.lastMoveTime);
            else currentBlackTime -= (Date.now() - game.lastMoveTime);

            socket.emit('rejoin-game', {
              gameId,
              color: isWhite ? 'white' : 'black',
              opponent: { username: opponent.username, rating: opponent.rating, userId: opponent.userId },
              timeControl: game.timeControl,
              fen: game.chess.fen(),
              history: game.chess.history({ verbose: true }),
              whiteTime: Math.max(0, currentWhiteTime),
              blackTime: Math.max(0, currentBlackTime),
            });
            console.log(`User ${data.username} rejoined game ${gameId}`);
            break;
          }
        }
      }
    });

    socket.on('update-location', (data) => {
      if (data && data.lat && data.lng) {
        // Find userId for this socket
        let userId = null;
        for (const [id, sock] of onlineUsers.entries()) {
          if (sock === socket.id) {
            userId = id;
            break;
          }
        }
        if (userId) {
          globalLocations.set(userId, { lat: data.lat, lng: data.lng });
          // If they aren't actively in mapPlayers but are on the map, this helps broadcastMapLobby
          // It's a good idea to trigger a map broadcast here to show the newly located player to others.
          broadcastMapLobby();
        }
      }
    });

    const getClientIp = (socket) => {
      return socket.handshake.headers['x-forwarded-for']?.split(',')[0].trim() || socket.handshake.address;
    };

    const broadcastNearby = (ip) => {
      const players = nearbyLobbies.get(ip) || [];
      players.forEach(p => {
        io.to(p.socketId).emit('nearby-players', players.filter(other => other.socketId !== p.socketId));
      });
    };

    const broadcastNearbyAll = async (ip) => {
      const lobbyMembers = nearbyLobbies.get(ip) || [];
      if (lobbyMembers.length === 0) return;
      
      const allOnIp = onlineByIp.get(ip) || [];
      const onIpIds = allOnIp.map(u => u.userId);

      const onlineIds = Array.from(onlineUsers.keys());
      const otherOnlineIds = onlineIds.filter(id => !onIpIds.includes(id));

      let mockUsers = [];
      if (otherOnlineIds.length > 0) {
        try {
          const { default: connectDB } = await import('./app/lib/mongodb.js');
          const { default: User } = await import('./app/models/User.js');
          await connectDB();
          const dbUsers = await User.find({ _id: { $in: otherOnlineIds } }).limit(30).lean();
          
          mockUsers = dbUsers.map(u => {
            const socketId = onlineUsers.get(u._id.toString());
            return {
              socketId: socketId,
              userId: u._id.toString(),
              username: u.username,
              rating: u.rating,
            };
          });
        } catch (err) {
          console.error('Error fetching mock nearby users:', err);
        }
      }

      lobbyMembers.forEach(member => {
        const others = allOnIp.filter(u => u.socketId !== member.socketId);
        const combined = [...others, ...mockUsers.filter(u => u.socketId !== member.socketId)];
        io.to(member.socketId).emit('nearby-players', combined);
      });
    };

    const broadcastMapLobby = async () => {
      const activePlayers = Array.from(mapPlayers.values());
      if (activePlayers.length === 0) return;

      const activeUserIds = activePlayers.map(p => p.userId);
      const onlineIds = Array.from(onlineUsers.keys());
      const otherOnlineIds = onlineIds.filter(id => !activeUserIds.includes(id));

      let allUsers = [];
      if (otherOnlineIds.length > 0) {
        try {
          const { default: connectDB } = await import('./app/lib/mongodb.js');
          const { default: User } = await import('./app/models/User.js');
          await connectDB();
          allUsers = await User.find({ _id: { $in: otherOnlineIds } }).limit(50).lean();
        } catch (err) {
          console.error('Error fetching users for map lobby:', err);
        }
      }

      activePlayers.forEach(p => {
        const others = activePlayers.filter(other => other.socketId !== p.socketId);
        
        const offlineNearby = allUsers.map(u => {
          const socketId = onlineUsers.get(u._id.toString());
          const storedLoc = globalLocations.get(u._id.toString());
          
          let lat, lng;
          if (storedLoc) {
            lat = storedLoc.lat;
            lng = storedLoc.lng;
          } else {
            let hash = 0;
            const str = u._id.toString();
            for (let i = 0; i < str.length; i++) {
              hash = ((hash << 5) - hash) + str.charCodeAt(i);
              hash |= 0;
            }
            const rand1 = Math.abs(Math.sin(hash)) * 10000 % 1;
            const rand2 = Math.abs(Math.cos(hash)) * 10000 % 1;
            const maxOffset = 5 / 111; // ~5km
            lat = p.lat + (rand1 - 0.5) * 2 * maxOffset;
            lng = p.lng + (rand2 - 0.5) * 2 * maxOffset;
          }
          
          return {
            socketId: socketId,
            userId: u._id.toString(),
            username: u.username,
            rating: u.rating,
            lat,
            lng,
            isOffline: false
          };
        });

        const allNearby = [...others, ...offlineNearby];
        
        const getDistance = (lat1, lng1, lat2, lng2) => {
          const R = 6371;
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLng = (lng2 - lng1) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        };

        allNearby.sort((a, b) => {
          const distA = getDistance(p.lat, p.lng, a.lat, a.lng);
          const distB = getDistance(p.lat, p.lng, b.lat, b.lng);
          return distA - distB;
        });

        io.to(p.socketId).emit('map-players', allNearby);
      });
    };

    // --- Map Lobby ---
    socket.on('join-map-lobby', (data) => {
      mapPlayers.set(socket.id, { ...data, socketId: socket.id });
      broadcastMapLobby();
      console.log(`[Map] ${data.username} joined from [${data.lat}, ${data.lng}].`);
    });

    socket.on('leave-map-lobby', () => {
      if (mapPlayers.has(socket.id)) {
        mapPlayers.delete(socket.id);
        broadcastMapLobby();
      }
    });

    socket.on('challenge-map-player', (data) => {
      const { targetSocketId, timeControl } = data;
      if (targetSocketId.startsWith('offline_')) {
        socket.emit('map-challenge-declined');
        return;
      }
      const challenger = mapPlayers.get(socket.id);
      if (challenger) {
        io.to(targetSocketId).emit('incoming-map-challenge', { challenger: { ...challenger, timeControl } });
      }
    });

    socket.on('accept-map-challenge', async (data) => {
      const { challengerSocketId } = data;
      const challenger = mapPlayers.get(challengerSocketId);
      let acceptor = mapPlayers.get(socket.id);

      if (!acceptor) {
        let userId = null;
        for (const [uId, sId] of onlineUsers.entries()) {
          if (sId === socket.id) {
            userId = uId;
            break;
          }
        }
        if (userId) {
          try {
            const { default: connectDB } = await import('./app/lib/mongodb.js');
            const { default: User } = await import('./app/models/User.js');
            await connectDB();
            const userDoc = await User.findById(userId).lean();
            if (userDoc) {
              acceptor = {
                socketId: socket.id,
                userId: userDoc._id.toString(),
                username: userDoc.username,
                rating: userDoc.rating,
              };
            }
          } catch (e) { console.error(e); }
        }
      }

      if (challenger && acceptor) {
        const isWhite = Math.random() > 0.5;
        const white = isWhite ? acceptor : challenger;
        const black = isWhite ? challenger : acceptor;
        
        const tc = challenger.timeControl || { minutes: 10, increment: 0 };
        const gameId = `game_map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const chess = new Chess();
        const initialTime = tc.minutes * 60 * 1000;

        activeGames.set(gameId, {
          chess, white, black, timeControl: tc,
          whiteTime: initialTime, blackTime: initialTime,
          lastMoveTime: Date.now(), timerInterval: null,
        });

        const gameData = { gameId, timeControl: tc, whiteTime: initialTime, blackTime: initialTime };

        io.to(white.socketId).emit('game-start', { ...gameData, color: 'white', opponent: { username: black.username, rating: black.rating, userId: black.userId } });
        io.to(black.socketId).emit('game-start', { ...gameData, color: 'black', opponent: { username: white.username, rating: white.rating, userId: white.userId } });

        const whiteSocket = io.sockets.sockets.get(white.socketId);
        const blackSocket = io.sockets.sockets.get(black.socketId);
        if (whiteSocket) whiteSocket.join(gameId);
        if (blackSocket) blackSocket.join(gameId);

        mapPlayers.delete(white.socketId);
        mapPlayers.delete(black.socketId);
        broadcastMapLobby();
      }
    });

    socket.on('decline-map-challenge', (data) => {
      io.to(data.challengerSocketId).emit('map-challenge-declined');
    });

    socket.on('join-nearby', (data) => {
      const ip = getClientIp(socket);
      const players = nearbyLobbies.get(ip) || [];
      const existingIdx = players.findIndex(p => p.socketId === socket.id);
      if (existingIdx === -1) {
        players.push({ ...data, socketId: socket.id, ip });
        nearbyLobbies.set(ip, players);
      } else {
        players[existingIdx] = { ...data, socketId: socket.id, ip };
      }
      
      // Send all online users on same IP (not just lobby members)
      broadcastNearbyAll(ip);
      console.log(`[Nearby] ${data.username} joined on IP ${ip}. Total on IP: ${(onlineByIp.get(ip) || []).length}`);
    });

    socket.on('leave-nearby', () => {
      const ip = getClientIp(socket);
      const players = nearbyLobbies.get(ip);
      if (players) {
        const idx = players.findIndex(p => p.socketId === socket.id);
        if (idx !== -1) {
          players.splice(idx, 1);
          if (players.length === 0) {
            nearbyLobbies.delete(ip);
          } else {
            broadcastNearbyAll(ip);
          }
        }
      }
    });

    socket.on('challenge-nearby', (data) => {
      const { targetSocketId, timeControl, note } = data;
      if (targetSocketId.startsWith('offline_')) {
        socket.emit('challenge-declined');
        return;
      }
      const ip = getClientIp(socket);
      const players = nearbyLobbies.get(ip) || [];
      const challenger = players.find(p => p.socketId === socket.id);
      if (challenger) {
        io.to(targetSocketId).emit('incoming-challenge', { challenger: { ...challenger, timeControl, note: note || '' } });
      }
    });

    socket.on('accept-nearby-challenge', async (data) => {
      const { challengerSocketId } = data;
      
      let challenger = null;
      for (const lobby of nearbyLobbies.values()) {
        const found = lobby.find(p => p.socketId === challengerSocketId);
        if (found) {
          challenger = found;
          break;
        }
      }

      let acceptor = null;
      let userId = null;
      for (const [uId, sId] of onlineUsers.entries()) {
        if (sId === socket.id) {
          userId = uId;
          break;
        }
      }
      if (userId) {
        try {
          const { default: connectDB } = await import('./app/lib/mongodb.js');
          const { default: User } = await import('./app/models/User.js');
          await connectDB();
          const userDoc = await User.findById(userId).lean();
          if (userDoc) {
            acceptor = {
              socketId: socket.id,
              userId: userDoc._id.toString(),
              username: userDoc.username,
              rating: userDoc.rating,
            };
          }
        } catch (e) { console.error(e); }
      }

      if (challenger && acceptor) {
        // Start game
        const isWhite = Math.random() > 0.5;
        const white = isWhite ? acceptor : challenger;
        const black = isWhite ? challenger : acceptor;
        
        // Take time control from challenger
        const tc = challenger.timeControl || { minutes: 10, increment: 0 };

        const gameId = `game_nearby_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const chess = new Chess();
        const initialTime = tc.minutes * 60 * 1000;

        activeGames.set(gameId, {
          chess,
          white,
          black,
          timeControl: tc,
          whiteTime: initialTime,
          blackTime: initialTime,
          lastMoveTime: Date.now(),
          timerInterval: null,
        });

        const gameData = { gameId, timeControl: tc, whiteTime: initialTime, blackTime: initialTime };

        io.to(white.socketId).emit('game-start', {
          ...gameData, color: 'white', opponent: { username: black.username, rating: black.rating, userId: black.userId },
        });
        io.to(black.socketId).emit('game-start', {
          ...gameData, color: 'black', opponent: { username: white.username, rating: white.rating, userId: white.userId },
        });

        const whiteSocket = io.sockets.sockets.get(white.socketId);
        const blackSocket = io.sockets.sockets.get(black.socketId);
        if (whiteSocket) whiteSocket.join(gameId);
        if (blackSocket) blackSocket.join(gameId);
      }
    });

    socket.on('decline-nearby-challenge', (data) => {
      io.to(data.challengerSocketId).emit('challenge-declined');
    });

    // Join matchmaking lobby
    socket.on('join-lobby', (data) => {
      const { userId, username, rating, timeControl } = data;
      
      // Remove if already in lobby
      const existingIndex = lobby.findIndex(p => p.userId === userId);
      if (existingIndex !== -1) lobby.splice(existingIndex, 1);

      // Check if there's someone waiting
      const opponent = lobby.find(p => p.userId !== userId);

      if (opponent) {
        // Match found! Remove opponent from lobby
        lobby.splice(lobby.indexOf(opponent), 1);

        // Randomly assign colors
        const isWhite = Math.random() > 0.5;
        const white = isWhite ? { ...data, socketId: socket.id } : opponent;
        const black = isWhite ? opponent : { ...data, socketId: socket.id };

        const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const chess = new Chess();
        const tc = timeControl || { minutes: 10, increment: 0 };
        const initialTime = tc.minutes * 60 * 1000; // in ms

        activeGames.set(gameId, {
          chess,
          white,
          black,
          timeControl: tc,
          whiteTime: initialTime,
          blackTime: initialTime,
          lastMoveTime: Date.now(),
          timerInterval: null,
        });

        // Notify both players
        const gameData = {
          gameId,
          timeControl: tc,
          whiteTime: initialTime,
          blackTime: initialTime,
        };

        io.to(white.socketId).emit('game-start', {
          ...gameData,
          color: 'white',
          opponent: { username: black.username, rating: black.rating, userId: black.userId },
        });

        io.to(black.socketId).emit('game-start', {
          ...gameData,
          color: 'black',
          opponent: { username: white.username, rating: white.rating, userId: white.userId },
        });

        // Join both to a game room
        const whiteSocket = io.sockets.sockets.get(white.socketId);
        const blackSocket = io.sockets.sockets.get(black.socketId);
        if (whiteSocket) whiteSocket.join(gameId);
        if (blackSocket) blackSocket.join(gameId);

        console.log(`Game ${gameId} started: ${white.username} (W) vs ${black.username} (B)`);
      } else {
        // No opponent found, add to lobby
        lobby.push({ ...data, socketId: socket.id });
        socket.emit('waiting', { position: lobby.length });
        console.log(`${username} joined lobby. Queue size: ${lobby.length}`);
      }
    });

    // Leave lobby
    socket.on('leave-lobby', (data) => {
      const idx = lobby.findIndex(p => p.socketId === socket.id);
      if (idx !== -1) lobby.splice(idx, 1);
    });

    // Handle a move
    socket.on('move', (data) => {
      const { gameId, move } = data;
      const game = activeGames.get(gameId);
      if (!game) return;

      const { chess, white, black } = game;
      
      // Verify it's the correct player's turn
      const isWhiteTurn = chess.turn() === 'w';
      const isWhitePlayer = socket.id === white.socketId;
      if (isWhiteTurn !== isWhitePlayer) return;

      // Update clock
      const now = Date.now();
      const elapsed = now - game.lastMoveTime;
      const tc = game.timeControl;

      if (isWhiteTurn) {
        game.whiteTime -= elapsed;
        if (tc.increment) game.whiteTime += tc.increment * 1000;
      } else {
        game.blackTime -= elapsed;
        if (tc.increment) game.blackTime += tc.increment * 1000;
      }
      game.lastMoveTime = now;

      // Check for flag
      if (game.whiteTime <= 0) {
        saveGameResult(gameId, game, '0-1', 'timeout', 'black');
        io.to(gameId).emit('game-over', {
          result: '0-1',
          reason: 'timeout',
          winner: 'black',
          whiteTime: 0,
          blackTime: game.blackTime,
        });
        activeGames.delete(gameId);
        return;
      }
      if (game.blackTime <= 0) {
        saveGameResult(gameId, game, '1-0', 'timeout', 'white');
        io.to(gameId).emit('game-over', {
          result: '1-0',
          reason: 'timeout',
          winner: 'white',
          whiteTime: game.whiteTime,
          blackTime: 0,
        });
        activeGames.delete(gameId);
        return;
      }

      // Apply the move
      try {
        chess.move(move);
      } catch (e) {
        socket.emit('invalid-move', { message: 'Invalid move' });
        return;
      }

      // Broadcast move to opponent
      io.to(gameId).emit('move-made', {
        move,
        fen: chess.fen(),
        history: chess.history({ verbose: true }),
        whiteTime: game.whiteTime,
        blackTime: game.blackTime,
      });

      // Check game end conditions
      if (chess.isCheckmate()) {
        const winner = chess.turn() === 'w' ? 'black' : 'white';
        saveGameResult(gameId, game, winner === 'white' ? '1-0' : '0-1', 'checkmate', winner);
        io.to(gameId).emit('game-over', {
          result: winner === 'white' ? '1-0' : '0-1',
          reason: 'checkmate',
          winner,
          whiteTime: game.whiteTime,
          blackTime: game.blackTime,
        });
        activeGames.delete(gameId);
      } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
        saveGameResult(gameId, game, '1/2-1/2', chess.isStalemate() ? 'stalemate' : 'draw', null);
        io.to(gameId).emit('game-over', {
          result: '1/2-1/2',
          reason: chess.isStalemate() ? 'stalemate' : 'draw',
          winner: null,
          whiteTime: game.whiteTime,
          blackTime: game.blackTime,
        });
        activeGames.delete(gameId);
      }
    });

    // Resign
    socket.on('resign', (data) => {
      const { gameId } = data;
      const game = activeGames.get(gameId);
      if (!game) return;

      const isWhite = socket.id === game.white.socketId;
      const winner = isWhite ? 'black' : 'white';

      saveGameResult(gameId, game, winner === 'white' ? '1-0' : '0-1', 'resignation', winner);

      io.to(gameId).emit('game-over', {
        result: winner === 'white' ? '1-0' : '0-1',
        reason: 'resignation',
        winner,
        whiteTime: game.whiteTime,
        blackTime: game.blackTime,
      });
      activeGames.delete(gameId);
    });

    // Draw offer
    socket.on('offer-draw', (data) => {
      const { gameId } = data;
      const game = activeGames.get(gameId);
      if (!game) return;

      const opponentSocketId = socket.id === game.white.socketId
        ? game.black.socketId
        : game.white.socketId;

      io.to(opponentSocketId).emit('draw-offered');
    });

    socket.on('accept-draw', (data) => {
      const { gameId } = data;
      const game = activeGames.get(gameId);
      if (!game) return;

      saveGameResult(gameId, game, '1/2-1/2', 'agreement', null);

      io.to(gameId).emit('game-over', {
        result: '1/2-1/2',
        reason: 'agreement',
        winner: null,
        whiteTime: game.whiteTime,
        blackTime: game.blackTime,
      });
      activeGames.delete(gameId);
    });

    socket.on('decline-draw', (data) => {
      const { gameId } = data;
      const game = activeGames.get(gameId);
      if (!game) return;

      const opponentSocketId = socket.id === game.white.socketId
        ? game.black.socketId
        : game.white.socketId;

      io.to(opponentSocketId).emit('draw-declined');
    });

    // Chat and WebRTC Signaling
    socket.on('chat-message', (data) => {
      const { gameId, message, sender } = data;
      const game = activeGames.get(gameId);
      if (!game) return;
      const opponentSocketId = socket.id === game.white.socketId ? game.black.socketId : game.white.socketId;
      io.to(opponentSocketId).emit('chat-message', { message, sender });
    });

    socket.on('webrtc-offer', (data) => {
      const { gameId, offer } = data;
      const game = activeGames.get(gameId);
      if (!game) return;
      const opponentSocketId = socket.id === game.white.socketId ? game.black.socketId : game.white.socketId;
      io.to(opponentSocketId).emit('webrtc-offer', { offer });
    });

    socket.on('webrtc-answer', (data) => {
      const { gameId, answer } = data;
      const game = activeGames.get(gameId);
      if (!game) return;
      const opponentSocketId = socket.id === game.white.socketId ? game.black.socketId : game.white.socketId;
      io.to(opponentSocketId).emit('webrtc-answer', { answer });
    });

    socket.on('webrtc-ice-candidate', (data) => {
      const { gameId, candidate } = data;
      const game = activeGames.get(gameId);
      if (!game) return;
      const opponentSocketId = socket.id === game.white.socketId ? game.black.socketId : game.white.socketId;
      io.to(opponentSocketId).emit('webrtc-ice-candidate', { candidate });
    });

    socket.on('call-request', (data) => {
      const { gameId, mode } = data;
      const game = activeGames.get(gameId);
      if (!game) return;
      const opponentSocketId = socket.id === game.white.socketId ? game.black.socketId : game.white.socketId;
      io.to(opponentSocketId).emit('call-request', { mode });
    });

    socket.on('call-accepted', (data) => {
      const { gameId } = data;
      const game = activeGames.get(gameId);
      if (!game) return;
      const opponentSocketId = socket.id === game.white.socketId ? game.black.socketId : game.white.socketId;
      io.to(opponentSocketId).emit('call-accepted');
    });

    socket.on('call-declined', (data) => {
      const { gameId } = data;
      const game = activeGames.get(gameId);
      if (!game) return;
      const opponentSocketId = socket.id === game.white.socketId ? game.black.socketId : game.white.socketId;
      io.to(opponentSocketId).emit('call-declined');
    });

    socket.on('call-ended', (data) => {
      const { gameId } = data;
      const game = activeGames.get(gameId);
      if (!game) return;
      const opponentSocketId = socket.id === game.white.socketId ? game.black.socketId : game.white.socketId;
      io.to(opponentSocketId).emit('call-ended');
    });

    // Global Private Messaging
    socket.on('private-message', async (data) => {
      const { recipientId, message, senderId, senderName } = data;
      try {
        const { default: connectDB } = await import('./app/lib/mongodb.js');
        const { default: Message } = await import('./app/models/Message.js');
        await connectDB();
        
        const newMessage = await Message.create({ senderId, receiverId: recipientId, content: message });
        
        // Send to recipient if online
        const recipientSocketId = onlineUsers.get(recipientId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('private-message', {
            _id: newMessage._id,
            senderId,
            receiverId: recipientId,
            senderName,
            content: message,
            createdAt: newMessage.createdAt
          });
        }
        
        // Also echo back to sender to confirm it went through
        socket.emit('private-message', {
          _id: newMessage._id,
          senderId,
          receiverId: recipientId,
          senderName,
          content: message,
          createdAt: newMessage.createdAt
        });
      } catch (err) {
        console.error('Error saving private message:', err);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      
      // Remove from onlineUsers
      for (const [userId, sId] of onlineUsers.entries()) {
        if (sId === socket.id) {
          onlineUsers.delete(userId);
          break;
        }
      }

      // Remove from onlineByIp
      const ip = getClientIp(socket);
      const ipUsers = onlineByIp.get(ip);
      if (ipUsers) {
        const idx = ipUsers.findIndex(u => u.socketId === socket.id);
        if (idx !== -1) {
          ipUsers.splice(idx, 1);
          if (ipUsers.length === 0) onlineByIp.delete(ip);
        }
        // Update nearby lobby members with new list
        broadcastNearbyAll(ip);
      }

      // Remove from lobby
      const lobbyIdx = lobby.findIndex(p => p.socketId === socket.id);
      if (lobbyIdx !== -1) lobby.splice(lobbyIdx, 1);

      // Remove from nearbyLobbies
      const nearbyPlayers = nearbyLobbies.get(ip);
      if (nearbyPlayers) {
        const idx = nearbyPlayers.findIndex(p => p.socketId === socket.id);
        if (idx !== -1) {
          nearbyPlayers.splice(idx, 1);
          if (nearbyPlayers.length === 0) nearbyLobbies.delete(ip);
          else broadcastNearbyAll(ip);
        }
      }

      // Remove from mapLobbies
      if (mapPlayers.has(socket.id)) {
        mapPlayers.delete(socket.id);
        broadcastMapLobby();
      }

      // Check if player was in an active game
      for (const [gameId, game] of activeGames.entries()) {
        if (socket.id === game.white.socketId || socket.id === game.black.socketId) {
          const isWhite = socket.id === game.white.socketId;
          const winner = isWhite ? 'black' : 'white';

          io.to(gameId).emit('game-over', {
            result: winner === 'white' ? '1-0' : '0-1',
            reason: 'disconnect',
            winner,
            whiteTime: game.whiteTime,
            blackTime: game.blackTime,
          });
          activeGames.delete(gameId);
          break;
        }
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`> ChessMaster server ready on http://localhost:${PORT}`);
  });
});
