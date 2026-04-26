<div align="center">

```
  ██████╗ ██████╗ ███╗   ███╗██████╗  █████╗ ██████╗ ███████╗
 ██╔════╝██╔═══██╗████╗ ████║██╔══██╗██╔══██╗██╔══██╗██╔════╝
 ██║     ██║   ██║██╔████╔██║██████╔╝███████║██║  ██║█████╗
 ██║     ██║   ██║██║╚██╔╝██║██╔══██╗██╔══██║██║  ██║██╔══╝
 ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║  ██║██║  ██║██████╔╝███████╗
  ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝
```

### Smart Emergency Response Network

*Real-time public safety pole monitoring and emergency alert management*

![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express)
![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?style=flat-square&logo=socket.io)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=flat-square&logo=vite)
![Gemini](https://img.shields.io/badge/Gemini_AI-2.5_Flash-4285F4?style=flat-square&logo=google)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

</div>

---

## Problem Statement

Public spaces — bus stands, railway platforms, parks — are equipped with safety infrastructure, but most of it is passive. When an SOS button is pressed on a safety pole, **there is no reliable, real-time path from that signal to a human responder**.

Operators in control rooms rely on phone calls, radio, or manual CCTV reviews. This introduces critical delays in life-threatening situations.

**COMRADE** solves this by creating a live, bidirectional communication layer between smart public safety poles and a central operator dashboard:

- A pole sends an SOS → the dashboard lights up **instantly**
- Operators receive an **AI-generated incident summary** in seconds
- Responders can send commands back to the pole (siren, broadcast) **from the dashboard**
- Every incident is logged, searchable, and auditable

---

## Features

### 🚨 Real-time Emergency Alerts
- Instant push notifications via **Socket.io** — zero polling latency
- **Glowing red alert cards** with animated border pulse for active incidents
- **Audio alert sound** via Web Audio API on every new emergency
- **Toast notifications** appear across all dashboard pages, not just the alerts page

### 🤖 Gemini AI Analysis
- Every new alert is analyzed by **Google Gemini 2.5 Flash**
- Returns structured JSON: `Severity`, `Category`, `RecommendedResponse`, `OperatorSummary`
- Categories: Assault, Medical, Theft, Panic, Other
- Graceful fallback mock response if API key is not configured

### 📡 Hardware Pole Integration
- Dedicated public API (`POST /api/pole-alert`, `GET /api/pole-command`)
- Authenticated with a shared `X-Pole-Key` header — no JWT required for hardware
- Poles poll for pending commands (siren on/off, broadcast)
- Compatible with ESP32, Raspberry Pi, or any HTTP-capable microcontroller

### 🗺️ Live Dashboard
- 4 animated stat cards with count-up animation
- **Chart.js** bar chart (7-day alert activity) + doughnut chart (active vs resolved)
- Auto-refreshes every 3 seconds
- `LIVE` badge and real-time timestamp

### 🗼 Pole Management
- Search by ID, name, or location
- Filter by online / offline status
- Enhanced battery progress bars (colour-coded: green/yellow/red)
- Relative last-active time (`6m ago`) + absolute timestamp
- **Click any row** to open a detail modal with quick commands

### ⌁ Command Center
- Send `SIREN_ON` / `SIREN_OFF` to individual poles
- Broadcast emergency messages to all active poles
- Live command log with delivery status

### 📋 Incident History
- Searchable table of all resolved alerts
- Filter by date, priority, pole, or alert type

### ⚡ Demo Simulation Mode
- Floating **`SIMULATE`** button always visible on all pages
- 6 pre-built realistic scenarios (Assault, Medical, Theft, Crowd Panic, Suspicious Object, Fire)
- Pick a specific scenario + target pole, or randomize both
- **Auto-simulation mode** — fires alerts automatically at a configurable interval
- Screen flash + audio on every trigger — perfect for live presentations

### 🔐 Security
- JWT authentication (12h expiry) for all operator endpoints
- `helmet` for secure HTTP response headers
- Configurable CORS whitelist via environment variable
- Rate limiting: 300 req/min (dashboard), 20 req/10s (hardware poles)
- Production startup validation — refuses to start without proper secrets

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Vite + Vanilla JS | SPA with hash-based routing |
| **Styling** | Custom CSS (no framework) | Glassmorphism dark theme, CSS variables |
| **Charts** | Chart.js 4 (CDN) | Alert activity bar + status doughnut |
| **Realtime** | Socket.io Client 4 | Receive push events from backend |
| **Backend** | Node.js 22 + Express 4 | REST API + WebSocket server |
| **Database** | Node.js built-in `node:sqlite` | Zero native compilation, zero binary deps |
| **Realtime** | Socket.io Server 4 | Push alerts, commands, status updates |
| **Auth** | jsonwebtoken + bcryptjs | JWT-signed tokens, bcrypt password hashing |
| **AI** | Google Gemini 2.5 Flash | Incident summarization and classification |
| **Security** | helmet + express-rate-limit | HTTP headers + request throttling |
| **Config** | dotenv | `.env`-based environment configuration |

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                      COMRADE SYSTEM FLOW                        │
└─────────────────────────────────────────────────────────────────┘

  [Public Safety Pole]                    [Operator Dashboard]
        │                                         │
        │  1. SOS button pressed                  │
        │  POST /api/pole-alert                   │
        │  X-Pole-Key: <key>                      │
        │─────────────────────────────────────────▶│
        │                                         │
        │         [Backend — Express + SQLite]    │
        │                   │                     │
        │         2. Validate pole API key        │
        │         3. Call Gemini AI →             │
        │            { Severity, Category,        │
        │              RecommendedResponse,       │
        │              OperatorSummary }          │
        │         4. INSERT alert into DB         │
        │         5. io.emit('new_alert', alert)  │
        │                   │                     │
        │                   └─────────────────────▶│
        │                                         │  6. Alert card appears
        │                                         │  7. Audio plays
        │                                         │  8. Toast notification
        │                                         │
        │  9. Operator sends "SIREN_ON"           │
        │◀─────────────────────────────────────── │
        │                                         │
        │  10. Pole polls GET /api/pole-command   │
        │      → { command: "siren_on" }          │
        │  11. Siren activates                    │
        │  12. Command marked delivered           │
```

### Key Design Decisions

| Decision | Reason |
|---|---|
| `node:sqlite` (built-in) | Zero native compilation — works on any Node 22+ platform without build tools |
| Hash-based SPA routing | No server-side routing config required — deployable on any static host |
| Shared API key for hardware | Keeps firmware simple — no OAuth/JWT flow on microcontrollers |
| Gemini JSON schema prompting | Forces structured output — parsed directly into the UI without post-processing |
| Socket.io global listener in `main.js` | Notifications fire on all pages, not just Live Alerts |

---

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Login with email + password → JWT |
| `POST` | `/api/auth/logout` | Public | Client-side logout hint |

### Dashboard & Stats
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/stats` | JWT | Total poles, online, active alerts, resolved today |
| `GET` | `/api/health` | Public | Health check for load balancers |

### Poles
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/poles` | JWT | List all poles |
| `GET` | `/api/poles/:id` | JWT | Single pole detail |
| `PATCH` | `/api/poles/:id` | JWT | Update pole status / battery |

### Alerts
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/alerts` | JWT | All alerts (optional `?status=active`) |
| `GET` | `/api/alerts/:id` | JWT | Single alert detail |
| `POST` | `/api/alerts` | JWT | Create alert (dashboard simulation) |
| `PATCH` | `/api/alerts/:id/resolve` | JWT | Resolve active alert |

### Commands
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/commands` | JWT | Command log |
| `POST` | `/api/commands` | JWT | Send command to pole |
| `POST` | `/api/commands/broadcast` | JWT | Broadcast message to all poles |

### Hardware Pole (public, API key)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/pole-alert` | `X-Pole-Key` | Report SOS from physical pole |
| `GET` | `/api/pole-command?pole_id=X` | `X-Pole-Key` | Poll for pending command |

#### Hardware Request Examples

```bash
# Report SOS from a pole
curl -X POST http://your-server/api/pole-alert \
  -H "Content-Type: application/json" \
  -H "X-Pole-Key: your-pole-api-key" \
  -d '{"pole_id": "POLE-001", "alert_type": "SOS"}'

# Poll for pending command
curl "http://your-server/api/pole-command?pole_id=POLE-001" \
  -H "X-Pole-Key: your-pole-api-key"
# → {"success":true,"command":"siren_on"}
```

### Socket.io Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `new_alert` | Server → Client | `Alert` object | New alert created |
| `alert_resolved` | Server → Client | `Alert` object | Alert marked resolved |
| `command_executed` | Server → Client | `Command` object | Command delivered to pole |
| `pole_updated` | Server → Client | `Pole` object | Pole status changed |

---

## Database Schema

```sql
-- Smart safety poles
CREATE TABLE poles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pole_id       TEXT UNIQUE NOT NULL,   -- e.g. "POLE-001"
  pole_name     TEXT NOT NULL,
  location_name TEXT NOT NULL,
  latitude      REAL,
  longitude     REAL,
  status        TEXT DEFAULT 'online',  -- 'online' | 'offline'
  battery_level INTEGER DEFAULT 100,
  last_seen     DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Emergency alerts
CREATE TABLE alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pole_id     TEXT NOT NULL,
  alert_type  TEXT DEFAULT 'SOS',
  priority    TEXT DEFAULT 'HIGH',      -- 'CRITICAL' | 'HIGH' | 'MEDIUM'
  status      TEXT DEFAULT 'active',   -- 'active' | 'resolved'
  ai_summary  TEXT,                     -- JSON from Gemini AI
  resolved_at DATETIME,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Commands sent to poles
CREATE TABLE commands (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  pole_id      TEXT NOT NULL,
  command_type TEXT NOT NULL,           -- 'SIREN_ON' | 'SIREN_OFF' | 'BROADCAST'
  status       TEXT DEFAULT 'sent',    -- 'sent' | 'delivered'
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard operators
CREATE TABLE operators (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT DEFAULT 'operator' -- 'admin' | 'operator'
);
```

---

## Deployment Steps

### Prerequisites
- Node.js 22+ (for built-in `node:sqlite`)
- npm 9+

### 1. Clone & Install

```bash
git clone https://github.com/your-org/comrade.git
cd comrade

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env — set JWT_SECRET, POLE_API_KEY, CLIENT_ORIGIN, GEMINI_API_KEY

# Frontend
cd ../frontend
cp .env.example .env
# Edit .env — set VITE_API_BASE to your backend URL
```

### 3. Development

```bash
# Terminal 1 — Backend
cd backend && npm run dev
# → http://localhost:3001

# Terminal 2 — Frontend
cd frontend && npm run dev
# → http://localhost:5173
```

**Demo credentials:** `admin@comrade.gov` / `admin123`

### 4. Production Build

```bash
# Build the frontend SPA
cd frontend && npm run build
# → output in frontend/dist/

# Serve dist/ with any static host (nginx, Caddy, Vercel, Netlify)
```

### 5. Production Backend (PM2)

```bash
npm install -g pm2
cd backend

# Set NODE_ENV=production in .env first!
pm2 start server.js --name comrade-api --node-args="--experimental-sqlite"
pm2 save
pm2 startup   # configure auto-start on reboot
```

### 6. nginx Example (SPA + API Proxy)

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    # Serve Vite build
    root /var/www/comrade/frontend/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API + Socket.io to Node backend
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 7. Docker (optional)

```dockerfile
# backend/Dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3001
CMD ["node", "--experimental-sqlite", "server.js"]
```

### Health Check

```bash
curl https://your-domain.com/api/health
# → {"status":"ok","service":"COMRADE Backend","env":"production","time":"..."}
```

---

## Hardware Integration Guide

### Firmware Logic (ESP32 / Raspberry Pi)

```python
# Python pseudocode for pole firmware
import requests, time

BACKEND   = "https://your-backend.com"
POLE_ID   = "POLE-001"
POLE_KEY  = "your-pole-api-key"
HEADERS   = {"X-Pole-Key": POLE_KEY}

def send_sos():
    requests.post(f"{BACKEND}/api/pole-alert",
        json={"pole_id": POLE_ID, "alert_type": "SOS"},
        headers=HEADERS)

def poll_command():
    r = requests.get(f"{BACKEND}/api/pole-command?pole_id={POLE_ID}",
        headers=HEADERS)
    cmd = r.json().get("command", "none")
    if cmd == "siren_on":  activate_siren()
    if cmd == "siren_off": deactivate_siren()

# Main loop
while True:
    if sos_button_pressed(): send_sos()
    poll_command()
    time.sleep(5)  # poll every 5 seconds
```

---

## Future Scope

| Feature | Description |
|---|---|
| 🗺️ **Live Map View** | Real-time pole map using Leaflet.js or Google Maps — show pole locations, active alert pins |
| 📸 **CCTV Integration** | Embed live camera feed from pole into the alert detail card |
| 📱 **Mobile App** | React Native operator app with push notifications via FCM |
| 🔔 **SMS / WhatsApp Alerts** | Twilio integration — auto-notify assigned responders via SMS |
| 👤 **Multi-Operator Roles** | Role-based access: Admin, Supervisor, Field Officer — with audit logs |
| 📊 **Analytics Dashboard** | Weekly/monthly incident reports, heatmaps, response time metrics |
| 🤖 **Enhanced AI** | Multi-turn Gemini conversation — operators query the AI about ongoing incidents |
| 🔋 **Battery Prediction** | ML model predicts when each pole will need maintenance based on usage patterns |
| 🌐 **Multi-Zone Support** | Partition poles and operators by city/zone — hierarchical access control |
| 🐳 **Full Docker Compose** | One-command deployment with nginx, backend, and automated DB migration |
| 🧪 **Automated Tests** | Jest unit tests for API routes + Playwright E2E tests for dashboard flows |

---

## Project Structure

```
comrade/
├── backend/
│   ├── routes/
│   │   ├── auth.js          # Login / logout
│   │   ├── poles.js         # Pole CRUD
│   │   ├── alerts.js        # Alert management
│   │   ├── commands.js      # Command dispatch
│   │   └── hardware.js      # Pole hardware endpoints
│   ├── ai.js                # Gemini AI integration
│   ├── db.js                # SQLite wrapper + seed data
│   ├── server.js            # Express app + Socket.io
│   ├── .env                 # Local secrets (gitignored)
│   └── .env.example         # Template (committed)
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── sidebar.js       # Nav sidebar + hamburger
│   │   │   ├── toast.js         # Toast notifications
│   │   │   ├── simulator.js     # Demo simulation panel
│   │   │   └── errorBoundary.js # Global JS error handler
│   │   ├── pages/
│   │   │   ├── login.js
│   │   │   ├── dashboard.js     # Stats + charts
│   │   │   ├── liveAlerts.js    # Real-time alert cards
│   │   │   ├── poleManagement.js
│   │   │   ├── incidentHistory.js
│   │   │   └── commandCenter.js
│   │   ├── api.js               # Fetch client + auth helpers
│   │   └── main.js              # Router + Socket.io boot
│   ├── style.css                # Global design system
│   ├── index.html
│   ├── vite.config.js
│   └── .env.example
│
├── .gitignore
└── README.md
```

---

## License

MIT — free to use, modify, and deploy.

---

<div align="center">
  Built with ⚡ for public safety
</div>
