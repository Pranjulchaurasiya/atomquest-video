import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import * as mediasoupClient from 'mediasoup-client'
import axios from 'axios'

const SOCKET_URL = 'https://atomquest-video.onrender.com'

export default function CallRoom() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const role = localStorage.getItem('role')

  const [messages, setMessages] = useState([])
  const [inputMsg, setInputMsg] = useState('')
  const [peers, setPeers] = useState([])
  const [recording, setRecording] = useState(null)
  const [audioMuted, setAudioMuted] = useState(false)
  const [videoOff, setVideoOff] = useState(false)
  const [status, setStatus] = useState('Connecting...')

  const socketRef = useRef(null)
  const deviceRef = useRef(null)
  const sendTransportRef = useRef(null)
  const recvTransportRef = useRef(null)
  const producersRef = useRef({})
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const chatEndRef = useRef(null)

  useEffect(() => {
    startCall()
    return () => cleanup()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function startCall() {
    // 1. Socket connect
    const socket = io(SOCKET_URL, { auth: { token } })
    socketRef.current = socket

    socket.on('connect', () => {
      setStatus('Connected')
      socket.emit('join-session', { sessionId })
    })

    socket.on('connect_error', (err) => {
      setStatus('Connection failed: ' + err.message)
    })

    socket.on('peer-joined', ({ role: r, participants }) => {
      setPeers(participants)
      setStatus('In call')
    })

    socket.on('peer-left', ({ participants }) => {
      setPeers(participants)
    })

    socket.on('chat-message', (msg) => {
      setMessages(prev => [...prev, msg])
    })

    socket.on('recording-status', ({ status: rs, url }) => {
      setRecording(rs)
      if (url) console.log('Recording ready:', url)
    })

    socket.on('session-ended', () => {
      alert('Session ended by agent')
      cleanup()
      navigate('/')
    })

    socket.on('ms-new-producer', async ({ producerId, kind, socketId }) => {
      await consumeTrack(producerId, kind)
    })

    // 2. Get local media
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      // 3. Setup mediasoup device
      await setupMediasoup(socket, stream)

    } catch (err) {
      setStatus('Camera/mic error: ' + err.message)
      console.error(err)
    }
  }

  async function setupMediasoup(socket, stream) {
    // Get RTP capabilities
    const { rtpCapabilities } = await socketEmit(socket, 'ms-get-rtp-capabilities', { sessionId })

    // Create device
    const device = new mediasoupClient.Device()
    await device.load({ routerRtpCapabilities: rtpCapabilities })
    deviceRef.current = device

    // Create send transport
    const sendParams = await socketEmit(socket, 'ms-create-transport', { sessionId, direction: 'send' })
    const sendTransport = device.createSendTransport(sendParams)
    sendTransportRef.current = sendTransport

    sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await socketEmit(socket, 'ms-connect-transport', { sessionId, direction: 'send', dtlsParameters })
        callback()
      } catch (err) { errback(err) }
    })

    sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
      try {
        const { id } = await socketEmit(socket, 'ms-produce', { sessionId, kind, rtpParameters })
        callback({ id })
      } catch (err) { errback(err) }
    })

    // Create recv transport
    const recvParams = await socketEmit(socket, 'ms-create-transport', { sessionId, direction: 'recv' })
    const recvTransport = device.createRecvTransport(recvParams)
    recvTransportRef.current = recvTransport

    recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await socketEmit(socket, 'ms-connect-transport', { sessionId, direction: 'recv', dtlsParameters })
        callback()
      } catch (err) { errback(err) }
    })

    // Produce audio + video
    const audioTrack = stream.getAudioTracks()[0]
    const videoTrack = stream.getVideoTracks()[0]

    if (audioTrack) {
      const audioProducer = await sendTransport.produce({ track: audioTrack })
      producersRef.current.audio = audioProducer
    }

    if (videoTrack) {
      const videoProducer = await sendTransport.produce({ track: videoTrack })
      producersRef.current.video = videoProducer
    }

    // Get existing producers
    const { producers } = await socketEmit(socket, 'ms-get-producers', { sessionId })
    for (const p of producers) {
      await consumeTrack(p.id, p.kind)
    }

    setStatus('In call ✅')
  }

  async function consumeTrack(producerId, kind) {
    const socket = socketRef.current
    const device = deviceRef.current
    const recvTransport = recvTransportRef.current
    if (!device || !recvTransport) return

    try {
      const params = await socketEmit(socket, 'ms-consume', {
        sessionId,
        producerId,
        rtpCapabilities: device.rtpCapabilities
      })

      const consumer = await recvTransport.consume(params)
      const stream = new MediaStream([consumer.track])

      if (remoteVideoRef.current) {
        const existing = remoteVideoRef.current.srcObject
        if (existing) {
          existing.addTrack(consumer.track)
        } else {
          remoteVideoRef.current.srcObject = stream
        }
      }
    } catch (err) {
      console.error('Consume error:', err)
    }
  }

  function socketEmit(socket, event, data) {
    return new Promise((resolve, reject) => {
      socket.emit(event, data, (response) => {
        if (response?.error) reject(new Error(response.error))
        else resolve(response)
      })
    })
  }

  function toggleAudio() {
    const producer = producersRef.current.audio
    if (!producer) return
    if (audioMuted) {
      producer.resume()
      setAudioMuted(false)
    } else {
      producer.pause()
      setAudioMuted(true)
    }
  }

  function toggleVideo() {
    const producer = producersRef.current.video
    if (!producer) return
    if (videoOff) {
      producer.resume()
      setVideoOff(false)
    } else {
      producer.pause()
      setVideoOff(true)
    }
  }

  function sendMessage() {
    if (!inputMsg.trim()) return
    socketRef.current?.emit('chat-message', { sessionId, message: inputMsg })
    setInputMsg('')
  }

  function startRecording() {
    socketRef.current?.emit('recording-start', { sessionId })
  }

  function stopRecording() {
    socketRef.current?.emit('recording-stop', { sessionId })
  }

  async function endSession() {
    if (role !== 'agent') return
    try {
      await axios.post(
        `https://atomquest-video.onrender.com/api/sessions/${sessionId}/end`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch (err) { console.error(err) }
    cleanup()
    navigate('/dashboard')
  }

  function cleanup() {
    producersRef.current.audio?.close()
    producersRef.current.video?.close()
    sendTransportRef.current?.close()
    recvTransportRef.current?.close()
    socketRef.current?.disconnect()
    if (localVideoRef.current?.srcObject) {
      localVideoRef.current.srcObject.getTracks().forEach(t => t.stop())
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f1117' }}>

      {/* VIDEO AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 12 }}>

        {/* Status bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>
            ⚡ Session: {sessionId?.slice(0, 8)}... | {status} | {peers.length} participant(s)
          </span>
          {recording && (
            <span style={{
              fontSize: 12, padding: '2px 10px', borderRadius: 20,
              background: recording === 'in-progress' ? '#7f1d1d' : '#166534',
              color: recording === 'in-progress' ? '#fca5a5' : '#86efac'
            }}>
              {recording === 'in-progress' ? '🔴 Recording' : recording === 'processing' ? '⏳ Processing' : '✅ Ready'}
            </span>
          )}
        </div>

        {/* Videos */}
        <div style={{ flex: 1, display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, position: 'relative', background: '#1e2130', borderRadius: 12, overflow: 'hidden' }}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <span style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 12, color: '#9ca3af' }}>
              Remote
            </span>
          </div>

          <div style={{ width: 200, position: 'relative', background: '#1e2130', borderRadius: 12, overflow: 'hidden' }}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <span style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 12, color: '#9ca3af' }}>
              You ({role})
            </span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', padding: '8px 0' }}>
          <button
            className={`btn ${audioMuted ? 'btn-danger' : 'btn-gray'}`}
            onClick={toggleAudio}
          >
            {audioMuted ? '🔇 Unmute' : '🎤 Mute'}
          </button>

          <button
            className={`btn ${videoOff ? 'btn-danger' : 'btn-gray'}`}
            onClick={toggleVideo}
          >
            {videoOff ? '📵 Video On' : '📹 Video Off'}
          </button>

          {role === 'agent' && !recording && (
            <button className="btn btn-danger" onClick={startRecording}>
              🔴 Record
            </button>
          )}

          {role === 'agent' && recording === 'in-progress' && (
            <button className="btn btn-gray" onClick={stopRecording}>
              ⏹ Stop Rec
            </button>
          )}

          {role === 'agent' && (
            <button className="btn btn-danger" onClick={endSession}>
              📵 End Session
            </button>
          )}

          {role === 'customer' && (
            <button className="btn btn-danger" onClick={() => { cleanup(); navigate('/') }}>
              Leave
            </button>
          )}
        </div>
      </div>

      {/* CHAT AREA */}
      <div style={{
        width: 300, display: 'flex', flexDirection: 'column',
        background: '#1e2130', borderLeft: '1px solid #2d3148'
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #2d3148' }}>
          <h3 style={{ fontSize: 16 }}>💬 Chat</h3>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center' }}>No messages yet</p>
          )}
          {messages.map(msg => (
            <div key={msg.id} style={{
              alignSelf: msg.sender === role ? 'flex-end' : 'flex-start',
              maxWidth: '80%'
            }}>
              <div style={{
                background: msg.sender === role ? '#4f46e5' : '#374151',
                padding: '8px 12px',
                borderRadius: 10,
                fontSize: 13
              }}>
                {msg.message}
              </div>
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2, textAlign: msg.sender === role ? 'right' : 'left' }}>
                {msg.sender} · {new Date(msg.time).toLocaleTimeString()}
              </p>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: 12, borderTop: '1px solid #2d3148', display: 'flex', gap: 8 }}>
          <input
            value={inputMsg}
            onChange={e => setInputMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type message..."
            style={{ flex: 1, margin: 0 }}
          />
          <button className="btn btn-primary" onClick={sendMessage} style={{ padding: '8px 14px' }}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}