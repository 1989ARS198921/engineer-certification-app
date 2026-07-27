const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'engineer_certification_secret_key_2024';

const DATA_FILE = path.join(__dirname, 'data', 'tickets.json');
const THEORY_FILE = path.join(__dirname, 'data', 'theory.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../frontend')));

// ===== ХЕЛПЕРЫ =====
const loadData = () => {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } 
    catch { return []; }
};
const saveData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');

const loadTheory = () => {
    try { return JSON.parse(fs.readFileSync(THEORY_FILE, 'utf8')); } 
    catch { return {}; }
};
const saveTheory = (data) => fs.writeFileSync(THEORY_FILE, JSON.stringify(data, null, 2), 'utf8');

const loadUsers = () => {
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } 
    catch { return []; }
};
const saveUsers = (users) => fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');

// ===== АУТЕНТИФИКАЦИЯ =====
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    const users = loadUsers();
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ success: false, error: 'Пользователь уже существует' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: Date.now(),
        username,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
        results: {},
        stats: { totalTests: 0, totalCorrect: 0, totalQuestions: 0, bestScore: 0, bestSection: '' }
    };
    users.push(newUser);
    saveUsers(users);
    const token = jwt.sign({ id: newUser.id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: newUser.id, username: newUser.username } });
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const users = loadUsers();
    const user = users.find(u => u.username === username);
    if (!user) return res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user.id, username: user.username } });
});

app.get('/api/auth/me', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const users = loadUsers();
        const user = users.find(u => u.id === decoded.id);
        if (!user) return res.status(401).json({ success: false, error: 'User not found' });
        res.json({ success: true, user: { id: user.id, username: user.username, stats: user.stats } });
    } catch (e) { res.status(401).json({ success: false, error: 'Invalid token' }); }
});

// ===== РЕЗУЛЬТАТЫ =====
app.post('/api/results', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { section, correct, total } = req.body;
        const users = loadUsers();
        const userIndex = users.findIndex(u => u.id === decoded.id);
        if (userIndex === -1) return res.status(401).json({ success: false, error: 'User not found' });
        const user = users[userIndex];
        if (!user.results) user.results = {};
        if (!user.results[section]) user.results[section] = [];
        user.results[section].push({
            date: new Date().toISOString(),
            correct,
            total,
            percentage: Math.round((correct / total) * 100)
        });
        if (!user.stats) user.stats = {};
        user.stats.totalTests = (user.stats.totalTests || 0) + 1;
        user.stats.totalCorrect = (user.stats.totalCorrect || 0) + correct;
        user.stats.totalQuestions = (user.stats.totalQuestions || 0) + total;
        const currentPercentage = Math.round((correct / total) * 100);
        if (currentPercentage > (user.stats.bestScore || 0)) {
            user.stats.bestScore = currentPercentage;
            user.stats.bestSection = section;
        }
        saveUsers(users);
        res.json({ success: true });
    } catch (e) { res.status(401).json({ success: false, error: 'Invalid token' }); }
});

app.get('/api/results', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const users = loadUsers();
        const user = users.find(u => u.id === decoded.id);
        if (!user) return res.status(401).json({ success: false, error: 'User not found' });
        res.json({ success: true, results: user.results || {}, stats: user.stats || {} });
    } catch (e) { res.status(401).json({ success: false, error: 'Invalid token' }); }
});

app.get('/api/leaderboard', (req, res) => {
    const users = loadUsers();
    const leaderboard = users
        .filter(u => u.stats && u.stats.totalTests > 0)
        .map(u => ({
            username: u.username,
            totalTests: u.stats.totalTests || 0,
            bestScore: u.stats.bestScore || 0,
            bestSection: u.stats.bestSection || '',
            averageScore: u.stats.totalQuestions > 0 
                ? Math.round((u.stats.totalCorrect / u.stats.totalQuestions) * 100)
                : 0
        }))
        .sort((a, b) => b.bestScore - a.bestScore);
    res.json(leaderboard);
});

// ===== API ДЛЯ КОНТЕНТА =====
app.get('/api/sections', (req, res) => {
    const data = loadData();
    if (!Array.isArray(data) || data.length === 0) return res.json([]);
    res.json(data.map(item => item.section));
});

app.get('/api/questions/:section', (req, res) => {
    const section = decodeURIComponent(req.params.section);
    const data = loadData();
    if (!Array.isArray(data)) return res.status(404).json({ error: 'Данные не загружены' });
    const ticket = data.find(item => item.section === section);
    if (!ticket) return res.status(404).json({ error: 'Раздел не найден' });
    res.json(ticket.questions || []);
});

app.get('/api/data', (req, res) => {
    const data = loadData();
    if (!Array.isArray(data)) return res.json([]);
    res.json(data);
});

app.get('/api/theory/:section', (req, res) => {
    const section = decodeURIComponent(req.params.section);
    const theory = loadTheory();
    const result = theory[section];
    if (!result) return res.status(404).json({ error: 'Теория не найдена' });
    res.json(result);
});

// ===== АДМИН-API (с защитой паролем) =====
const ADMIN_PASSWORD = 'admin123';

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Неверный пароль' });
    }
});

// Проверка админ-токена
const checkAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader === `Bearer ${ADMIN_PASSWORD}`) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
};

app.get('/api/admin/questions', checkAdmin, (req, res) => {
    const data = loadData();
    if (!Array.isArray(data)) return res.json([]);
    res.json(data);
});

app.get('/api/admin/question/:id', checkAdmin, (req, res) => {
    const data = loadData();
    if (!Array.isArray(data)) return res.status(404).json({ error: 'Нет данных' });
    const id = parseInt(req.params.id);
    for (const ticket of data) {
        if (!ticket.questions) continue;
        const question = ticket.questions.find(q => q.id === id);
        if (question) return res.json({ section: ticket.section, question });
    }
    res.status(404).json({ error: 'Вопрос не найден' });
});

app.post('/api/admin/question', checkAdmin, (req, res) => {
    const { section, question } = req.body;
    let data = loadData();
    if (!Array.isArray(data)) data = [];
    let ticket = data.find(item => item.section === section);
    if (!ticket) { ticket = { section, questions: [] }; data.push(ticket); }
    const maxId = data.flatMap(t => t.questions || []).reduce((max, q) => Math.max(max, q.id || 0), 0);
    question.id = maxId + 1;
    if (!ticket.questions) ticket.questions = [];
    ticket.questions.push(question);
    saveData(data);
    res.json({ success: true, id: question.id });
});

app.put('/api/admin/question/:id', checkAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    const { section, question } = req.body;
    let data = loadData();
    if (!Array.isArray(data)) data = [];
    for (const ticket of data) {
        if (!ticket.questions) continue;
        const index = ticket.questions.findIndex(q => q.id === id);
        if (index !== -1) { ticket.questions.splice(index, 1); break; }
    }
    let ticket = data.find(item => item.section === section);
    if (!ticket) { ticket = { section, questions: [] }; data.push(ticket); }
    if (!ticket.questions) ticket.questions = [];
    question.id = id;
    ticket.questions.push(question);
    saveData(data);
    res.json({ success: true });
});

app.delete('/api/admin/question/:id', checkAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    const data = loadData();
    if (!Array.isArray(data)) return res.status(404).json({ error: 'Нет данных' });
    for (const ticket of data) {
        if (!ticket.questions) continue;
        const index = ticket.questions.findIndex(q => q.id === id);
        if (index !== -1) { ticket.questions.splice(index, 1); saveData(data); return res.json({ success: true }); }
    }
    res.status(404).json({ error: 'Вопрос не найден' });
});

app.get('/api/admin/theory', checkAdmin, (req, res) => {
    res.json(loadTheory());
});

app.put('/api/admin/theory', checkAdmin, (req, res) => {
    saveTheory(req.body);
    res.json({ success: true });
});

// ===== ЗАПУСК =====
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
    console.log(`📝 Админ-панель: http://localhost:${PORT}/admin.html`);
    console.log(`🔑 Пароль админа: admin123`);
});