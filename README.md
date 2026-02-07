# Chalice of the King 🍷👑
Chalice of the King is a high-stakes, web-based multiplayer game of **deception**, **strategy**, and **survival**. Inspired by *Buckshot Roulette*, players face off over poisoned and safe goblets — choosing whether to drink, pass, bluff, or strike.

## 🎮 Play Now

👉 [Live](https://chalice-of-the-king.vercel.app/)

---

## 🧠 Game Summary

Each round begins with a known number of poisoned and safe goblets. Your turn, your move:

* **Drink:** Take a calculated risk for potential reward.
* **Offer:** Pass the goblet — and reveal hidden information about your hand.
* **Artifacts:** Use special one-time powers to manipulate the round or gather intel.
* **Victory:** Survive longer than your opponents through deduction, deception, and perfect timing.

---

## ✨ Features

* 🧠 **Custom AI Opponent** (Single Player Mode)
* 🌐 **Real-time Multiplayer** (up to 4 players)
* 🔊 **Built-in Voice Chat** with WebRTC
* 📜 **Interactive Tutorial** with Shepherd.js
* 📱 **Fully Responsive**: Works on desktop & mobile
* 🧰 **Strategic Artifacts** that shift gameplay dynamics

---

## ⚙️ Tech Stack

| Layer         | Technology                       |
| ------------- | -------------------------------- |
| Frontend      | React, TypeScript, Tailwind CSS  |
| Game Logic    | Custom state management & engine |
| Realtime Comm | WebSockets (Socket.IO)           |
| Voice Chat    | WebRTC (peer-to-peer audio)      |
| Backend       | Node.js, Express                 |
| State Store   | Redis (distributed sessions)     |
| Onboarding    | Shepherd.js                      |
| Deployment    | Vercel / Render / Custom server  |

---

## 🚀 Local Setup Instructions

### 1. Clone the Repo

```bash
git clone https://github.com/Gourav1632/chalice-of-the-king.git
cd chalice-of-the-king
```

### 2. Install Dependencies

#### Frontend

```bash
cd frontend
npm install
```

#### Backend

```bash
cd ../backend
npm install
```

### 3. Start Redis (Required)

The backend now uses Redis for distributed state management. Start Redis using Docker:

```bash
docker compose -f docker-compose.dev.yml up -d
```

**Alternative (without Docker):**
Install Redis locally:
- macOS: `brew install redis && brew services start redis`
- Ubuntu: `sudo apt install redis-server && sudo systemctl start redis`
- Windows: Use [Windows Subsystem for Linux (WSL)](https://redis.io/docs/getting-started/installation/install-redis-on-windows/)

Verify Redis is running:
```bash
redis-cli ping  # Should return "PONG"
```

### 4. Environment Variables

Copy the example environment file and configure:

```bash
cd backend
cp .env.example .env
# Edit .env if needed (defaults should work for local development)
```

### 5. Start the Development Server

#### In separate terminals:

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

By default, the frontend runs on `http://localhost:5173` and backend on `http://localhost:3001`.

---

## 📁 Project Structure

```
chalice-of-the-king/
│
├── frontend/             # React frontend (Vite + TS)
│   ├── src/
│   ├── public/
│
├── backend/             # Node.js backend
│   ├── src/
│
├── shared/             # Shared repository for game logic
│   ├── gameLogic/
│
├── README.md
└── ...
```

---

## 🧪 Testing

* Multiplayer works best in separate browser windows or tabs.
* Voice chat requires mic permission.
---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork this repository
2. Create a branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add cool feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Create a new Pull Request

---

## 🚩 Credits

* Game concept inspired by *Buckshot Roulette*
* Built from scratch by [Gourav Kumar](https://gouravkumar.netlify.app/)

---

**Survive. Deceive. Win the crown.**
