# ⚡ AtomQuest Video Support Platform

Real-time video support platform built for AtomQuest Hackathon 1.0

## 🚀 Features
- WebRTC video calls via mediasoup SFU (no P2P)
- JWT-based role authentication (Agent / Customer)
- Invite link system for customers (no login required)
- Real-time chat via Socket.io
- Call recording support
- Admin dashboard with live session monitoring
- Mute / Video-off controls

## 🛠️ Tech Stack
- **Backend:** Node.js + Express + Socket.io
- **Media Server:** mediasoup (SFU)
- **Frontend:** React + Vite + mediasoup-client
- **Auth:** JWT tokens with role-based access

## 🔐 Demo Credentials
- **Agent Password:** `agent123`
- **Agent URL:** http://localhost:5173
- **Customer:** joins via invite link (no login needed)

## ▶️ Run Locally

### Backend
```bash
cd server
npm install
node index.js
```

### Frontend
```bash
cd client
npm install
npm run dev
```

## 🏗️ Architecture
- Agent logs in → creates session → gets invite link
- Customer opens invite link → JWT validated → joins call
- mediasoup SFU routes all media (no P2P)
- Socket.io handles signaling + chat
- Admin can monitor/end all live sessions

## 👤 Team
Pranjul Chaurasiya — AtomQuest Hackathon 1.0
