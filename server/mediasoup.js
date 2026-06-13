const mediasoup = require('mediasoup');

let worker;
const routers = {};
const transports = {};
const producers = {};
const consumers = {};

const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: { 'x-google-start-bitrate': 1000 }
  }
];

async function init(io, sessions, activePeers) {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: 10000,
    rtcMaxPort: 10100
  });

  worker.on('died', () => {
    console.error('mediasoup worker died!');
    process.exit(1);
  });

  console.log('mediasoup worker created');

  io.on('connection', (socket) => {
    socket.on('ms-get-rtp-capabilities', async ({ sessionId }, callback) => {
      try {
        if (!routers[sessionId]) {
          routers[sessionId] = await worker.createRouter({ mediaCodecs });
        }
        callback({ rtpCapabilities: routers[sessionId].rtpCapabilities });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    socket.on('ms-create-transport', async ({ sessionId, direction }, callback) => {
      try {
        const router = routers[sessionId];
        const transport = await router.createWebRtcTransport({
  listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.ANNOUNCED_IP }],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
});

        const key = `${socket.id}-${direction}`;
        transports[key] = transport;

        callback({
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters
        });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    socket.on('ms-connect-transport', async ({ sessionId, direction, dtlsParameters }, callback) => {
      try {
        const key = `${socket.id}-${direction}`;
        await transports[key].connect({ dtlsParameters });
        callback({ success: true });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    socket.on('ms-produce', async ({ sessionId, kind, rtpParameters }, callback) => {
      try {
        const key = `${socket.id}-send`;
        const producer = await transports[key].produce({ kind, rtpParameters });

        if (!producers[sessionId]) producers[sessionId] = [];
        producers[sessionId].push({ id: producer.id, kind, socketId: socket.id });

        socket.to(sessionId).emit('ms-new-producer', {
          producerId: producer.id,
          kind,
          socketId: socket.id
        });

        callback({ id: producer.id });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    socket.on('ms-consume', async ({ sessionId, producerId, rtpCapabilities }, callback) => {
      try {
        const router = routers[sessionId];
        if (!router.canConsume({ producerId, rtpCapabilities }))
          return callback({ error: 'Cannot consume' });

        const key = `${socket.id}-recv`;
        const consumer = await transports[key].consume({
          producerId,
          rtpCapabilities,
          paused: false
        });

        if (!consumers[socket.id]) consumers[socket.id] = [];
        consumers[socket.id].push(consumer);

        callback({
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters
        });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    socket.on('ms-get-producers', ({ sessionId }, callback) => {
      callback({ producers: producers[sessionId] || [] });
    });

    socket.on('disconnect', () => {
      ['send', 'recv'].forEach(dir => {
        const key = `${socket.id}-${dir}`;
        if (transports[key]) {
          transports[key].close();
          delete transports[key];
        }
      });

      Object.keys(routers).forEach(sessionId => {
        if (producers[sessionId]) {
          producers[sessionId] = producers[sessionId]
            .filter(p => p.socketId !== socket.id);
        }
      });
    });
  });
}

module.exports = { init };