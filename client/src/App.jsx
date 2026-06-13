import { Routes, Route, Navigate } from 'react-router-dom'
import AgentLogin from './pages/AgentLogin'
import AgentDashboard from './pages/AgentDashboard'
import CallRoom from './pages/CallRoom'
import JoinSession from './pages/JoinSession'
import AdminDashboard from './pages/AdminDashboard'

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/" />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AgentLogin />} />
      <Route path="/join" element={<JoinSession />} />
      <Route path="/dashboard" element={
        <PrivateRoute><AgentDashboard /></PrivateRoute>
      } />
      <Route path="/call/:sessionId" element={<CallRoom />} />
      <Route path="/admin" element={
        <PrivateRoute><AdminDashboard /></PrivateRoute>
      } />
    </Routes>
  )
}
