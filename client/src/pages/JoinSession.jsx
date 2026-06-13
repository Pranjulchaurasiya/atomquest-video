import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'

export default function JoinSession() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('Verifying invite...')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) { setError('Invalid invite link'); return }
    joinSession(token)
  }, [])

  async function joinSession(inviteToken) {
    try {
      const res = await axios.post('https://atomquest-video.onrender.com/api/auth/customer-join', { inviteToken })
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('role', res.data.role)
      localStorage.setItem('sessionId', res.data.sessionId)
      navigate('/call/' + res.data.sessionId)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join')
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ width: 360, textAlign: 'center' }}>
        <h2 style={{ marginBottom: 16 }}>⚡ AtomQuest Support</h2>
        {error ? <p style={{ color: '#ef4444' }}>{error}</p> : <p style={{ color: '#9ca3af' }}>{status}</p>}
      </div>
    </div>
  )
}
