const API_URL = window.location.origin; // или 'https://engineer-certification-app-2ulj.onrender.com'

let state = {
    sections: [],
    currentSection: '',
    questions: [],
    currentQuestionIndex: 0,
    correctAnswers: 0,
    user: null,
    token: null,
    selectedAnswerId: null,
    isAnswered: false
};

let currentMode = 'exam';

// ============================================================
// НАВИГАЦИЯ
// ============================================================

function showPage(pageId) {
    const pages = ['page-login', 'page-main', 'page-test', 'page-results', 'page-theory'];
    pages.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const target = document.getElementById(pageId);
    if (target) target.style.display = 'block';
}

function showPageLogin() { showPage('page-login'); }
function showPageMain() { showPage('page-main'); }
function showPageTest() { showPage('page-test'); }
function showPageResults() { showPage('page-results'); }
function showPageTheory() { showPage('page-theory'); }

// ============================================================
// ТЕМА
// ============================================================

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
    document.querySelectorAll('.btn-theme, .btn-theme-small').forEach(btn => {
        btn.textContent = isDark ? '🌙' : '☀️';
    });
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

function loadTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.querySelectorAll('.btn-theme, .btn-theme-small').forEach(btn => {
            btn.textContent = '☀️';
        });
    }
}

// ============================================================
// АУТЕНТИФИКАЦИЯ
// ============================================================

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('auth-login').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('auth-register').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('auth-error').style.display = 'none';
}

function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    el.textContent = msg;
    el.style.display = 'block';
}

async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) { showAuthError('Заполните все поля'); return; }
    try {
        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            state.user = data.user;
            state.token = data.token;
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            document.getElementById('user-name').textContent = `👤 ${data.user.username}`;
            showPageMain();
            loadSections();
            loadLeaderboard();
            loadUserResults();
        } else {
            showAuthError(data.error || 'Ошибка входа');
        }
    } catch (e) { showAuthError('Ошибка подключения к серверу'); }
}

async function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    if (!username || !password) { showAuthError('Заполните все поля'); return; }
    if (password.length < 4) { showAuthError('Пароль должен быть не менее 4 символов'); return; }
    try {
        const res = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            state.user = data.user;
            state.token = data.token;
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            document.getElementById('user-name').textContent = `👤 ${data.user.username}`;
            showPageMain();
            loadSections();
            loadLeaderboard();
            loadUserResults();
        } else {
            showAuthError(data.error || 'Ошибка регистрации');
        }
    } catch (e) { showAuthError('Ошибка подключения к серверу'); }
}

function handleLogout() {
    state.user = null;
    state.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showPageLogin();
}

function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (token && user) {
        state.token = token;
        state.user = user;
        document.getElementById('user-name').textContent = `👤 ${user.username}`;
        showPageMain();
        loadSections();
        loadLeaderboard();
        loadUserResults();
        return true;
    }
    showPageLogin();
    return false;
}

function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
}

// ============================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================

async function loadSections() {
    try {
        const res = await fetch(`${API_URL}/api/sections`);
        state.sections = await res.json();
        renderSections();
        await loadAllQuestions();
    } catch (e) {
        document.querySelector('.sections-list').innerHTML = '<p style="color:red;">❌ Ошибка загрузки</p>';
    }
}

async function loadAllQuestions() {
    try {
        const res = await fetch(`${API_URL}/api/data`);
        const data = await res.json();
        let allQuestions = [];
        data.forEach(ticket => {
            allQuestions = allQuestions.concat(ticket.questions);
        });
        state.questions = allQuestions;
    } catch (e) {
        console.error('Ошибка загрузки вопросов:', e);
    }
}

function renderSections() {
    const container = document.querySelector('.sections-list');
    const icons = { 
        'Испытания': '🔬', 
        'Извещения об изменениях': '📋', 
        'Документация': '📄', 
        'Постановка на производство': '🏭', 
        'Ремонт и рекламации': '🔧', 
        'Военная тематика и ВП': '🎖️',
        'Входной контроль': '🔍',
        'ОКР и литеры': '📐',
        'Жизненный цикл': '🔄'
    };
    
    container.innerHTML = state.sections.map(section => `
        <div class="section-item" style="display:flex; justify-content:space-between; align-items:center;">
            <span onclick="startTest('${section}')" style="display:flex; align-items:center; cursor:pointer; flex:1;">
                <span class="icon">${icons[section] || '📘'}</span>
                <span class="name">${section}</span>
            </span>
            <button onclick="openTheory('${section}')" class="btn-theory" style="
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                padding: 8px 12px;
                border-radius: 8px;
                transition: background 0.2s;
                color: #2196F3;
            " onmouseover="this.style.background='#e3f2fd'" onmouseout="this.style.background='none'">
                📖 Теория
            </button>
            <span class="arrow" onclick="startTest('${section}')" style="cursor:pointer;">›</span>
        </div>
    `).join('');
}
// ============================================================
// ЛИДЕРБОРД
// ============================================================

async function loadLeaderboard() {
    try {
        const res = await fetch(`${API_URL}/api/leaderboard`);
        const data = await res.json();
        const container = document.getElementById('leaderboard-list');
        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color:#999;">Пока нет результатов. Будьте первым! 🏆</p>';
            return;
        }
        container.innerHTML = data.map((u, i) => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:14px;">
                <span>${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`} ${u.username}</span>
                <span>Лучший: ${u.bestScore}%</span>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

// ============================================================
// СТАТИСТИКА
// ============================================================

async function loadUserResults() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/api/results`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401) return;
        const data = await res.json();
        if (data.success) {
            state.userResults = data.results;
            state.userStats = data.stats;
            renderStats();
        }
    } catch (e) { console.error('Ошибка загрузки результатов:', e); }
}

function renderStats() {
    const container = document.getElementById('stats-container');
    const stats = state.userStats || {};
    const results = state.userResults || {};
    
    let totalCorrect = 0;
    let totalQuestions = 0;
    let completedSections = 0;
    const sectionStats = {};
    
    state.sections.forEach(section => {
        const sectionResults = results[section] || [];
        if (sectionResults.length > 0) {
            completedSections++;
            const last = sectionResults[sectionResults.length - 1];
            const best = Math.max(...sectionResults.map(r => r.percentage));
            sectionStats[section] = { 
                last: last.percentage, 
                best: best, 
                count: sectionResults.length,
                avg: Math.round(sectionResults.reduce((sum, r) => sum + r.percentage, 0) / sectionResults.length)
            };
            totalCorrect += last.correct || 0;
            totalQuestions += last.total || 0;
        }
    });
    
    const allQuestions = state.questions?.length || 0;
    const progressPercentage = allQuestions > 0 ? Math.round((totalQuestions / allQuestions) * 100) : 0;
    
    let html = '';
    
    html += `
        <div class="stats-summary">
            <div class="stat-card">
                <div class="number">${stats.totalTests || 0}</div>
                <div class="label">📝 Тестов</div>
            </div>
            <div class="stat-card">
                <div class="number">${stats.totalCorrect || 0}</div>
                <div class="label">✅ Правильных</div>
            </div>
            <div class="stat-card">
                <div class="number">${completedSections}/${state.sections.length}</div>
                <div class="label">📚 Разделов</div>
            </div>
            <div class="stat-card">
                <div class="number">${stats.bestScore || 0}%</div>
                <div class="label">🏆 Лучший</div>
            </div>
        </div>
    `;
    
    html += `<div class="charts-container">`;
    
    state.sections.forEach(section => {
        const data = sectionStats[section];
        if (data) {
            const percentage = data.best;
            const icon = percentage >= 80 ? '✅' : percentage >= 60 ? '📖' : '📚';
            
            html += `
                <div class="chart-card">
                    <div class="chart-title">${icon} ${section}</div>
                    <canvas id="chart-${section.replace(/\s/g, '')}"></canvas>
                    <div class="chart-value">${percentage}%</div>
                    <div style="font-size:11px;color:var(--text-secondary);">
                        Попыток: ${data.count} | Лучший: ${data.best}%
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="chart-card" style="opacity:0.5;">
                    <div class="chart-title">📘 ${section}</div>
                    <div style="padding:20px;font-size:12px;color:var(--text-secondary);">
                        Нет данных
                    </div>
                    <div style="font-size:11px;color:var(--text-secondary);">
                        Пройдите тест
                    </div>
                </div>
            `;
        }
    });
    
    html += `</div>`;
    container.innerHTML = html;
    
    setTimeout(() => {
        state.sections.forEach(section => {
            const data = sectionStats[section];
            if (data) {
                drawChart(section, data.best);
            }
        });
    }, 100);
}

function drawChart(section, percentage) {
    const canvasId = `chart-${section.replace(/\s/g, '')}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (window.chartInstances && window.chartInstances[canvasId]) {
        window.chartInstances[canvasId].destroy();
    }
    
    const color = percentage >= 80 ? '#4CAF50' : percentage >= 60 ? '#FF9800' : '#f44336';
    
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Правильно', 'Неправильно'],
            datasets: [{
                data: [percentage, 100 - percentage],
                backgroundColor: [color, '#e0e0e0'],
                borderWidth: 0,
                cutout: '70%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.parsed + '%';
                        }
                    }
                }
            }
        }
    });
    
    if (!window.chartInstances) window.chartInstances = {};
    window.chartInstances[canvasId] = chart;
}

// ============================================================
// ТЕСТ НА СТРАНИЦЕ
// ============================================================

async function startTest(section) {
    try {
        const res = await fetch(`${API_URL}/api/questions/${encodeURIComponent(section)}`);
        let questions = await res.json();
        if (!questions || questions.length === 0) { alert('Нет вопросов'); return; }
        questions = questions.sort(() => Math.random() - 0.5);
        state.currentSection = section;
        state.questions = questions;
        state.currentQuestionIndex = 0;
        state.correctAnswers = 0;
        state.selectedAnswerId = null;
        state.isAnswered = false;
        
        document.getElementById('test-title').textContent = `📝 ${section}`;
        showPageTest();
        renderQuestion();
    } catch (e) { alert('Ошибка загрузки вопросов'); }
}

function renderQuestion() {
    const q = state.questions[state.currentQuestionIndex];
    if (!q) {
        showResults();
        return;
    }

    state.selectedAnswerId = null;
    state.isAnswered = false;

    const total = state.questions.length;
    const current = state.currentQuestionIndex + 1;
    const wrong = (current - 1) - state.correctAnswers;
    
    document.getElementById('progress-text').textContent = `${current} из ${total}`;
    document.getElementById('progress-fill').style.width = `${(current / total) * 100}%`;
    document.getElementById('stats-counter').textContent = `✅ ${state.correctAnswers} | ❌ ${wrong}`;
    document.getElementById('hint-text').style.display = 'none';

    document.getElementById('question-text').textContent = q.text;

    const letters = ['А', 'Б', 'В', 'Г'];
    const container = document.getElementById('answers-container');
    container.innerHTML = q.answers.map((answer, index) => `
        <div class="answer-item" data-index="${index}" onclick="selectAnswer(${index})">
            <span class="letter">${letters[index] || '•'}</span>
            <span class="text">${answer.text}</span>
        </div>
    `).join('');

    const nextBtn = document.getElementById('btn-next');
    nextBtn.textContent = current === total ? 'Завершить' : 'Далее →';
    nextBtn.disabled = true;
}

function selectAnswer(index) {
    if (state.isAnswered) return;
    
    const q = state.questions[state.currentQuestionIndex];
    const isCorrect = q.answers[index].isCorrect;
    const correctIndex = q.answers.findIndex(a => a.isCorrect);

    const items = document.querySelectorAll('.answer-item');
    items.forEach((el, i) => {
        el.classList.remove('selected', 'correct', 'wrong');
        if (i === index) {
            el.classList.add('selected');
            el.classList.add(isCorrect ? 'correct' : 'wrong');
        }
        if (i === correctIndex && i !== index) {
            el.classList.add('correct');
        }
    });

    state.selectedAnswerId = index;
    state.isAnswered = true;

    if (isCorrect) {
        state.correctAnswers++;
    } else {
        if (currentMode === 'train') {
            const correctText = q.answers.find(a => a.isCorrect).text;
            const hintEl = document.getElementById('hint-text');
            hintEl.textContent = `💡 Правильный ответ: "${correctText}"`;
            hintEl.style.display = 'block';
        }
    }

    const current = state.currentQuestionIndex + 1;
    const wrong = current - state.correctAnswers;
    document.getElementById('stats-counter').textContent = `✅ ${state.correctAnswers} | ❌ ${wrong}`;

    document.getElementById('btn-next').disabled = false;
}

function nextQuestion() {
    if (document.getElementById('btn-next').disabled) return;
    
    state.currentQuestionIndex++;
    if (state.currentQuestionIndex >= state.questions.length) {
        showResults();
    } else {
        renderQuestion();
    }
}

// ============================================================
// ЭКЗАМЕН
// ============================================================

async function startExam() {
    try {
        const res = await fetch(`${API_URL}/api/data`);
        const data = await res.json();
        let allQuestions = [];
        data.forEach(ticket => ticket.questions.forEach(q => allQuestions.push({ ...q, section: ticket.section })));
        const shuffled = allQuestions.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, 10);
        if (selected.length === 0) { alert('Нет вопросов'); return; }
        state.currentSection = '🎓 Экзамен';
        state.questions = selected;
        state.currentQuestionIndex = 0;
        state.correctAnswers = 0;
        state.selectedAnswerId = null;
        state.isAnswered = false;
        
        document.getElementById('test-title').textContent = '🎓 Экзамен (10 вопросов)';
        showPageTest();
        renderQuestion();
    } catch (e) { alert('Ошибка загрузки'); }
}

// ============================================================
// РЕЗУЛЬТАТЫ
// ============================================================

function getFunnyComment(percentage) {
    const comments = [
        { min: 0, max: 10, text: '🤡 Ну ты и инфузория! 0 баллов!', emoji: '🦠' },
        { min: 11, max: 40, text: '😅 Оооу... ну такое...', emoji: '🧹' },
        { min: 41, max: 70, text: '👀 Неплохо! Но ты бы ещё теорию почитал.', emoji: '📱' },
        { min: 71, max: 85, text: '🔥 Огонь! Но до гения ещё немного.', emoji: '💪' },
        { min: 86, max: 100, text: '💸 Ты просто машина! Все деньги заработаешь!', emoji: '🏆' }
    ];
    return comments.find(c => percentage >= c.min && percentage <= c.max) || comments[0];
}

function showResults() {
    const total = state.questions.length;
    const correct = state.correctAnswers;
    const percentage = Math.round((correct / total) * 100);
    
    const token = localStorage.getItem('token');
    if (token) {
        fetch(`${API_URL}/api/results`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ section: state.currentSection, correct, total, answers: [] })
        }).catch(e => console.error('Ошибка сохранения:', e));
    }
    
    const comment = getFunnyComment(percentage);
    
    document.getElementById('result-icon').textContent = comment.emoji;
    document.getElementById('result-title').textContent = comment.text;
    document.getElementById('result-score').textContent = `${correct} из ${total} (${percentage}%)`;
    document.getElementById('result-stats').innerHTML = `
        <div style="display:flex;gap:20px;justify-content:center;margin-top:8px;flex-wrap:wrap;">
            <span style="color:#4CAF50;">✅ Правильно: ${correct}</span>
            <span style="color:#f44336;">❌ Неправильно: ${total - correct}</span>
            <span>📊 ${percentage}%</span>
        </div>
    `;
    
    showPageResults();
    loadLeaderboard();
    loadUserResults();
}

function goHome() {
    showPageMain();
    loadSections();
    loadLeaderboard();
    loadUserResults();
}

function retryTest() {
    startTest(state.currentSection);
}

// ============================================================
// ТЕОРИЯ
// ============================================================

async function openTheory(section) {
    try {
        document.getElementById('theory-title').textContent = `📖 ${section}`;
        showPageTheory();
        
        const response = await fetch(`${API_URL}/api/theory/${encodeURIComponent(section)}`);
        if (!response.ok) throw new Error('Теория не найдена');
        
        const theory = await response.json();
        let html = `<h1>${theory.title}</h1>`;
        html += formatMarkdown(theory.content);
        document.getElementById('theory-content').innerHTML = html;
    } catch (error) {
        console.error('Ошибка загрузки теории:', error);
        document.getElementById('theory-content').innerHTML = `
            <div style="text-align:center;padding:40px;color:var(--text-secondary);">
                <p>❌ Теория для этого раздела пока не добавлена.</p>
            </div>
        `;
    }
}

function formatMarkdown(text) {
    if (!text) return '';
    let html = text;
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    html = html.replace(/---/g, '<hr>');
    html = html.replace(/\|(.+)\|/g, function(match) {
        const cells = match.split('|').filter(c => c.trim());
        if (cells.length === 0) return match;
        if (cells.every(c => c.trim().match(/^[-:]+$/))) return '';
        return '<tr><td>' + cells.join('</td><td>') + '</td></tr>';
    });
    html = html.replace(/(<tr>.*<\/tr>)/s, '<table>$1</table>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p><\/p>/g, '');
    return html;
}

// ============================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================================

// Кнопка "Назад" на странице теста
document.getElementById('btn-back')?.addEventListener('click', () => {
    if (confirm('Вы уверены, что хотите выйти? Прогресс будет потерян.')) {
        goHome();
    }
});

// Кнопка "Далее"
document.getElementById('btn-next')?.addEventListener('click', nextQuestion);

// Кнопки результатов
document.getElementById('btn-retry')?.addEventListener('click', retryTest);
document.getElementById('btn-home')?.addEventListener('click', goHome);

// Кнопка "Назад" на странице теории
document.getElementById('btn-back-theory')?.addEventListener('click', goHome);

// Кнопка "Назад" на странице результатов
document.getElementById('btn-back-results')?.addEventListener('click', goHome);

// Горячие клавиши
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !document.getElementById('btn-next')?.disabled) {
        document.getElementById('btn-next')?.click();
    }
    if (['1', '2', '3', '4'].includes(e.key) && !state.isAnswered) {
        const index = parseInt(e.key) - 1;
        const items = document.querySelectorAll('.answer-item');
        if (items[index]) items[index].click();
    }
});

// Вход/Регистрация по Enter
document.getElementById('login-username')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
document.getElementById('login-password')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
document.getElementById('register-username')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleRegister(); });
document.getElementById('register-password')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleRegister(); });

// ============================================================
// ЗАПУСК
// ============================================================

loadTheme();
checkAuth();
console.log('✅ Приложение загружено!');
