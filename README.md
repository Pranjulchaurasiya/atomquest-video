# ⚡ AtomQuest Video Support Platform

> Real-time video support platform built for **AtomQuest Hackathon 1.0**

[![Node.js](https://img.shields.io/badge/Node.js-22.x-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org)
[![mediasoup](https://img.shields.io/badge/mediasoup-SFU-orange)](https://mediasoup.org)
[![License](https://img.shields.io/badge/license-MIT-purple)](LICENSE)

---

## 🎯 Problem Statement

Customer support teams rely on voice calls to resolve product issues — which breaks down the moment a visual is needed. This platform replaces those calls with real-time **video support sessions**, enabling agents to see exactly what the customer sees.

---

## ✨ Features

| Feature | Status |
|---|---|
| WebRTC video calls via mediasoup SFU | ✅ |
| JWT-based role auth (Agent / Customer) | ✅ |
| Invite link system — no customer login needed | ✅ |
| Real-time chat via Socket.io | ✅ |
| Multi-participant video grid | ✅ |
| Mute / Video-off controls | ✅ |
| Call recording (start/stop) | ✅ |
| Admin dashboard — live session monitoring | ✅ |
| Session history & event logs | ✅ |
| No P2P — all media routed through SFU | ✅ |

---

## 🏗️ Architecture

```
Agent (Browser)                    Customer (Browser)
      │                                   │
      │  WebRTC (DTLS/SRTP)               │  WebRTC (DTLS/SRTP)
      │                                   │
      └──────────► mediasoup SFU ◄────────┘
                        │
                   Node.js Server
                (Express + Socket.io)
                        │
              ┌─────────┴──────────┐
           Sessions            Chat/Events
          (In-memory)         (Socket.io)
```

### Why SFU and not MCU?
- **SFU** (Selective Forwarding Unit) just forwards packets — no transcoding
- Low CPU, low latency, highly scalable
- mediasoup handles DTLS/SRTP + ICE automatically

### Why mediasoup?
- Production-grade WebRTC SFU
- Full control over media routing
- No P2P — server is always in the media path

### Role Enforcement
- JWT tokens carry `role: "agent" | "customer"` claim
- Every sensitive endpoint checks role via middleware
- Customers join via invite token — no account needed

---

## 🛠️ Tech Stack

**Backend**
- Node.js + Express
- Socket.io (signaling + chat)
- mediasoup v3 (SFU media server)
- JSON Web Tokens (JWT)

**Frontend**
- React 18 + Vite
- mediasoup-client
- Socket.io-client
- React Router v6

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 22.x
- Linux / macOS (or WSL2 on Windows)
- `build-essential` + `python3` (for mediasoup C++ compilation)

```bash
sudo apt-get install -y build-essential python3
```

### 1. Clone the repo

```bash
git clone https://github.com/Pranjulchaurasiya/atomquest-video.git
cd atomquest-video
```

### 2. Backend Setup

```bash
cd server
npm install
```

Create `.env` file:

```env
PORT=3000
JWT_SECRET=atomquest_super_secret_key_2024
AGENT_PASSWORD=agent123
ANNOUNCED_IP=127.0.0.1
```

Start server:

```bash
node index.js
```

### 3. Frontend Setup

```bash
cd client
npm install
npm run dev
```

### 4. Open in Browser

```
http://localhost:5173
```

---

## 🔐 Demo Credentials

| Role | URL | Credential |
|---|---|---|
| Agent | `http://localhost:5173` | Password: `agent123` |
| Customer | Invite link (auto-generated) | No login needed |

---

## 📱 How It Works

```
1. Agent logs in → opens dashboard
2. Agent creates a support session → gets invite link
3. Agent copies invite link → sends to customer
4. Customer opens link → auto-joins (no login)
5. Both connect via mediasoup SFU
6. Agent can chat, mute, record, end session
7. Admin can monitor all live sessions in real-time
```

---

## 📂 Project Structure

```
atomquest-video/
├── server/
│   ├── index.js          # Express + Socket.io + routes
│   ├── mediasoup.js      # SFU logic (Worker, Router, Transport)
│   ├── .env              # Environment config
│   └── routes/
│       ├── auth.js
│       └── sessions.js
├── client/
│   └── src/
│       ├── App.jsx
│       └── pages/
│           ├── AgentLogin.jsx
│           ├── AgentDashboard.jsx
│           ├── CallRoom.jsx
│           ├── JoinSession.jsx
│           └── AdminDashboard.jsx
└── README.md
```

---

## 🌐 Live Demo

- **Frontend:** https://atomquest-video-two.vercel.app
- **GitHub:** https://github.com/Pranjulchaurasiya/atomquest-video

> Note: Full video functionality requires local setup due to WebRTC UDP port requirements on free cloud tiers.

---

## 👤 Author

**Pranjul Chaurasiya**
AtomQuest Hackathon 1.0
