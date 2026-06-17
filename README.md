# Champion Circuit

India's first integrated youth sports & gaming ecosystem.

---

## Project Structure

```
championcircuit/
├── backend/                          ← FastAPI + SQLite
└── championCircuit-main-froneend-old-code/   ← React + Vite frontend
```

---

## Quick Start

### 1. Clone the repo

```bash
git clone git@gitlab.com:championcircuit-team/championcircuit.git
cd championcircuit
```

---

### 2. Backend setup

```bash
cd backend

# Create virtual environment
python3 -m venv .venv

# Install dependencies
.venv/bin/pip install -r requirements.txt

# Copy env file and fill in your values
cp .env.example .env
# Edit .env — set SMTP credentials etc.

# Start the server
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend runs at: **http://127.0.0.1:8000**  
API docs at: **http://127.0.0.1:8000/docs**

#### Seed demo data (run once)
```bash
.venv/bin/python seed_demo.py
```

---

### 3. Frontend setup

```bash
cd froneend

# Install dependencies
npm install

# Copy env file
cp .env.example .env
# .env already has the right defaults for local dev

# Start dev server
npm run dev
```

Frontend runs at: **http://127.0.0.1:5173**

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `SECRET_KEY` | Random string for JWT signing |
| `ENVIRONMENT` | `local` (shows dev OTP) or `production` (email only) |
| `SMTP_PASSWORD` | Gmail App Password — NOT your regular password |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `RAZORPAY_KEY_ID` | From Razorpay dashboard |

### Frontend (`championCircuit-main-froneend-old-code/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL — default `http://127.0.0.1:8000` |

---

## Tech Stack

**Backend:** Python · FastAPI · SQLAlchemy · SQLite · JWT · Razorpay · Gmail SMTP  
**Frontend:** React 18 · TypeScript · Vite · React Router v7 · Framer Motion

---

## Key Features

- Email + OTP signup/login
- Google OAuth login
- City-based filtering (Turf, Esports, Vouchers, Leaderboard)
- Voucher system with QR codes and Razorpay payment
- Partner referral links (`/vouchers?ref=TOKEN`)
- Guest voucher checkout (no login needed)
- Profile with avatar upload, interests, city
- Leaderboard with sport filter

---

## Notes

- Never commit `.env` files — they contain secrets
- The `backend/uploads/` folder stores user avatars — not committed to git
- SQLite DB (`champion_circuit.db`) is local only — not committed
