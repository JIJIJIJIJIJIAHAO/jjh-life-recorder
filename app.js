// ===== 数据存储 =====
const STORAGE_KEY = 'life_recorder_data';

function getDefaultData() {
    return {
        records: [],
        todos: [],
        feelings: {},
        stats: {
            weight: [],
            scores: [],
            modules: []
        }
    };
}

function getData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return getDefaultData();
        const data = JSON.parse(raw);
        if (!data.records) data.records = [];
        if (!data.todos) data.todos = [];
        if (!data.feelings) data.feelings = {};
        if (!data.stats) data.stats = { weight: [], scores: [], modules: [] };
        if (!data.stats.weight) data.stats.weight = [];
        if (!data.stats.scores) data.stats.scores = [];
        if (!data.stats.modules) data.stats.modules = [];
        // 迁移旧数据
        for (const k in data.feelings) {
            if (typeof data.feelings[k] === 'string') {
                data.feelings[k] = { text: data.feelings[k], image: null };
            }
        }
        data.todos.forEach(t => {
            if (!t.date) t.date = t.createdAt || formatDate(new Date());
            if (!t.time) t.time = '';
        });
        return data;
    } catch (e) {
        return getDefaultData();
    }
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ===== 分类配置 =====
const TYPE_CONFIG = {
    work:  { icon: '💼', label: '工作' },
    life:  { icon: '🏠', label: '生活' },
    study: { icon: '📚', label: '学习' },
    sport: { icon: '🏃', label: '运动' },
    food:  { icon: '🍽️', label: '饮食' },
    play:  { icon: '🎮', label: '纯玩' },
    focus: { icon: '🍅', label: '专注' },
    other: { icon: '📌', label: '其他' }
};

// ===== 日期工具 =====
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateDisplay(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${y}年${m}月${d}日 周${weekDays[date.getDay()]}`;
}

function formatDateShort(dateStr) {
    const [, m, d] = dateStr.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function isToday(date) {
    const now = new Date();
    return date.getFullYear() === now.getFullYear() &&
           date.getMonth() === now.getMonth() &&
           date.getDate() === now.getDate();
}

function calcDurationMinutes(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return mins;
}

function formatDuration(mins) {
    if (mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

// ===== 日视图：视觉位置映射（6:00 开始） =====
function visualHour(realHour) {
    return realHour >= 6 ? realHour - 6 : realHour + 18;
}

function visualY(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return visualHour(h) * 60 + m;
}

// ===== 事件合并 =====
function getMergedEvents(dateStr, maxN) {
    const data = getData();
    const records = data.records.filter(r => r.date === dateStr);
    const groups = {};
    records.forEach(r => {
        const key = r.title;
        if (!groups[key]) {
            groups[key] = { title: r.title, category: r.type, totalMinutes: 0, count: 0 };
        }
        groups[key].totalMinutes += calcDurationMinutes(r.startTime, r.endTime);
        groups[key].count++;
    });
    const sorted = Object.values(groups).sort((a, b) => b.totalMinutes - a.totalMinutes);
    return maxN ? sorted.slice(0, maxN) : sorted;
}

// ===== 月统计 =====
function getMonthStats(year, month) {
    const data = getData();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const daysInMonth = getDaysInMonth(year, month);
    const totalHours = daysInMonth * 24;
    const now = new Date();
    let elapsedHours = 0;
    if (now.getFullYear() === year && now.getMonth() === month) {
        elapsedHours = (now.getDate() - 1) * 24 + now.getHours() + now.getMinutes() / 60;
    } else if (now > new Date(year, month + 1, 0)) {
        elapsedHours = totalHours;
    }
    const percent = ((elapsedHours / totalHours) * 100).toFixed(1);
    
    // 学习时长（小时）
    let studyHours = 0;
    data.records.forEach(r => {
        if (r.date && r.date.startsWith(prefix) && r.type === 'study') {
            studyHours += calcDurationMinutes(r.startTime, r.endTime);
        }
    });
    studyHours = (studyHours / 60).toFixed(1);
    
    // 完成待办 & 未完成待办
    let completedCount = 0;
    let pendingCount = 0;
    data.todos.forEach(t => {
        if (t.completed) {
            if (t.completedAt && t.completedAt.startsWith(prefix)) completedCount++;
        } else {
            pendingCount++;
        }
    });
    
    return { percent, studyHours, completedCount, pendingCount };
}

function getWeekTodos() {
    const data = getData();
    const weekStart = getWeekStart(new Date());
    const weekStartStr = formatDate(weekStart);
    return data.todos.filter(t => {
        if (!t.completed) return true;
        if (t.completedAt && t.completedAt >= weekStartStr) return true;
        return false;
    });
}

function getDayTodos(dateStr) {
    const data = getData();
    return data.todos.filter(t => t.date === dateStr);
}

// ===== 文案库 =====
let dailyQuote = '一万年太久，只争朝夕！';

async function loadQuotes() {
    try {
        const resp = await fetch('quotes.txt');
        if (!resp.ok) return;
        const text = await resp.text();
        const quotes = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
        if (quotes.length === 0) return;
        const today = new Date();
        const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
        dailyQuote = quotes[seed % quotes.length];
    } catch (e) {}
}

// ===== 状态 =====
let currentView = 'home';
let currentDate = new Date();
let editingRecordId = null;
let editingFeelingDate = null;
let showCompletedTodos = false;
let carouselTimer = null;

// ===== DOM =====
const el = {};

function initDOM() {
    el.navBtns = document.querySelectorAll('.nav-btn');
    el.views = document.querySelectorAll('.view');
    el.dateControls = document.getElementById('dateControls');
    el.currentDate = document.getElementById('currentDate');
    el.prevBtn = document.getElementById('prevBtn');
    el.nextBtn = document.getElementById('nextBtn');
    el.todayBtn = document.getElementById('todayBtn');
    el.homeView = document.getElementById('homeView');
    el.dayView = document.getElementById('dayView');
    el.weekView = document.getElementById('weekView');
    el.monthView = document.getElementById('monthView');
    el.monthDashboard = document.getElementById('monthDashboard');
    el.artTitle = document.getElementById('artTitle');
    el.recordModal = document.getElementById('recordModal');
    el.modalTitle = document.getElementById('modalTitle');
    el.recordForm = document.getElementById('recordForm');
    el.recordDate = document.getElementById('recordDate');
    el.recordStartTime = document.getElementById('recordStartTime');
    el.recordEndTime = document.getElementById('recordEndTime');
    el.recordTitle = document.getElementById('recordTitle');
    el.recordType = document.getElementById('recordType');
    el.recordNote = document.getElementById('recordNote');
    el.deleteBtn = document.getElementById('deleteBtn');
    el.cancelBtn = document.getElementById('cancelBtn');
    el.closeModal = document.getElementById('closeModal');
    el.feelingModal = document.getElementById('feelingModal');
    el.feelingModalTitle = document.getElementById('feelingModalTitle');
    el.closeFeelingModal = document.getElementById('closeFeelingModal');
    el.feelingText = document.getElementById('feelingText');
    el.feelingImage = document.getElementById('feelingImage');
    el.feelingPreview = document.getElementById('feelingPreview');
    el.feelingPreviewImg = document.getElementById('feelingPreviewImg');
    el.feelingPreviewText = document.getElementById('feelingPreviewText');
    el.saveFeelingBtn = document.getElementById('saveFeelingBtn');
    el.cancelFeelingBtn = document.getElementById('cancelFeelingBtn');
    el.clearFeelingBtn = document.getElementById('clearFeelingBtn');
    el.fabAdd = document.getElementById('fabAdd');
    el.toast = document.getElementById('toast');
    el.newTodoInput = document.getElementById('newTodoInput');
    el.newTodoDate = document.getElementById('newTodoDate');
    el.newTodoTime = document.getElementById('newTodoTime');
    el.addTodoBtn = document.getElementById('addTodoBtn');
    el.todoList = document.getElementById('todoList');
    el.dayTodoBar = document.getElementById('dayTodoBar');
    el.dayTimeline = document.getElementById('dayTimeline');
    el.carouselContainer = document.getElementById('carouselContainer');
    el.nlInput = document.getElementById('nlInput');
    el.nlParseBtn = document.getElementById('nlParseBtn');
    el.nlPreview = document.getElementById('nlPreview');
}

// ===== 视图切换 =====
function switchView(view) {
    currentView = view;
    el.navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
    el.views.forEach(v => v.classList.toggle('active', v.id === `${view}View`));
    el.dateControls.style.display = (view === 'home' || view === 'stats') ? 'none' : 'flex';
    el.fabAdd.style.display = (view === 'home' || view === 'stats') ? 'none' : 'block';
    render();
}

function navigateDate(dir) {
    if (currentView === 'day') currentDate.setDate(currentDate.getDate() + dir);
    else if (currentView === 'week') currentDate.setDate(currentDate.getDate() + dir * 7);
    else currentDate.setMonth(currentDate.getMonth() + dir);
    render();
}

function goToday() {
    currentDate = new Date();
    render();
}

function updateDateDisplay() {
    if (currentView === 'day') {
        el.currentDate.textContent = formatDateDisplay(currentDate);
    } else if (currentView === 'week') {
        const ws = getWeekStart(currentDate);
        const we = new Date(ws);
        we.setDate(we.getDate() + 6);
        el.currentDate.textContent = `${ws.getMonth()+1}月${ws.getDate()}日 - ${we.getMonth()+1}月${we.getDate()}日`;
    } else {
        el.currentDate.textContent = `${currentDate.getFullYear()}年${currentDate.getMonth()+1}月`;
    }
}

function render() {
    updateDateDisplay();
    if (currentView === 'home') renderHomeView();
    else if (currentView === 'day') renderDayView();
    else if (currentView === 'week') renderWeekView();
    else if (currentView === 'month') renderMonthView();
    else if (currentView === 'stats') Stats.render();
}

// ===== 首页 =====
function renderHomeView() {
    el.artTitle.textContent = dailyQuote;
    renderTodoList();
    renderCarousel();
}

function renderTodoList() {
    const todos = getWeekTodos();
    const toggleBtn = document.getElementById('toggleCompletedBtn');
    const hasCompleted = todos.some(t => t.completed);
    if (toggleBtn) {
        toggleBtn.style.display = hasCompleted ? 'inline-block' : 'none';
        toggleBtn.textContent = showCompletedTodos ? '🙈 隐藏已完成' : '👁 查看已完成';
        toggleBtn.classList.toggle('active', showCompletedTodos);
    }
    const displayTodos = showCompletedTodos ? todos : todos.filter(t => !t.completed);
    displayTodos.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    if (displayTodos.length === 0) {
        el.todoList.innerHTML = '<div style="text-align:center;color:var(--text-light);padding:20px;">暂无待办 ✨</div>';
        return;
    }
    el.todoList.innerHTML = displayTodos.map(t => {
        const dateBadge = t.date ? `<span class="todo-date-badge">${formatDateShort(t.date)}${t.time ? ' ' + t.time : ''}</span>` : '';
        return `<div class="todo-item" data-id="${t.id}">
            <div class="todo-checkbox ${t.completed ? 'checked' : ''}" data-action="toggle" data-id="${t.id}"></div>
            <span class="todo-text ${t.completed ? 'completed' : ''}">${escapeHtml(t.title)}</span>
            ${dateBadge}
            <button class="todo-delete" data-action="delete" data-id="${t.id}">✕</button>
        </div>`;
    }).join('');
}

// ===== 图片轮播 =====
function renderCarousel() {
    if (carouselTimer) {
        clearInterval(carouselTimer);
        carouselTimer = null;
    }
    const data = getData();
    const today = new Date();
    const slides = [];
    for (let i = 0; i < 7 && slides.length < 3; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const ds = formatDate(d);
        const f = data.feelings[ds];
        if (f && f.image) {
            slides.push({ date: ds, text: f.text || '', image: f.image });
        }
    }
    if (slides.length === 0) {
        el.carouselContainer.innerHTML = '<div class="carousel-empty">暂无图片，去月视图添加感悟图片吧 📷</div>';
        return;
    }
    let html = '';
    slides.forEach((s, i) => {
        html += `<div class="carousel-slide ${i === 0 ? 'active' : ''}" style="background-image:url('${s.image}')">
            <div class="carousel-slide-overlay">${formatDateShort(s.date)} ${escapeHtml(s.text)}</div>
        </div>`;
    });
    html += '<div class="carousel-dots">';
    slides.forEach((_, i) => {
        html += `<div class="carousel-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></div>`;
    });
    html += '</div>';
    el.carouselContainer.innerHTML = html;

    if (slides.length > 1) {
        let current = 0;
        const dotEls = el.carouselContainer.querySelectorAll('.carousel-dot');
        const slideEls = el.carouselContainer.querySelectorAll('.carousel-slide');
        dotEls.forEach(dot => {
            dot.addEventListener('click', () => {
                current = parseInt(dot.dataset.idx);
                slideEls.forEach((s, i) => s.classList.toggle('active', i === current));
                dotEls.forEach((d, i) => d.classList.toggle('active', i === current));
            });
        });
        carouselTimer = setInterval(() => {
            current = (current + 1) % slides.length;
            slideEls.forEach((s, i) => s.classList.toggle('active', i === current));
            dotEls.forEach((d, i) => d.classList.toggle('active', i === current));
        }, 4000);
    }
}

// ===== 自然语言解析 =====
function parseNLInput(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const results = [];
    const now = new Date();

    lines.forEach(line => {
        let date = formatDate(now);
        let startTime = '';
        let endTime = '';
        let title = '';
        let type = 'other';
        let error = null;

        let remaining = line;

        const todayStr = formatDate(now);
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const afterTomorrow = new Date(now);
        afterTomorrow.setDate(afterTomorrow.getDate() + 2);

        // 解析日期
        if (/^今天/.test(remaining)) {
            date = todayStr;
            remaining = remaining.replace(/^今天\s*/, '');
        } else if (/^明天/.test(remaining)) {
            date = formatDate(tomorrow);
            remaining = remaining.replace(/^明天\s*/, '');
        } else if (/^后天/.test(remaining)) {
            date = formatDate(afterTomorrow);
            remaining = remaining.replace(/^后天\s*/, '');
        } else {
            const dateMatch = remaining.match(/(\d{1,2})月(\d{1,2})[日号]?\s*/);
            if (dateMatch) {
                const m = parseInt(dateMatch[1]);
                const d = parseInt(dateMatch[2]);
                const y = now.getFullYear();
                date = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                remaining = remaining.replace(dateMatch[0], '');
            }
        }

        // 解析时间 - 支持"一点到三点半"、"1点到3点半"、"13:00到15:30"等格式
        const timePatterns = [
            // "一点到三点半"、"下午一点到三点半"
            { regex: /(上午|早上|下午|晚上)?([一二三四五六七八九十]+)点(半|\d+)?\s*[到至]\s*(下午|晚上)?([一二三四五六七八九十]+)点(半|\d+)?/, type: 'cn' },
            // "1点到3点半"、"13:00到15:30"
            { regex: /(\d{1,2})[:：](\d{2})\s*[-~到至]\s*(\d{1,2})[:：](\d{2})/, type: 'std' },
            // "1点到3点"
            { regex: /(上午|早上|下午|晚上)?(\d{1,2})\s*[点时]\s*[-~到至]\s*(下午|晚上)?(\d{1,2})\s*[点时]/, type: 'simple' }
        ];

        for (const pattern of timePatterns) {
            const match = remaining.match(pattern.regex);
            if (match) {
                if (pattern.type === 'cn') {
                    // 中文数字转换
                    const cnToNum = (str) => {
                        const map = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
                        return map[str] || parseInt(str);
                    };
                    let sh = cnToNum(match[2]);
                    let sm = match[3] === '半' ? 30 : (match[3] ? parseInt(match[3]) : 0);
                    let eh = cnToNum(match[5]);
                    let em = match[6] === '半' ? 30 : (match[6] ? parseInt(match[6]) : 0);
                    if ((match[1] === '下午' || match[1] === '晚上') && sh < 12) sh += 12;
                    if ((match[4] === '下午' || match[4] === '晚上') && eh < 12) eh += 12;
                    startTime = `${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}`;
                    endTime = `${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`;
                } else if (pattern.type === 'std') {
                    startTime = `${match[1].padStart(2,'0')}:${match[2]}`;
                    endTime = `${match[3].padStart(2,'0')}:${match[4]}`;
                } else if (pattern.type === 'simple') {
                    let sh = parseInt(match[2]);
                    let eh = parseInt(match[4]);
                    if ((match[1] === '下午' || match[1] === '晚上') && sh < 12) sh += 12;
                    if ((match[3] === '下午' || match[3] === '晚上') && eh < 12) eh += 12;
                    startTime = `${String(sh).padStart(2,'0')}:00`;
                    endTime = `${String(eh).padStart(2,'0')}:00`;
                }
                remaining = remaining.replace(match[0], '');
                break;
            }
        }

        // 解析分类 - 支持"类型为学习"、"分类：学习"等
        const typeMatch = remaining.match(/(?:类型|分类)[是为：:]\s*(工作|生活|学习|运动|饮食|纯玩|其他)/);
        if (typeMatch) {
            const typeMap = {'工作':'work','生活':'life','学习':'study','运动':'sport','饮食':'food','纯玩':'play','其他':'other'};
            type = typeMap[typeMatch[1]];
            remaining = remaining.replace(typeMatch[0], '');
        }

        title = remaining.trim();

        // 如果未指定分类，根据标题关键词推断
        if (type === 'other') {
            if (/学习|高数|英语|论文|课程|作业|考试|复习|看书|阅读|刷题|公考/.test(title)) type = 'study';
            else if (/运动|跑步|健身|游泳|篮球|足球|瑜伽|散步/.test(title)) type = 'sport';
            else if (/吃饭|午餐|晚餐|早餐|聚餐|火锅|奶茶/.test(title)) type = 'food';
            else if (/工作|开会|组会|汇报|项目|会议|面试|实习/.test(title)) type = 'work';
            else if (/游戏|电影|逛街|旅游|玩|聚会/.test(title)) type = 'play';
            else if (/看病|医院|牙|体检|理发/.test(title)) type = 'life';
        }

        if (!title) error = '未识别到标题';
        if (!startTime || !endTime) error = (error ? error + '；' : '') + '未识别到时间';

        results.push({ date, startTime, endTime, title, type, error });
    });

    return results;
}

function handleNLParse() {
    const text = el.nlInput.value.trim();
    if (!text) return;
    const parsed = parseNLInput(text);
    let html = '';
    let added = 0;
    const data = getData();

    parsed.forEach(p => {
        if (p.error) {
            html += `<div class="nl-preview-item error">❌ ${escapeHtml(p.title || '无法解析')} — ${p.error}</div>`;
        } else {
            const config = TYPE_CONFIG[p.type] || TYPE_CONFIG.other;
            data.records.push({
                id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
                date: p.date,
                startTime: p.startTime,
                endTime: p.endTime,
                title: p.title,
                type: p.type,
                note: ''
            });
            added++;
            html += `<div class="nl-preview-item">✅ ${config.icon} ${formatDateShort(p.date)} ${p.startTime}-${p.endTime} ${escapeHtml(p.title)}</div>`;
        }
    });

    if (added > 0) {
        saveData(data);
        showToast(`已添加 ${added} 条日程`);
    }
    el.nlPreview.innerHTML = html;
    el.nlInput.value = '';
    setTimeout(() => {
        el.nlPreview.innerHTML = '';
    }, 5000);
}

// ===== 日视图 =====
function renderDayView() {
    const dateStr = formatDate(currentDate);
    const data = getData();
    const dayTodos = getDayTodos(dateStr);

    // 待办栏
    if (dayTodos.length > 0) {
        el.dayTodoBar.style.display = 'block';
        el.dayTodoBar.innerHTML = '<h4>📋 当日待办</h4>' + dayTodos.map(t => `
            <div class="day-todo-item">
                <div class="todo-checkbox ${t.completed ? 'checked' : ''}" style="width:16px;height:16px;"
                     onclick="toggleTodo('${t.id}')"></div>
                <span class="todo-text ${t.completed ? 'completed' : ''}">${escapeHtml(t.title)}</span>
                ${t.time ? `<span style="font-size:11px;color:var(--text-light);">${t.time}</span>` : ''}
            </div>
        `).join('');
    } else {
        el.dayTodoBar.style.display = 'none';
    }

    // 三列日期
    const yesterday = new Date(currentDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(currentDate);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dates = [
        { date: yesterday, label: '昨天', isCenter: false },
        { date: currentDate, label: '今天', isCenter: true },
        { date: tomorrow, label: '明天', isCenter: false }
    ];

    const container = document.getElementById('dayThreeCol');
    let html = '';

    dates.forEach(({ date, label, isCenter }) => {
        const ds = formatDate(date);
        const records = data.records.filter(r => r.date === ds);
        const colClass = isCenter ? 'day-column center' : 'day-column side';

        html += `<div class="${colClass}" data-date="${ds}">`;
        html += `<div class="day-column-header">${label} · ${formatDateDisplay(date).split(' ')[0].slice(5)}</div>`;
        html += `<div class="day-column-timeline">`;

        // 时间轴（6:00-23:00 + 0:00-5:00）
        const displayOrder = [];
        for (let i = 6; i <= 23; i++) displayOrder.push(i);
        for (let i = 0; i <= 5; i++) displayOrder.push(i);

        displayOrder.forEach((realHour, idx) => {
            const yPos = idx * 60;
            const hourStr = String(realHour).padStart(2, '0') + ':00';
            html += `<div class="day-hour-label" style="top:${yPos}px;">${hourStr}</div>`;
            if (isCenter) {
                html += `<div class="day-hour-slot" style="top:${yPos}px;" data-date="${ds}" data-hour="${realHour}"></div>`;
            } else {
                html += `<div class="day-hour-slot" style="top:${yPos}px;"></div>`;
            }
        });

        // 分隔线
        const sepY = 18 * 60;
        html += `<div class="day-separator" style="top:${sepY}px;"></div>`;

        // 事件块
        const layoutResult = layoutEvents(records);
        layoutResult.forEach(item => {
            const record = item.record;
            const config = TYPE_CONFIG[record.type] || TYPE_CONFIG.other;
            let startY = visualY(record.startTime);
            let endY = visualY(record.endTime);
            if (endY <= startY) endY = 1440;
            const top = startY;
            const height = Math.max(endY - startY, 20);
            const leftPct = item.col * item.widthPct;
            html += `<div class="day-event-block ${record.type}"
                style="top:${top}px; height:${height}px; left:calc(50px + ${leftPct}%); width:calc(${item.widthPct}% - 4px);"
                data-id="${record.id}">
                <div class="day-event-title">${config.icon} ${escapeHtml(record.title)}</div>
                <div class="day-event-time">${record.startTime} - ${record.endTime}</div>
                ${record.note ? `<div class="day-event-note">${escapeHtml(record.note)}</div>` : ''}
            </div>`;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;

    // 滚动到中间列的顶部
    const wrapper = container.parentElement;
    if (wrapper && !wrapper._scrolled) {
        wrapper.scrollLeft = wrapper.scrollWidth / 3;
        wrapper._scrolled = true;
    }

    // 事件绑定
    container.querySelectorAll('.day-hour-slot[data-date]').forEach(slot => {
        slot.addEventListener('click', () => {
            const hour = String(slot.dataset.hour).padStart(2, '0');
            const endHour = String(Math.min(23, parseInt(hour) + 1)).padStart(2, '0');
            openAddModal(slot.dataset.date, `${hour}:00`, `${endHour}:00`);
        });
    });

    container.querySelectorAll('.day-event-block').forEach(block => {
        block.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(block.dataset.id);
        });
    });
}

function layoutEvents(records) {
    if (records.length === 0) return [];
    const sorted = [...records].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const columns = [];
    const assignments = [];
    sorted.forEach(record => {
        const rStart = timeToMinutes(record.startTime);
        const rEnd = timeToMinutes(record.endTime);
        let placed = false;
        for (let c = 0; c < columns.length; c++) {
            if (rStart >= columns[c]) {
                columns[c] = rEnd > rStart ? rEnd : rStart + 60;
                assignments.push({ record, col: c });
                placed = true;
                break;
            }
        }
        if (!placed) {
            columns.push(rEnd > rStart ? rEnd : rStart + 60);
            assignments.push({ record, col: columns.length - 1 });
        }
    });
    return assignments.map(a => {
        const rStart = timeToMinutes(a.record.startTime);
        const rEnd = timeToMinutes(a.record.endTime);
        let maxCol = a.col;
        assignments.forEach(b => {
            if (timeToMinutes(b.record.startTime) < rEnd && timeToMinutes(b.record.endTime) > rStart) {
                maxCol = Math.max(maxCol, b.col);
            }
        });
        return { record: a.record, col: a.col, widthPct: 100 / (maxCol + 1) };
    });
}

// ===== 周视图（连续翻页） =====
function renderWeekView() {
    const container = document.getElementById('weekScrollContainer');
    const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
    
    // 生成前一周、本周、后一周
    const weeks = [];
    for (let offset = -2; offset <= 2; offset++) {
        const weekStart = new Date(getWeekStart(currentDate));
        weekStart.setDate(weekStart.getDate() + offset * 7);
        weeks.push(weekStart);
    }
    
    let html = '';
    weeks.forEach((weekStart, weekIdx) => {
        const isCurrentWeek = weekIdx === 2;
        html += `<div class="week-page ${isCurrentWeek ? 'current-week' : ''}">`;
        html += '<div class="week-grid">';
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            const dateStr = formatDate(date);
            const todayClass = isToday(date) ? 'today' : '';
            const merged = getMergedEvents(dateStr, 7);
            const allMerged = getMergedEvents(dateStr);
            const hasMore = allMerged.length > 7;
            const dayTodos = getDayTodos(dateStr);

            html += `<div class="week-day ${todayClass}">
                <div class="week-day-header">
                    <div class="week-day-name">周${weekDays[i]}</div>
                    <div class="week-day-date">${date.getDate()}</div>
                </div>
                <div class="week-day-content">
                    <div class="week-events-list">`;
            if (merged.length === 0) {
                html += '<div style="font-size:11px;color:var(--text-light);padding:4px;">暂无记录</div>';
            } else {
                merged.forEach(ev => {
                    const config = TYPE_CONFIG[ev.category] || TYPE_CONFIG.other;
                    html += `<div class="week-event-item ${ev.category}">
                        <span class="week-event-icon">${config.icon}</span>
                        <div class="week-event-info">
                            <div class="week-event-title">${escapeHtml(ev.title)}</div>
                            <div class="week-event-time">${formatDuration(ev.totalMinutes)}${ev.count > 1 ? ' · ' + ev.count + '次' : ''}</div>
                        </div>
                    </div>`;
                });
                if (hasMore) html += `<div style="font-size:10px;color:var(--text-light);padding:2px 6px;">...还有 ${allMerged.length - 7} 项</div>`;
            }
            html += `</div>`;
            if (dayTodos.length > 0) {
                html += `<div class="week-todos-section"><h5>待办</h5>`;
                dayTodos.forEach(t => {
                    const doneClass = t.completed ? 'done' : '';
                    html += `<div class="week-todo-item" data-todo-id="${t.id}">
                        <div class="week-todo-check ${doneClass}">${t.completed ? '✓' : ''}</div>
                        <span class="week-todo-text ${doneClass}">${escapeHtml(t.title)}</span>
                    </div>`;
                });
                html += `</div>`;
            }
            html += `<button class="week-add-btn" data-date="${dateStr}">+ 添加日程</button>
                </div>
            </div>`;
        }
        
        html += '</div></div>';
    });
    
    container.innerHTML = html;
    
    // 滚动到本周
    const currentWeekPage = document.getElementById('currentWeekPage');
    if (currentWeekPage) {
        container.scrollTop = currentWeekPage.offsetTop;
    }
    
    // 事件绑定
    container.querySelectorAll('.week-add-btn').forEach(btn => {
        btn.addEventListener('click', () => openAddModal(btn.dataset.date, '09:00', '10:00'));
    });
    container.querySelectorAll('.week-todo-item').forEach(item => {
        item.addEventListener('click', () => {
            if (item.dataset.todoId) toggleTodo(item.dataset.todoId);
        });
    });
}

// ===== 月视图 =====
function renderMonthView() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const stats = getMonthStats(year, month);
    el.monthDashboard.innerHTML = `
        <span>📊 本月看板：</span>
        本月已过 <span class="highlight">${stats.percent}%</span>，
        已学习 <span class="highlight">${stats.studyHours}</span> 小时，
        完成事项 <span class="highlight">${stats.completedCount}</span> 个，
        尚有 <span class="highlight">${stats.pendingCount}</span> 个待办未完成。
    `;

    const monthGrid = el.monthView.querySelector('.month-grid');
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
    const data = getData();

    let startDate = new Date(firstDay);
    const dow = startDate.getDay();
    startDate.setDate(startDate.getDate() + (dow === 0 ? -6 : 1 - dow));

    let html = '<div class="month-header">';
    weekDays.forEach(d => {
        html += `<div class="month-header-cell">周${d}</div>`;
    });
    html += '</div><div class="month-body">';

    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = formatDate(date);
        const isCurrentMonth = date.getMonth() === month;
        const todayClass = isToday(date) ? 'today' : '';
        const otherClass = !isCurrentMonth ? 'other-month' : '';
        const feeling = data.feelings[dateStr];
        const hasFeeling = feeling && (feeling.text || feeling.image);
        const feelingClass = hasFeeling ? 'has-feeling' : '';
        const bgStyle = (hasFeeling && feeling.image) ? `background-image:url('${feeling.image}');` : '';

        html += `<div class="month-cell ${todayClass} ${otherClass} ${feelingClass}" style="${bgStyle}" data-date="${dateStr}">
            <div class="month-cell-inner">
                <div class="month-date">${date.getDate()}</div>`;
        if (hasFeeling && feeling.text) {
            const len = feeling.text.length;
            let fontSize;
            if (len <= 5) fontSize = '16px';
            else if (len <= 10) fontSize = '14px';
            else if (len <= 15) fontSize = '12px';
            else if (len <= 20) fontSize = '11px';
            else fontSize = '10px';
            html += `<div class="month-feeling-text" style="font-size:${fontSize}">${escapeHtml(feeling.text)}</div>`;
        }
        html += `</div></div>`;
        if (date >= lastDay && date.getDay() === 0) break;
    }

    html += '</div>';
    monthGrid.innerHTML = html;
    monthGrid.querySelectorAll('.month-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            if (!cell.classList.contains('other-month')) openFeelingModal(cell.dataset.date);
        });
    });
}

// ===== 日程弹窗 =====
function openAddModal(date, startTime, endTime) {
    editingRecordId = null;
    el.modalTitle.textContent = '添加日程';
    el.recordDate.value = date || formatDate(currentDate);
    el.recordStartTime.value = startTime || '09:00';
    el.recordEndTime.value = endTime || '10:00';
    el.recordTitle.value = '';
    el.recordType.value = 'life';
    el.recordNote.value = '';
    el.deleteBtn.style.display = 'none';
    el.recordModal.classList.add('active');
}

function openEditModal(id) {
    const data = getData();
    const record = data.records.find(r => r.id === id);
    if (!record) return;
    editingRecordId = id;
    el.modalTitle.textContent = '编辑日程';
    el.recordDate.value = record.date;
    el.recordStartTime.value = record.startTime;
    el.recordEndTime.value = record.endTime;
    el.recordTitle.value = record.title;
    el.recordType.value = record.type;
    el.recordNote.value = record.note || '';
    el.deleteBtn.style.display = 'block';
    el.recordModal.classList.add('active');
}

function closeModalFn() {
    el.recordModal.classList.remove('active');
    editingRecordId = null;
}

function handleSubmit(e) {
    e.preventDefault();
    const data = getData();
    const record = {
        date: el.recordDate.value,
        startTime: el.recordStartTime.value,
        endTime: el.recordEndTime.value,
        title: el.recordTitle.value,
        type: el.recordType.value,
        note: el.recordNote.value
    };
    if (editingRecordId) {
        const idx = data.records.findIndex(r => r.id === editingRecordId);
        if (idx !== -1) data.records[idx] = { ...data.records[idx], ...record };
    } else {
        record.id = Date.now().toString();
        data.records.push(record);
    }
    saveData(data);
    closeModalFn();
    render();
}

function handleDelete() {
    if (editingRecordId && confirm('确定要删除这条记录吗？')) {
        const data = getData();
        data.records = data.records.filter(r => r.id !== editingRecordId);
        saveData(data);
        closeModalFn();
        render();
    }
}

// ===== 感悟弹窗 =====
function openFeelingModal(dateStr) {
    editingFeelingDate = dateStr;
    const data = getData();
    const feeling = data.feelings[dateStr] || { text: '', image: null };
    el.feelingModalTitle.textContent = `编辑感悟 - ${formatDateDisplay(new Date(dateStr + 'T00:00:00'))}`;
    el.feelingText.value = feeling.text || '';
    el.feelingImage.value = '';
    updateFeelingPreview(feeling.text || '', feeling.image);
    el.feelingModal.classList.add('active');
}

function updateFeelingPreview(text, imageData) {
    el.feelingPreviewText.textContent = text || '点击编辑感悟...';
    if (imageData) {
        el.feelingPreviewImg.src = imageData;
        el.feelingPreviewImg.style.display = 'block';
    } else {
        el.feelingPreviewImg.style.display = 'none';
    }
}

function closeFeelingModalFn() {
    el.feelingModal.classList.remove('active');
    editingFeelingDate = null;
}

function saveFeeling() {
    if (!editingFeelingDate) return;
    const data = getData();
    const text = el.feelingText.value.trim().slice(0, 30);
    const processAndSave = (imageData) => {
        data.feelings[editingFeelingDate] = { text, image: imageData };
        saveData(data);
        closeFeelingModalFn();
        render();
    };
    const file = el.feelingImage.files[0];
    if (file) {
        compressImage(file, 400, 300, (dataUrl) => processAndSave(dataUrl));
    } else {
        const old = data.feelings[editingFeelingDate] || {};
        processAndSave(old.image || null);
    }
}

function clearFeeling() {
    if (!editingFeelingDate) return;
    const data = getData();
    delete data.feelings[editingFeelingDate];
    saveData(data);
    closeFeelingModalFn();
    render();
}

function compressImage(file, maxW, maxH, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            const targetRatio = maxW / maxH;
            const imgRatio = w / h;
            let sx = 0, sy = 0, sw = w, sh = h;
            if (imgRatio > targetRatio) {
                sw = h * targetRatio;
                sx = (w - sw) / 2;
            } else {
                sh = w / targetRatio;
                sy = (h - sh) / 2;
            }
            canvas.width = maxW;
            canvas.height = maxH;
            canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, maxW, maxH);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ===== 待办 =====
function addTodo() {
    const title = el.newTodoInput.value.trim();
    if (!title) return;
    const data = getData();
    const now = new Date();
    data.todos.push({
        id: Date.now().toString(),
        title,
        completed: false,
        createdAt: formatDate(now),
        completedAt: null,
        date: el.newTodoDate.value || formatDate(now),
        time: el.newTodoTime.value || ''
    });
    saveData(data);
    el.newTodoInput.value = '';
    setTodoDefaults();
    renderTodoList();
}

function toggleTodo(id) {
    const data = getData();
    const todo = data.todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        todo.completedAt = todo.completed ? formatDate(new Date()) : null;
        saveData(data);
        render();
    }
}

function deleteTodo(id) {
    const data = getData();
    data.todos = data.todos.filter(t => t.id !== id);
    saveData(data);
    renderTodoList();
}

function setTodoDefaults() {
    const now = new Date();
    el.newTodoDate.value = formatDate(now);
    el.newTodoTime.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

// ===== 统计页面 =====
const Stats = {
    render() {
        this.setDefaultDates();
        this.renderPieChart();
        this.renderWeightChart();
        this.renderWeightList();
        this.renderScoreTable();
        this.renderModuleChart();
        this.renderModuleTable();
    },

    setDefaultDates() {
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const pieMonth = document.getElementById('pieMonth');
        if (pieMonth && !pieMonth.value) {
            pieMonth.value = monthStr;
            pieMonth.addEventListener('change', () => this.renderPieChart());
        }
        const weightDate = document.getElementById('weightDate');
        if (weightDate && !weightDate.value) weightDate.value = formatDate(now);
        const scoreDate = document.getElementById('scoreDate');
        if (scoreDate && !scoreDate.value) scoreDate.value = formatDate(now);
    },

    toggleWidget(widgetId) {
        const widget = document.getElementById(widgetId);
        widget.classList.toggle('expanded');
    },

    // ===== 时间分布饼图（前6项） =====
    renderPieChart() {
        const canvas = document.getElementById('pieChart');
        const ctx = canvas.getContext('2d');
        const month = document.getElementById('pieMonth').value;
        if (!month) return;

        const data = getData();
        const records = data.records.filter(r => r.date && r.date.startsWith(month));

        const typeMinutes = {};
        records.forEach(r => {
            const mins = calcDurationMinutes(r.startTime, r.endTime);
            typeMinutes[r.type] = (typeMinutes[r.type] || 0) + mins;
        });

        this._setupCanvas(canvas);
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // 只取前6项
        const entries = Object.entries(typeMinutes).sort((a, b) => b[1] - a[1]).slice(0, 6);
        const total = entries.reduce((sum, [, mins]) => sum + mins, 0);
        
        if (total === 0) {
            this._drawEmpty(ctx, W, H);
            document.getElementById('pieLegend').innerHTML = '';
            return;
        }

        const centerX = W / 2;
        const centerY = H / 2;
        const radius = Math.min(W, H) / 2 - 40;
        let startAngle = -Math.PI / 2;

        const colors = ['#007AFF', '#34C759', '#AF52DE', '#FF9500', '#FF3B30', '#5AC8FA'];

        entries.forEach(([type, mins], idx) => {
            const sliceAngle = (mins / total) * 2 * Math.PI;
            const endAngle = startAngle + sliceAngle;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = colors[idx % colors.length];
            ctx.fill();

            startAngle = endAngle;
        });

        const legend = document.getElementById('pieLegend');
        legend.innerHTML = entries.map(([type, mins], idx) => {
            const config = TYPE_CONFIG[type] || TYPE_CONFIG.other;
            const percent = ((mins / total) * 100).toFixed(1);
            const hours = (mins / 60).toFixed(1);
            return `<div class="legend-item">
                <div class="legend-color" style="background:${colors[idx % colors.length]}"></div>
                <span>${config.icon} ${config.label}: ${hours}h (${percent}%)</span>
            </div>`;
        }).join('');
    },

    // ===== 体重 =====
    renderWeightChart() {
        const canvas = document.getElementById('weightChart');
        const ctx = canvas.getContext('2d');
        const data = getData().stats.weight.slice(-30).sort((a, b) => a.date.localeCompare(b.date));
        this._setupCanvas(canvas);
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        if (data.length === 0) {
            this._drawEmpty(ctx, W, H);
            return;
        }

        const padL = 50, padR = 20, padT = 20, padB = 40;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;

        const values = data.map(d => d.value);
        const minV = Math.floor(Math.min(...values) - 1);
        const maxV = Math.ceil(Math.max(...values) + 1);
        const range = maxV - minV || 1;

        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 0.5;
        ctx.fillStyle = '#8E8E93';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        for (let v = minV; v <= maxV; v += 1) {
            const y = padT + chartH - ((v - minV) / range) * chartH;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(W - padR, y);
            ctx.stroke();
            ctx.fillText(v + 'kg', padL - 4, y + 3);
        }

        ctx.beginPath();
        ctx.strokeStyle = '#007AFF';
        ctx.lineWidth = 2;
        data.forEach((d, i) => {
            const x = padL + (i / Math.max(data.length - 1, 1)) * chartW;
            const y = padT + chartH - ((d.value - minV) / range) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        data.forEach((d, i) => {
            const x = padL + (i / Math.max(data.length - 1, 1)) * chartW;
            const y = padT + chartH - ((d.value - minV) / range) * chartH;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#007AFF';
            ctx.fill();

            if (data.length <= 15 || i % Math.ceil(data.length / 10) === 0) {
                ctx.fillStyle = '#8E8E93';
                ctx.font = '9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(d.date.slice(5), x, H - padB + 14);
            }
        });
    },

    addWeight() {
        const date = document.getElementById('weightDate').value;
        const value = parseFloat(document.getElementById('weightValue').value);
        if (!date || isNaN(value)) {
            showToast('请填写完整');
            return;
        }
        const data = getData();
        data.stats.weight.push({ id: Date.now().toString(), date, value });
        saveData(data);
        this.renderWeightChart();
        this.renderWeightList();
        showToast('已添加体重记录');
    },

    renderWeightList() {
        const data = getData().stats.weight.sort((a, b) => b.date.localeCompare(a.date));
        const list = document.getElementById('weightList');
        if (data.length === 0) {
            list.innerHTML = '<div style="color:var(--text-light);font-size:12px;padding:8px;">暂无数据</div>';
            return;
        }
        list.innerHTML = data.map(d => `
            <div class="stats-data-item">
                <div class="stats-data-info">${d.date} | ${d.value} kg</div>
                <div class="stats-data-actions">
                    <button class="stats-del-btn" onclick="Stats.delWeight('${d.id}')">删除</button>
                </div>
            </div>
        `).join('');
    },

    delWeight(id) {
        const data = getData();
        data.stats.weight = data.stats.weight.filter(d => d.id !== id);
        saveData(data);
        this.renderWeightChart();
        this.renderWeightList();
    },

    // ===== 分数记录 =====
    addScore() {
        const name = document.getElementById('scoreName').value.trim();
        const date = document.getElementById('scoreDate').value;
        const value = parseFloat(document.getElementById('scoreValue').value);
        const note = document.getElementById('scoreNote').value.trim();
        if (!name || !date || isNaN(value)) {
            showToast('请填写完整');
            return;
        }
        const data = getData();
        data.stats.scores.push({
            id: Date.now().toString(),
            name,
            date,
            value,
            note
        });
        saveData(data);
        this.renderScoreTable();
        showToast('已添加分数记录');
        document.getElementById('scoreName').value = '';
        document.getElementById('scoreValue').value = '';
        document.getElementById('scoreNote').value = '';
    },

    renderScoreTable() {
        const data = getData().stats.scores.sort((a, b) => b.date.localeCompare(a.date));
        const container = document.getElementById('scoreTable');
        if (data.length === 0) {
            container.innerHTML = '<div style="color:var(--text-light);font-size:12px;padding:8px;">暂无数据</div>';
            return;
        }
        let html = '<table class="score-table"><thead><tr><th>名称</th><th>日期</th><th>分数</th><th>备注</th><th>操作</th></tr></thead><tbody>';
        data.forEach(d => {
            html += `<tr>
                <td>${escapeHtml(d.name)}</td>
                <td>${d.date}</td>
                <td><strong>${d.value}</strong></td>
                <td>${escapeHtml(d.note || '-')}</td>
                <td><button class="stats-del-btn" onclick="Stats.delScore('${d.id}')">删除</button></td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    },

    delScore(id) {
        const data = getData();
        data.stats.scores = data.stats.scores.filter(d => d.id !== id);
        saveData(data);
        this.renderScoreTable();
    },

    // ===== 板块监控 =====
    addModule() {
        const module = document.getElementById('moduleSelect').value;
        const total = parseInt(document.getElementById('moduleTotal').value);
        const wrong = parseInt(document.getElementById('moduleWrong').value);
        if (!module || isNaN(total) || isNaN(wrong) || wrong > total) {
            showToast('请填写完整');
            return;
        }
        const data = getData();
        data.stats.modules.push({
            id: Date.now().toString(),
            module,
            total,
            wrong,
            date: formatDate(new Date())
        });
        saveData(data);
        this.renderModuleChart();
        this.renderModuleTable();
        showToast('已添加记录');
        document.getElementById('moduleTotal').value = '';
        document.getElementById('moduleWrong').value = '';
    },

    renderModuleChart() {
        const container = document.getElementById('moduleChart');
        const data = getData().stats.modules;
        
        if (data.length === 0) {
            container.innerHTML = '<div style="color:var(--text-light);font-size:14px;padding:20px;text-align:center;">暂无数据</div>';
            return;
        }

        // 按板块统计
        const moduleStats = {};
        data.forEach(d => {
            if (!moduleStats[d.module]) {
                moduleStats[d.module] = { total: 0, wrong: 0 };
            }
            moduleStats[d.module].total += d.total;
            moduleStats[d.module].wrong += d.wrong;
        });

        const entries = Object.entries(moduleStats);
        const totalAll = entries.reduce((sum, [, s]) => sum + s.total, 0);
        const wrongAll = entries.reduce((sum, [, s]) => sum + s.wrong, 0);
        const correctRate = totalAll > 0 ? ((totalAll - wrongAll) / totalAll * 100).toFixed(1) : 0;

        // 生成小方块展示
        let html = '<div class="module-cards">';
        
        // 总数据卡片
        html += `<div class="module-card total-card">
            <div class="module-card-title">总计</div>
            <div class="module-card-value">${correctRate}%</div>
            <div class="module-card-detail">${totalAll}题 | 错${wrongAll}</div>
        </div>`;

        // 各板块卡片
        entries.forEach(([module, s]) => {
            const rate = s.total > 0 ? ((s.total - s.wrong) / s.total * 100).toFixed(1) : 0;
            html += `<div class="module-card">
                <div class="module-card-title">${module}</div>
                <div class="module-card-value">${rate}%</div>
                <div class="module-card-detail">${s.total}题 | 错${s.wrong}</div>
            </div>`;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    renderModuleTable() {
        const data = getData().stats.modules;
        const container = document.getElementById('moduleTable');

        if (data.length === 0) {
            container.innerHTML = '<div style="color:var(--text-light);font-size:12px;padding:8px;">暂无数据</div>';
            return;
        }

        // 按时间倒序排列
        const sorted = [...data].sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return b.id.localeCompare(a.id);
        });

        let html = '<table class="score-table"><thead><tr><th>板块</th><th>日期</th><th>做题</th><th>错题</th><th>正确率</th><th>操作</th></tr></thead><tbody>';
        sorted.forEach(d => {
            const rate = d.total > 0 ? ((d.total - d.wrong) / d.total * 100).toFixed(1) : 0;
            html += `<tr>
                <td>${d.module}</td>
                <td>${d.date}</td>
                <td>${d.total}</td>
                <td>${d.wrong}</td>
                <td><strong>${rate}%</strong></td>
                <td><button class="stats-del-btn" onclick="Stats.delModule('${d.id}')">删除</button></td>
            </tr>`;
        });
        html += '</tbody></table>';

        container.innerHTML = html;
    },

    delModule(id) {
        const data = getData();
        data.stats.modules = data.stats.modules.filter(d => d.id !== id);
        saveData(data);
        this.renderModuleChart();
        this.renderModuleTable();
    },

    // ===== 图表工具 =====
    _setupCanvas(canvas) {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        canvas.getContext('2d').scale(2, 2);
        canvas.width = rect.width;
        canvas.height = rect.height;
    },

    _drawEmpty(ctx, W, H) {
        ctx.fillStyle = '#8E8E93';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', W / 2, H / 2);
    }
};

// ===== 数据导入导出 =====
function exportData() {
    const data = getData();
    const exportObj = {
        version: 3,
        exportDate: new Date().toISOString(),
        records: data.records,
        todos: data.todos,
        feelings: data.feelings,
        stats: data.stats
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `life-recorder-${formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据已导出');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                const current = getData();

                if (imported.records) {
                    const map = new Map();
                    current.records.forEach(r => map.set(r.id, r));
                    imported.records.forEach(r => map.set(r.id, r));
                    current.records = Array.from(map.values());
                }

                if (imported.todos) {
                    const map = new Map();
                    current.todos.forEach(t => map.set(t.id, t));
                    imported.todos.forEach(t => map.set(t.id, t));
                    current.todos = Array.from(map.values());
                }

                if (imported.feelings) {
                    Object.assign(current.feelings, imported.feelings);
                }

                if (imported.stats) {
                    ['weight', 'scores', 'modules'].forEach(key => {
                        if (imported.stats[key]) {
                            const map = new Map();
                            (current.stats[key] || []).forEach(d => map.set(d.id, d));
                            imported.stats[key].forEach(d => map.set(d.id, d));
                            current.stats[key] = Array.from(map.values());
                        }
                    });
                }

                saveData(current);
                render();
                showToast('数据导入成功（已合并）');
            } catch (err) {
                showToast('导入失败：文件格式错误');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ===== Toast =====
function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    setTimeout(() => el.toast.classList.remove('show'), 3000);
}

// ===== 工具 =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== 事件绑定 =====
function bindEvents() {
    el.navBtns.forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    el.prevBtn.addEventListener('click', () => navigateDate(-1));
    el.nextBtn.addEventListener('click', () => navigateDate(1));
    el.todayBtn.addEventListener('click', goToday);
    el.fabAdd.addEventListener('click', () => openAddModal());
    document.getElementById('exportDataBtn')?.addEventListener('click', exportData);
    document.getElementById('importDataBtn')?.addEventListener('click', importData);

    el.closeModal.addEventListener('click', closeModalFn);
    el.cancelBtn.addEventListener('click', closeModalFn);
    el.recordModal.addEventListener('click', (e) => {
        if (e.target === el.recordModal) closeModalFn();
    });
    el.recordForm.addEventListener('submit', handleSubmit);
    el.deleteBtn.addEventListener('click', handleDelete);

    el.closeFeelingModal.addEventListener('click', closeFeelingModalFn);
    el.cancelFeelingBtn.addEventListener('click', closeFeelingModalFn);
    el.feelingModal.addEventListener('click', (e) => {
        if (e.target === el.feelingModal) closeFeelingModalFn();
    });
    el.saveFeelingBtn.addEventListener('click', saveFeeling);
    el.clearFeelingBtn.addEventListener('click', clearFeeling);
    el.feelingText.addEventListener('input', () => {
        updateFeelingPreview(el.feelingText.value, el.feelingPreviewImg.style.display !== 'none' ? el.feelingPreviewImg.src : null);
    });
    el.feelingImage.addEventListener('change', () => {
        const file = el.feelingImage.files[0];
        if (file) {
            compressImage(file, 400, 300, (dataUrl) => {
                updateFeelingPreview(el.feelingText.value, dataUrl);
            });
        }
    });

    el.addTodoBtn.addEventListener('click', addTodo);
    el.newTodoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addTodo();
    });
    el.todoList.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        if (target.dataset.action === 'toggle') toggleTodo(target.dataset.id);
        else if (target.dataset.action === 'delete') deleteTodo(target.dataset.id);
    });

    el.nlParseBtn.addEventListener('click', handleNLParse);

    document.getElementById('toggleCompletedBtn')?.addEventListener('click', () => {
        showCompletedTodos = !showCompletedTodos;
        renderTodoList();
    });

    document.addEventListener('keydown', (e) => {
        if (el.recordModal.classList.contains('active') || el.feelingModal.classList.contains('active')) {
            if (e.key === 'Escape') {
                closeModalFn();
                closeFeelingModalFn();
            }
            return;
        }
        if (e.key === 'ArrowLeft') navigateDate(-1);
        if (e.key === 'ArrowRight') navigateDate(1);
    });
}

// ===== 初始化 =====
async function init() {
    initDOM();
    await loadQuotes();
    setTodoDefaults();
    bindEvents();
    render();
}

init();
