# 🧠 StudyMate AI — Backend Server

Complete REST API backend for StudyMate AI.  
Built with **Node.js + Express** | **JWT Auth** | **bcrypt** | Ready to plug into MongoDB.

---

## 🚀 Quick Start

```bash
cd studymate-backend
npm install
npm run dev        # development (with auto-restart)
npm start          # production
```

Server starts at: `http://localhost:3001`

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| `express` | Web server framework |
| `bcryptjs` | Password hashing |
| `jsonwebtoken` | JWT auth tokens |
| `cors` | Cross-Origin requests |
| `nodemon` | Dev auto-restart |

---

## 🔐 Authentication

All protected routes require this header:

```
Authorization: Bearer <your_jwt_token>
```

Token is returned on login/register. Valid for **7 days**.

---

## 📋 All API Endpoints

### 🔑 AUTH

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | ❌ | Create new account |
| POST | `/api/auth/login` | ❌ | Login & get token |
| GET | `/api/auth/me` | ✅ | Get current user info |
| POST | `/api/auth/forgot-password` | ❌ | Request password reset |
| POST | `/api/auth/reset-password` | ❌ | Reset with token |

#### Register
```json
POST /api/auth/register
{
  "name": "Abhijit Kumar",
  "email": "abhijit@example.com",
  "password": "securePass123",
  "institution": "GEC Lakhisarai"
}
```

#### Login
```json
POST /api/auth/login
{
  "email": "abhijit@example.com",
  "password": "securePass123"
}
```

---

### 🎯 QUIZ

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/quiz/questions?count=5&subject=all` | ✅ | Get quiz questions |
| POST | `/api/quiz/submit` | ✅ | Submit answers & earn points |
| GET | `/api/quiz/history` | ✅ | View past attempts |

#### Submit Quiz
```json
POST /api/quiz/submit
{
  "answers": [
    { "questionId": 1, "selectedIndex": 1 },
    { "questionId": 2, "selectedIndex": 1 }
  ]
}
```

---

### 📝 NOTES

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/notes/generate` | ✅ | Generate AI notes (+2 pts) |
| GET | `/api/notes` | ✅ | Get all saved notes |
| DELETE | `/api/notes/:id` | ✅ | Delete a note |

#### Generate Notes
```json
POST /api/notes/generate
{
  "topic": "Photosynthesis"
}
```

---

### 🗓️ TIMETABLE

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/timetable/generate` | ✅ | Generate smart schedule |
| GET | `/api/timetable` | ✅ | Get saved timetable |

#### Generate Timetable
```json
POST /api/timetable/generate
{
  "subjects": [
    { "name": "Physics", "hoursPerDay": 2, "priority": 5 },
    { "name": "Maths", "hoursPerDay": 2.5, "priority": 4 },
    { "name": "Chemistry", "hoursPerDay": 1.5, "priority": 3 }
  ]
}
```

---

### 💬 CHAT

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/chat/send` | ✅ | Send message (+1 pt) |
| GET | `/api/chat/history` | ✅ | Get chat history |
| DELETE | `/api/chat/history` | ✅ | Clear chat history |

#### Send Message
```json
POST /api/chat/send
{
  "message": "Explain photosynthesis"
}
```

---

### 🔥 STREAK

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/streak` | ✅ | Get points & progress |
| GET | `/api/streak/history` | ✅ | Get points history |
| POST | `/api/streak/add` | ✅ | Manually add points |

---

### 📊 PROGRESS

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/progress` | ✅ | Full progress summary |

---

### ⭐ FEEDBACK

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/feedback` | ✅ | Submit feedback (+2 pts) |
| GET | `/api/feedback` | ✅ | View all feedback |

#### Submit Feedback
```json
POST /api/feedback
{
  "rating": 5,
  "features": ["Quiz Feature", "AI Notes", "Chatbot"],
  "message": "Amazing app! Love the streak system."
}
```

---

## 🔥 Points System

| Action | Points |
|---|---|
| Register / Daily Login | +5 pts |
| Correct Quiz Answer | +1 pt each |
| Complete Full Quiz | +5 pts |
| Generate AI Notes | +2 pts |
| Ask AI Question | +1 pt |
| Submit Feedback | +2 pts |

**1000 pts → 50–60% OFF Premium!** 🏆

---

## 🗄️ Connect to MongoDB (Production)

Replace the in-memory `db` with Mongoose:

```bash
npm install mongoose
```

```js
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI);
```

Create models for: `User`, `Note`, `QuizAttempt`, `Timetable`, `ChatMessage`, `Streak`, `Feedback`.

---

## 🌍 Environment Variables

Create a `.env` file:

```env
PORT=3001
JWT_SECRET=your_very_secret_key_here
MONGO_URI=mongodb://localhost:27017/studymate
```

---

## 🔗 Connect Frontend

In your `index.html`, replace the login/register functions:

```js
const API = 'http://localhost:3001';

async function doLogin() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  localStorage.setItem('token', data.token);
  user = data.user;
  afterLogin();
}

// For protected calls:
async function apiCall(endpoint, method = 'GET', body = null) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: body ? JSON.stringify(body) : null
  });
  return res.json();
}