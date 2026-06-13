import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function AdminDashboard() {
  const [sessions, setSessions] = useState([])
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 5000)
    return () => clearInterval(interval)
  }, [])

  async function fetchAll() {
    try {
      const res = await axios.get('http://localhost:3000/api/sessions', { headers })
      setSessions(res.data)
    } catch (err) { console.error(err) }
  }

  async function endSession(id) {
    try {
      await axios.post(`http://localhost:3000/api/sessions/${id}/end`, {}, { headers })
      fetchAll()
    } catch (err) { console.error(err) }
  }

  const live = sessions.filter(s => s.status === 'active')
  const history = sessions.filter(s => s.status !== 'active')

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
        <h1 style={{ fontSize: 24 }}>🛡️ Admin Dashboard</h1>
        <button className="btn btn-gray" onClick={() => navigate('/dashboard')}>← Back</button>
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 16, color: '#22c55e' }}>🟢 Live ({live.length})</h2>
      {live.length === 0
        ? <p style={{ color: '#6b7280', marginBottom: 32 }}>No active sessions</p>
        : live.map(s => (
          <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 13 }}>ID: {s.id.slice(0, 12)}...</p>
              <p style={{ fontSize: 12, color: '#9ca3af' }}>{new Date(s.createdAt).toLocaleString()}</p>
            </div>
            <button className="btn btn-danger" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => endSession(s.id)}>
              End Session
            </button>
          </div>
        ))
      }

      <h2 style={{ fontSize: 18, marginBottom: 16, color: '#9ca3af' }}>📋 History ({history.length})</h2>
      {history.map(s => (
        <div key={s.id} className="card" style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13 }}>ID: {s.id.slice(0, 12)}...</p>
          <p style={{ fontSize: 12, color: '#9ca3af' }}>
            {s.status} | Events: {s.events?.length || 0} | Chat: {s.chat?.length || 0}
          </p>
          {s.recordingUrl && (
            <a href={`http://localhost:3000${s.recordingUrl}`} style={{ fontSize: 12, color: '#4f46e5' }}>
              Download Recording
            </a>
          )}
        </div>
      ))}
    </div>
  )
}