import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function AgentLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await axios.post('http://localhost:3000/api/auth/agent-login', { password })
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('role', res.data.role)
      navigate('/dashboard')
    } catch {
      setError('Invalid password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="card" style={{ width: 380 }}>
        <h2 style={{ marginBottom: 8, fontSize: 22 }}>⚡ AtomQuest Support</h2>
        <p style={{ color: '#9ca3af', marginBottom: 24, fontSize: 14 }}>Agent login</p>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter agent password"
              required
            />
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Logging in...' : 'Login as Agent'}
          </button>
        </form>
      </div>
    </div>
  )
}
