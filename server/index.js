const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// In-memory store (PostgreSQL baad mein)
const sessions = {};
const activePeers = {};

// ─── AUTH ROUTES ───────────────────────────────────────────
app.post('/api/auth/agent-login', (req, res) => {
  const { password } = req.body;
  if (password !== process.env.AGENT_PASSWORD)
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { role: 'agent', id: uuidv4() },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ token, role: 'agent' });
});

app.post('/api/auth/customer-join', (req, res) => {
  const { inviteToken } = req.body;
  try {
    const decoded = jwt.verify(inviteToken, process.env.JWT_SECRET);
    if (decoded.type !== 'invite')
      return res.status(401).json({ error: 'Invalid invite' });

    const session = sessions[decoded.sessionId];
    if (!session)
      return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'ended')
      return res.status(410).json({ error: 'Session has ended' });

    const token = jwt.sign(
      { role: 'customer', id: uuidv4(), sessionId: decoded.sessionId },
      process.env.JWT_SECRET,
      { expiresIn: '4h' }
    );
    res.json({ token, role: 'customer', sessionId: decoded.sessionId });
  } catch {
    res.status(401).json({ error: 'Invalid or expired invite' });
  }
});

// ─── SESSION ROUTES ────────────────────────────────────────
function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function agentOnly(req, res, next) {
  if (req.user.role !== 'agent')
    return res.status(403).json({ error: 'Agent only' });
  next();
}

app.post('/api/sessions', verifyToken, agentOnly, (req, res) => {
  const sessionId = uuidv4();
  const inviteToken = jwt.sign(
    { type: 'invite', sessionId },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  sessions[sessionId] = {
    id: sessionId,
    createdBy: req.user.id,
    createdAt: new Date(),
    status: 'waiting',
    inviteToken,
    inviteLink: `http://localhost:5173/join?token=${inviteToken}`,
    events: [],
    chat: []
  };

  res.json(sessions[sessionId]);
});

app.get('/api/sessions', verifyToken, agentOnly, (req, res) => {
  res.json(Object.values(sessions));
});

app.get('/api/sessions/:id', verifyToken, (req, res) => {
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json(session);
});

app.post('/api/sessions/:id/end', verifyToken, agentOnly, (req, res) => {
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ error: 'Not found' });
  session.status = 'ended';
  session.endedAt = new Date();
  io.to(req.params.id).emit('session-ended');
  res.json({ success: true });
});

app.get('/api/sessions/:id/chat', verifyToken, (req, res) => {
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json(session.chat);
});

// ─── ADMIN ROUTES ──────────────────────────────────────────
app.get('/api/admin/live', verifyToken, agentOnly, (req, res) => {
  const live = Object.values(sessions)
    .filter(s => s.status === 'active')
    .map(s => ({
      ...s,
      participants: activePeers[s.id] || []
    }));
  res.json(live);
});

// ─── MEDIASOUP SETUP ───────────────────────────────────────
const mediasoupHandler = require('./mediasoup');
mediasoupHandler.init(io, sessions, activePeers);

// ─── SOCKET.IO ─────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.user.role} - ${socket.id}`);

  socket.on('join-session', ({ sessionId }) => {
    const session = sessions[sessionId];
    if (!session) return socket.emit('error', 'Session not found');
    if (session.status === 'ended') return socket.emit('error', 'Session ended');

    socket.join(sessionId);
    socket.sessionId = sessionId;

    if (!activePeers[sessionId]) activePeers[sessionId] = [];
    activePeers[sessionId].push({
      socketId: socket.id,
      role: socket.user.role,
      joinedAt: new Date()
    });

    if (session.status === 'waiting') session.status = 'active';

    session.events.push({
      type: 'join',
      role: socket.user.role,
      time: new Date()
    });

    io.to(sessionId).emit('peer-joined', {
      role: socket.user.role,
      participants: activePeers[sessionId]
    });
  });

  socket.on('chat-message', ({ sessionId, message }) => {
    const session = sessions[sessionId];
    if (!session) return;

    const msg = {
      id: uuidv4(),
      sender: socket.user.role,
      message,
      time: new Date()
    };
    session.chat.push(msg);
    io.to(sessionId).emit('chat-message', msg);
  });

  socket.on('recording-start', ({ sessionId }) => {
    if (socket.user.role !== 'agent') return;
    const session = sessions[sessionId];
    if (!session) return;
    session.recording = 'in-progress';
    io.to(sessionId).emit('recording-status', { status: 'in-progress' });
  });

  socket.on('recording-stop', ({ sessionId }) => {
    if (socket.user.role !== 'agent') return;
    const session = sessions[sessionId];
    if (!session) return;
    session.recording = 'processing';
    io.to(sessionId).emit('recording-status', { status: 'processing' });
    setTimeout(() => {
      session.recording = 'ready';
      session.recordingUrl = `/recordings/${sessionId}.mp4`;
      io.to(sessionId).emit('recording-status', {
        status: 'ready',
        url: session.recordingUrl
      });
    }, 3000);
  });

  socket.on('disconnect', () => {
    const sessionId = socket.sessionId;
    if (!sessionId) return;

    if (activePeers[sessionId]) {
      activePeers[sessionId] = activePeers[sessionId]
        .filter(p => p.socketId !== socket.id);
    }

    sessions[sessionId]?.events.push({
      type: 'leave',
      role: socket.user.role,
      time: new Date()
    });

    io.to(sessionId).emit('peer-left', {
      role: socket.user.role,
      participants: activePeers[sessionId] || []
    });
  });
});

server.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});