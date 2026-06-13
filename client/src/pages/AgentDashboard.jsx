import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function AgentDashboard() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => { fetchSessions() }, [])

  async function fetchSessions() {
    try {
      const res = await axios.get('http://localhost:3000/api/sessions', { headers })
      setSessions(res.data)
    } catch (err) { console.error(err) }
  }

  async function createSession() {
    setLoading(true)
    try {
      const res = await axios.post('http://localhost:3000/api/sessions', {}, { headers })
      setSessions(prev => [res.data, ...prev])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  function copyLink(link) {
    navigator.clipboard.writeText(link)
    alert('Invite link copied!')
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 24 }}>⚡ Agent Dashboard</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-gray" onClick={() => navigate('/admin')}>Admin View</button>
          <button className="btn btn-danger" onClick={() => { localStorage.clear(); navigate('/') }}>Logout</button>
        </div>
      </div>

      <button className="btn btn-primary" onClick={createSession} disabled={loading} style={{ marginBottom: 24 }}>
        {loading ? 'Creating...' : '+ New Support Session'}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sessions.length === 0 && (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>No sessions yet.</p>
        )}
        {sessions.map(session => (
          <div key={session.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>
                  ID: {session.id.slice(0, 8)}...
                </p>
                <span style={{
                  fontSize: 12, padding: '2px 10px', borderRadius: 20,
                  background: session.status === 'active' ? '#166534' : session.status === 'ended' ? '#7f1d1d' : '#1e3a5f',
                  color: session.status === 'active' ? '#86efac' : session.status === 'ended' ? '#fca5a5' : '#93c5fd'
                }}>
                  {session.status}
                </span>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                  {new Date(session.createdAt).toLocaleString()}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-gray" onClick={() => copyLink(session.inviteLink)} style={{ fontSize: 12, padding: '6px 12px' }}>
                  Copy Invite
                </button>
                {session.status !== 'ended' && (
                  <button className="btn btn-primary" onClick={() => navigate(`/call/${session.id}`)} style={{ fontSize: 12, padding: '6px 12px' }}>
                    Join Call
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}