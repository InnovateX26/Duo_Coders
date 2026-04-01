/**
 * StudyMate AI — Complete Backend Server
 * Node.js + Express | JWT Auth | In-Memory DB (swap with MongoDB easily)
 * Author: Abhijit Kumar & Ankit Raj Patwa
 */

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 0;
const JWT_SECRET = process.env.JWT_SECRET || "studymate_secret_key_change_in_production";
const JWT_EXPIRES = "7d";

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// ─────────────────────────────────────────────
// IN-MEMORY DATABASE (Replace with MongoDB/PostgreSQL in production)
// ─────────────────────────────────────────────
const db = {
  users: new Map(),          // email -> user object
  streaks: new Map(),        // userId -> streak data
  quizAttempts: new Map(),   // userId -> [attempts]
  notes: new Map(),          // userId -> [notes]
  timetables: new Map(),     // userId -> timetable
  chatHistory: new Map(),    // userId -> [messages]
  feedback: [],              // all feedback
  resetTokens: new Map(),    // token -> { email, expires }
};

// ─────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ error: "Unauthorized. Please login." });

  try {
    const token = header.split(" ")[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

function log(req, _res, next) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
}
app.use(log);

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function getOrCreate(map, key, defaultVal) {
  if (!map.has(key)) map.set(key, defaultVal);
  return map.get(key);
}

function addPointsToUser(userId, amount, label) {
  const streak = getOrCreate(db.streaks, userId, {
    points: 0,
    history: [],
    lastLogin: null,
    loginStreak: 0,
  });
  streak.points += amount;
  streak.history.unshift({ label, pts: amount, time: new Date().toISOString() });
  if (streak.history.length > 20) streak.history.pop();
  db.streaks.set(userId, streak);
  return streak;
}

// ─────────────────────────────────────────────
// QUIZ QUESTION BANK
// ─────────────────────────────────────────────
const questionBank = [
  { id: 1, q: "What is the powerhouse of the cell?", opts: ["Nucleus", "Mitochondria", "Ribosome", "Golgi Body"], a: 1, subject: "Biology", difficulty: "easy" },
  { id: 2, q: "Which law states F = ma?", opts: ["Newton's 1st Law", "Newton's 2nd Law", "Newton's 3rd Law", "Boyle's Law"], a: 1, subject: "Physics", difficulty: "easy" },
  { id: 3, q: "What is H₂O commonly known as?", opts: ["Hydrogen Peroxide", "HCl", "Water", "Ammonia"], a: 2, subject: "Chemistry", difficulty: "easy" },
  { id: 4, q: "Father of computers?", opts: ["Alan Turing", "Charles Babbage", "Bill Gates", "Ada Lovelace"], a: 1, subject: "General", difficulty: "medium" },
  { id: 5, q: "Chemical symbol for Gold?", opts: ["Gd", "Go", "Au", "Ag"], a: 2, subject: "Chemistry", difficulty: "easy" },
  { id: 6, q: "Planet closest to the Sun?", opts: ["Venus", "Earth", "Mars", "Mercury"], a: 3, subject: "Science", difficulty: "easy" },
  { id: 7, q: "Square root of 144?", opts: ["11", "12", "13", "14"], a: 1, subject: "Maths", difficulty: "easy" },
  { id: 8, q: "India gained independence in?", opts: ["1945", "1946", "1947", "1948"], a: 2, subject: "History", difficulty: "easy" },
  { id: 9, q: "Which gas do plants absorb during photosynthesis?", opts: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"], a: 2, subject: "Biology", difficulty: "easy" },
  { id: 10, q: "How many bones does an adult human body have?", opts: ["196", "206", "216", "226"], a: 1, subject: "Biology", difficulty: "medium" },
  { id: 11, q: "What is the value of Pi (approx)?", opts: ["3.14159", "2.71828", "1.61803", "1.41421"], a: 0, subject: "Maths", difficulty: "easy" },
  { id: 12, q: "Which is the largest planet in our solar system?", opts: ["Saturn", "Neptune", "Jupiter", "Uranus"], a: 2, subject: "Science", difficulty: "easy" },
  { id: 13, q: "What does CPU stand for?", opts: ["Central Processing Unit", "Computer Personal Unit", "Core Processing Unit", "Central Program Unit"], a: 0, subject: "Computer", difficulty: "easy" },
  { id: 14, q: "Who wrote 'Discovery of India'?", opts: ["M.K. Gandhi", "B.R. Ambedkar", "Jawaharlal Nehru", "Subhas Bose"], a: 2, subject: "History", difficulty: "medium" },
  { id: 15, q: "Speed of light (approx)?", opts: ["3×10⁸ m/s", "3×10⁶ m/s", "3×10¹⁰ m/s", "3×10⁴ m/s"], a: 0, subject: "Physics", difficulty: "medium" },
];

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────

// ── ROOT ──
app.get("/", (_req, res) => {
  res.json({
    app: "StudyMate AI Backend",
    version: "1.0.0",
    status: "running",
    endpoints: {
      auth: ["/api/auth/register", "/api/auth/login", "/api/auth/me", "/api/auth/forgot-password", "/api/auth/reset-password"],
      quiz: ["/api/quiz/questions", "/api/quiz/submit"],
      notes: ["/api/notes/generate", "/api/notes", "/api/notes/:id"],
      timetable: ["/api/timetable/generate", "/api/timetable"],
      chat: ["/api/chat/send", "/api/chat/history"],
      streak: ["/api/streak", "/api/streak/history"],
      progress: ["/api/progress"],
      feedback: ["/api/feedback"],
    },
  });
});

// ────────────────────────────────────────────────
// AUTH ROUTES
// ────────────────────────────────────────────────

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, institution } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "Name, email and password are required." });
    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    if (db.users.has(email.toLowerCase()))
      return res.status(409).json({ error: "User with this email already exists." });

    const hashed = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const user = {
      id: userId,
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashed,
      institution: institution || "",
      createdAt: new Date().toISOString(),
      avatar: name.trim()[0].toUpperCase(),
    };
    db.users.set(email.toLowerCase(), user);

    // Award signup bonus
    addPointsToUser(userId, 5, "🗓️ Welcome Bonus");

    const token = jwt.sign({ id: userId, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.status(201).json({
      message: "Account created successfully!",
      token,
      user: { id: userId, name: user.name, email: user.email, institution: user.institution, avatar: user.avatar },
    });
  } catch (e) {
    res.status(500).json({ error: "Server error during registration." });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });

    const user = db.users.get(email.toLowerCase());
    if (!user) return res.status(404).json({ error: "No account found with this email." });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Incorrect password." });

    // Daily login bonus (once per day)
    const streak = getOrCreate(db.streaks, user.id, { points: 0, history: [], lastLogin: null, loginStreak: 0 });
    const today = new Date().toDateString();
    if (streak.lastLogin !== today) {
      addPointsToUser(user.id, 5, "🗓️ Daily Login Bonus");
      streak.lastLogin = today;
      streak.loginStreak = (streak.loginStreak || 0) + 1;
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({
      message: "Login successful!",
      token,
      user: { id: user.id, name: user.name, email: user.email, institution: user.institution, avatar: user.avatar },
      streak: db.streaks.get(user.id),
    });
  } catch (e) {
    res.status(500).json({ error: "Server error during login." });
  }
});

// GET /api/auth/me
app.get("/api/auth/me", auth, (req, res) => {
  const user = [...db.users.values()].find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ id: user.id, name: user.name, email: user.email, institution: user.institution, avatar: user.avatar });
});

// POST /api/auth/forgot-password
app.post("/api/auth/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required." });
  if (!db.users.has(email.toLowerCase()))
    return res.status(404).json({ error: "No account with this email." });

  const token = crypto.randomBytes(32).toString("hex");
  db.resetTokens.set(token, { email: email.toLowerCase(), expires: Date.now() + 3600000 }); // 1hr
  console.log(`[PASSWORD RESET] Token for ${email}: ${token}`);
  res.json({ message: "Password reset link sent! (Check console in dev mode)", token }); // Remove token from response in production
});

// POST /api/auth/reset-password
app.post("/api/auth/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: "Token and new password required." });

  const data = db.resetTokens.get(token);
  if (!data || data.expires < Date.now())
    return res.status(400).json({ error: "Reset link is invalid or expired." });

  const user = db.users.get(data.email);
  if (!user) return res.status(404).json({ error: "User not found." });

  user.password = await bcrypt.hash(newPassword, 10);
  db.users.set(data.email, user);
  db.resetTokens.delete(token);
  res.json({ message: "Password reset successfully! Please login." });
});

// ────────────────────────────────────────────────
// QUIZ ROUTES
// ────────────────────────────────────────────────

// GET /api/quiz/questions?count=5&subject=all
app.get("/api/quiz/questions", auth, (req, res) => {
  const count = Math.min(parseInt(req.query.count) || 5, 15);
  const subject = req.query.subject || "all";

  let pool = subject === "all" ? [...questionBank] : questionBank.filter((q) => q.subject.toLowerCase() === subject.toLowerCase());
  if (!pool.length) pool = [...questionBank];

  // Shuffle
  const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, count);
  // Don't send correct answer index to client
  const safe = shuffled.map(({ id, q, opts, subject, difficulty }) => ({ id, q, opts, subject, difficulty }));
  res.json({ questions: safe, total: safe.length });
});

// POST /api/quiz/submit
app.post("/api/quiz/submit", auth, (req, res) => {
  const { answers } = req.body; // [{ questionId, selectedIndex }]
  if (!Array.isArray(answers)) return res.status(400).json({ error: "Answers array required." });

  let correctCount = 0;
  const results = answers.map(({ questionId, selectedIndex }) => {
    const q = questionBank.find((x) => x.id === questionId);
    if (!q) return { questionId, correct: false, correctIndex: null };
    const isCorrect = selectedIndex === q.a;
    if (isCorrect) correctCount++;
    return { questionId, correct: isCorrect, correctIndex: q.a, question: q.q };
  });

  // Save attempt
  const attempts = getOrCreate(db.quizAttempts, req.user.id, []);
  attempts.push({ date: new Date().toISOString(), score: correctCount, total: answers.length, results });
  db.quizAttempts.set(req.user.id, attempts);

  // Points: +1 per correct, +5 for completing
  let totalPts = correctCount;
  const streak = addPointsToUser(req.user.id, correctCount, `✅ ${correctCount} Correct Quiz Answers`);
  addPointsToUser(req.user.id, 5, "🎯 Completed Full Quiz");
  totalPts += 5;

  res.json({
    message: "Quiz submitted!",
    score: correctCount,
    total: answers.length,
    pointsEarned: totalPts,
    currentStreak: db.streaks.get(req.user.id)?.points || 0,
    results,
  });
});

// GET /api/quiz/history
app.get("/api/quiz/history", auth, (req, res) => {
  const attempts = db.quizAttempts.get(req.user.id) || [];
  res.json({ attempts: attempts.slice(-10).reverse(), total: attempts.length });
});

// ────────────────────────────────────────────────
// NOTES ROUTES
// ────────────────────────────────────────────────

// POST /api/notes/generate
app.post("/api/notes/generate", auth, (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: "Topic is required." });

  // Simulate AI-generated structured notes
  const noteId = crypto.randomUUID();
  const note = {
    id: noteId,
    topic: topic.trim(),
    createdAt: new Date().toISOString(),
    content: {
      introduction: `${topic} is a fundamental concept in academics. Understanding it thoroughly builds a strong foundation for advanced study.`,
      keyPoints: [
        `Definition: The core meaning and scope of ${topic}`,
        `Historical Background: Origin, discovery or development of ${topic}`,
        `Core Principles: The main rules, laws, and frameworks that govern ${topic}`,
        `Real-World Applications: Where and how ${topic} is applied in the modern world`,
        `Common Misconceptions: Frequent mistakes students make about ${topic}`,
      ],
      examples: [
        `Practical Example 1: A real-world scenario that demonstrates ${topic}`,
        `Practical Example 2: A scientific or technical application of ${topic}`,
        `Practice Problem: Solve a question based on ${topic} to test your understanding`,
      ],
      keyFormula: `Remember the most important formula, rule, or mnemonic related to ${topic}.`,
      quickRevision: `Focus on definitions, key formulas, and examples. Review this 24 hours before your exam for best retention!`,
      examTips: [
        "Start answers with a clear definition",
        "Include diagrams where applicable",
        "Mention real-world examples",
        "State formulas explicitly with units",
      ],
    },
  };

  // Save note
  const notes = getOrCreate(db.notes, req.user.id, []);
  notes.unshift(note);
  db.notes.set(req.user.id, notes);

  // Award points
  addPointsToUser(req.user.id, 2, "📝 Generated AI Notes");

  res.status(201).json({ message: "Notes generated!", note, pointsEarned: 2, currentStreak: db.streaks.get(req.user.id)?.points || 0 });
});

// GET /api/notes — get all notes for user
app.get("/api/notes", auth, (req, res) => {
  const notes = db.notes.get(req.user.id) || [];
  res.json({ notes, total: notes.length });
});

// DELETE /api/notes/:id
app.delete("/api/notes/:id", auth, (req, res) => {
  const notes = db.notes.get(req.user.id) || [];
  const updated = notes.filter((n) => n.id !== req.params.id);
  if (updated.length === notes.length) return res.status(404).json({ error: "Note not found." });
  db.notes.set(req.user.id, updated);
  res.json({ message: "Note deleted." });
});

// ────────────────────────────────────────────────
// TIMETABLE ROUTES
// ────────────────────────────────────────────────

// POST /api/timetable/generate
app.post("/api/timetable/generate", auth, (req, res) => {
  const { subjects } = req.body; // [{ name, hoursPerDay, priority }]
  if (!Array.isArray(subjects) || !subjects.length)
    return res.status(400).json({ error: "Subjects array is required." });

  // Sort by priority descending
  const sorted = [...subjects].sort((a, b) => (b.priority || 3) - (a.priority || 3));

  const schedule = [];
  let currentHour = 6; // Start at 6 AM

  const fmt = (h) => {
    const hh = Math.floor(h % 24);
    const mm = h % 1 === 0.5 ? "30" : "00";
    const period = hh >= 12 ? "PM" : "AM";
    const display = hh > 12 ? hh - 12 : hh || 12;
    return `${display}:${mm} ${period}`;
  };

  sorted.forEach((sub) => {
    if (!sub.name || !sub.hoursPerDay) return;
    const start = fmt(currentHour);
    currentHour += parseFloat(sub.hoursPerDay);
    const end = fmt(currentHour);
    schedule.push({ subject: sub.name, startTime: start, endTime: end, hours: sub.hoursPerDay, priority: sub.priority || 3, breakAfter: "30 min" });
    currentHour += 0.5; // 30 min break
  });

  const timetable = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), schedule };
  db.timetables.set(req.user.id, timetable);
  res.status(201).json({ message: "Timetable generated!", timetable });
});

// GET /api/timetable — get saved timetable
app.get("/api/timetable", auth, (req, res) => {
  const tt = db.timetables.get(req.user.id);
  if (!tt) return res.status(404).json({ error: "No timetable found. Generate one first!" });
  res.json({ timetable: tt });
});

// ────────────────────────────────────────────────
// CHAT ROUTES
// ────────────────────────────────────────────────
const aiKnowledge = {
  photosynthesis: "🌿 Photosynthesis is the process by which plants make food using sunlight, water, and CO₂. Formula: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂. Chlorophyll in chloroplasts absorbs light. Two stages: Light reactions (thylakoid) and Calvin Cycle (stroma).",
  newton: "⚡ Newton's Three Laws of Motion:\n1. Inertia: An object at rest stays at rest.\n2. F = ma (Force = mass × acceleration)\n3. Action-Reaction: Every action has equal & opposite reaction.\nThese are the foundation of classical mechanics!",
  python: "🐍 Python Basics: Variables, data types (int, str, list, dict), control flow (if/else, for, while), functions (def), OOP (class). Key libraries: NumPy, Pandas, Matplotlib. Start: print('Hello, World!'). Python is great for AI/ML, web dev, and scripting!",
  integration: "∫ Integration is the reverse of differentiation. ∫xⁿ dx = xⁿ⁺¹/(n+1) + C. It calculates area under a curve. Types: Definite (gives a number with limits) & Indefinite (gives function + constant C). Methods: Substitution, Parts, Partial Fractions.",
  derivative: "📐 Derivative = instantaneous rate of change. d/dx(xⁿ) = nxⁿ⁻¹. Chain Rule: d/dx[f(g(x))] = f'(g(x))·g'(x). Used for finding: slopes, maxima/minima, and rates of change in physics and economics.",
  ohm: "⚡ Ohm's Law: V = IR (Voltage = Current × Resistance). At constant temperature, current is directly proportional to voltage. Resistance is measured in Ohms (Ω). Power P = VI = I²R = V²/R.",
  photon: "💡 A photon is a quantum of light — a particle of electromagnetic radiation with no rest mass. Energy E = hf (h = Planck's constant = 6.626×10⁻³⁴ Js, f = frequency). Photons travel at 3×10⁸ m/s in vacuum.",
  osmosis: "💧 Osmosis is the movement of water molecules through a semipermeable membrane from a region of lower solute concentration to higher solute concentration. Important in biology for cell function, absorption, and kidney filtration.",
  java: "☕ Java is an object-oriented, platform-independent language. Key concepts: Classes, Objects, Inheritance, Polymorphism, Encapsulation, Abstraction. JVM makes it 'Write Once, Run Anywhere'. Used in Android development and enterprise applications.",
};

// POST /api/chat/send
app.post("/api/chat/send", auth, (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message is required." });

  const msgLower = message.toLowerCase();
  const key = Object.keys(aiKnowledge).find((k) => msgLower.includes(k));
  const reply = key
    ? aiKnowledge[key]
    : `🤖 Great question about "${message}"! Here's how to approach it:\n\n1️⃣ Start with the basic definition\n2️⃣ Understand the core concept\n3️⃣ Look at real-world examples\n4️⃣ Practice with problems\n\nFor a detailed explanation, try searching this specific topic! 📚`;

  // Save to chat history
  const history = getOrCreate(db.chatHistory, req.user.id, []);
  history.push({ role: "user", content: message, time: new Date().toISOString() });
  history.push({ role: "ai", content: reply, time: new Date().toISOString() });
  if (history.length > 100) history.splice(0, 2); // Keep last 50 exchanges
  db.chatHistory.set(req.user.id, history);

  // Award points
  addPointsToUser(req.user.id, 1, "💬 Asked AI Question");

  res.json({ reply, pointsEarned: 1, currentStreak: db.streaks.get(req.user.id)?.points || 0 });
});

// GET /api/chat/history
app.get("/api/chat/history", auth, (req, res) => {
  const history = db.chatHistory.get(req.user.id) || [];
  res.json({ history, total: history.length });
});

// DELETE /api/chat/history
app.delete("/api/chat/history", auth, (req, res) => {
  db.chatHistory.set(req.user.id, []);
  res.json({ message: "Chat history cleared." });
});

// ────────────────────────────────────────────────
// STREAK ROUTES
// ────────────────────────────────────────────────

// GET /api/streak
app.get("/api/streak", auth, (req, res) => {
  const streak = db.streaks.get(req.user.id) || { points: 0, history: [], loginStreak: 0 };
  const target = 1000;
  const progress = Math.min(100, (streak.points / target) * 100);
  const remaining = Math.max(0, target - streak.points);
  const premiumUnlocked = streak.points >= target;

  res.json({ points: streak.points, target, progress: progress.toFixed(1), remaining, premiumUnlocked, loginStreak: streak.loginStreak || 0 });
});

// GET /api/streak/history
app.get("/api/streak/history", auth, (req, res) => {
  const streak = db.streaks.get(req.user.id) || { history: [] };
  res.json({ history: streak.history.slice(0, 20) });
});

// POST /api/streak/add — manually add points (for testing or custom actions)
app.post("/api/streak/add", auth, (req, res) => {
  const { points, label } = req.body;
  if (!points || !label) return res.status(400).json({ error: "Points and label required." });
  const streak = addPointsToUser(req.user.id, parseInt(points), label);
  res.json({ message: "Points added!", currentPoints: streak.points });
});

// ────────────────────────────────────────────────
// PROGRESS ROUTES
// ────────────────────────────────────────────────

// GET /api/progress
app.get("/api/progress", auth, (req, res) => {
  const attempts = db.quizAttempts.get(req.user.id) || [];
  const notes = db.notes.get(req.user.id) || [];
  const chatCount = (db.chatHistory.get(req.user.id) || []).filter((m) => m.role === "user").length;
  const streak = db.streaks.get(req.user.id) || { points: 0 };

  // Static subject progress (in real app, track per subject)
  const subjects = [
    { name: "Physics", progress: 72, topicsDone: 8, totalTopics: 11 },
    { name: "Mathematics", progress: 58, topicsDone: 7, totalTopics: 12 },
    { name: "Chemistry", progress: 85, topicsDone: 10, totalTopics: 12 },
    { name: "Computer Science", progress: 91, topicsDone: 9, totalTopics: 10 },
  ];

  const totalQuestions = attempts.reduce((s, a) => s + a.total, 0);
  const totalCorrect = attempts.reduce((s, a) => s + a.score, 0);
  const accuracy = totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(1) : 0;

  res.json({
    summary: {
      totalQuizAttempts: attempts.length,
      totalQuestionsAnswered: totalQuestions,
      totalCorrect,
      accuracy: `${accuracy}%`,
      notesGenerated: notes.length,
      questionsAsked: chatCount,
      streakPoints: streak.points,
    },
    subjects,
    weeklyHours: [2, 3, 1.5, 4, 2.5, 5, 3.5], // Static for demo
    classRank: "#12",
  });
});

// ────────────────────────────────────────────────
// FEEDBACK ROUTES
// ────────────────────────────────────────────────

// POST /api/feedback
app.post("/api/feedback", auth, (req, res) => {
  const { rating, features, message } = req.body;
  if (!rating || rating < 1 || rating > 5)
    return res.status(400).json({ error: "Rating between 1–5 is required." });

  const fb = {
    id: crypto.randomUUID(),
    userId: req.user.id,
    userName: req.user.name,
    rating,
    features: features || [],
    message: message || "",
    createdAt: new Date().toISOString(),
  };
  db.feedback.push(fb);

  // Award points
  addPointsToUser(req.user.id, 2, "⭐ Submitted Feedback");

  res.status(201).json({ message: "Feedback submitted! Thank you 🎉", pointsEarned: 2, currentStreak: db.streaks.get(req.user.id)?.points || 0 });
});

// GET /api/feedback — admin view all feedback
app.get("/api/feedback", auth, (req, res) => {
  // In production, restrict this to admin only
  const avgRating = db.feedback.length
    ? (db.feedback.reduce((s, f) => s + f.rating, 0) / db.feedback.length).toFixed(1)
    : 0;
  res.json({ feedback: db.feedback, total: db.feedback.length, averageRating: avgRating });
});

// ────────────────────────────────────────────────
// 404 & ERROR HANDLER
// ────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Route not found." }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`\n🧠 StudyMate AI Backend running on http://localhost:${PORT}`);
  console.log(`📋 API Docs: http://localhost:${PORT}/\n`);
});

module.exports = app;