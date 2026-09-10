// ===== 数据存储 =====
const STORAGE_KEY = 'life_recorder_data';

function getDefaultData() {
    return { records: [], todos: [], feelings: {}, stats: { sleep: [], weight: [], expense: [], exercise: [] } };
}

function getData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return getDefaultData();
        const data = JSON.parse(raw);
        if (!data.records) data.records = [];
        if (!data.todos) data.todos = [];
        if (!data.feelings) data.feelings = {};
        if (!data.stats) data.stats = { sleep: [], weight: [], expense: [], exercise: [] };
        if (!data.stats.sleep) data.stats.sleep = [];
        if (!data.stats.weight) data.stats.weight = [];
        if (!data.stats.expense) data.stats.expense = [];
        if (!data.stats.exercise) data.stats.exercise = [];
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
    let focusMinutes = 0;
    data.records.forEach(r => {
        if (r.date && r.date.startsWith(prefix) && r.fromPomodoro) {
            focusMinutes += calcDurationMinutes(r.startTime, r.endTime);
        }
    });
    let completedCount = 0, pendingCount = 0;
    data.todos.forEach(t => {
        if (t.completed) {
            if (t.completedAt && t.completedAt.startsWith(prefix)) completedCount++;
        } else { pendingCount++; }
    });
    return { percent, focusMinutes, completedCount, pendingCount };
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

function goToday() { currentDate = new Date(); render(); }

function updateDateDisplay() {
    if (currentView === 'day') {
        el.currentDate.textContent = formatDateDisplay(currentDate);
    } else if (currentView === 'week') {
        const ws = getWeekStart(currentDate);
        const we = new Date(ws); we.setDate(we.getDate() + 6);
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
    if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null; }
    const data = getData();
    // 取近3日有图片的感悟
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

        // 提取日期：今天/明天/后天/X月X日/周X
        const todayStr = formatDate(now);
        const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
        const afterTomorrow = new Date(now); afterTomorrow.setDate(afterTomorrow.getDate() + 2);

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
            // X月X日 or X-X
            const dateMatch = remaining.match(/(\d{1,2})月(\d{1,2})[日号]?\s*/);
            if (dateMatch) {
                const m = parseInt(dateMatch[1]);
                const d = parseInt(dateMatch[2]);
                const y = now.getFullYear();
                date = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                remaining = remaining.replace(dateMatch[0], '');
            }
        }

        // 提取时间：下午2-4点 / 14:00-15:00 / 上午9-11点
        const timePatterns = [
            /(?:上午|早上)?(\d{1,2})[:：](\d{2})\s*[-~到至]\s*(?:上午|下午)?(\d{1,2})[:：](\d{2})/,
            /(?:上午|早上)(\d{1,2})\s*[-~到至]\s*(?:下午)?(\d{1,2})\s*[点时]/,
            /(?:下午)?(\d{1,2})\s*[-~到至]\s*(\d{1,2})\s*[点时]/,
            /(\d{1,2})[:：](\d{2})\s*[-~到至]\s*(\d{1,2})[:：](\d{2})/,
        ];

        // 标准 HH:MM-HH:MM
        const stdTimeMatch = remaining.match(/(\d{1,2})[:：](\d{2})\s*[-~到至]\s*(\d{1,2})[:：](\d{2})/);
        if (stdTimeMatch) {
            startTime = `${stdTimeMatch[1].padStart(2,'0')}:${stdTimeMatch[2]}`;
            endTime = `${stdTimeMatch[3].padStart(2,'0')}:${stdTimeMatch[4]}`;
            remaining = remaining.replace(stdTimeMatch[0], '');
        } else {
            // 上午X-Y点
            const amPmMatch = remaining.match(/(上午|早上)?(\d{1,2})\s*[-~到至]\s*(下午|晚上)?(\d{1,2})\s*[点时]/);
            if (amPmMatch) {
                let sh = parseInt(amPmMatch[2]);
                let eh = parseInt(amPmMatch[4]);
                if ((amPmMatch[3] === '下午' || amPmMatch[3] === '晚上') && eh < 12) eh += 12;
                if (amPmMatch[1] === '上午' || amPmMatch[1] === '早上') { /* keep */ }
                else if (!amPmMatch[3] && sh < 12 && eh < 12) { /* 默认上午 */ }
                startTime = `${String(sh).padStart(2,'0')}:00`;
                endTime = `${String(eh).padStart(2,'0')}:00`;
                remaining = remaining.replace(amPmMatch[0], '');
            }
        }

        // 剩余部分作为标题
        title = remaining.trim();

        // 推断类型
        const titleLower = title.toLowerCase();
        if (/学习|高数|英语|论文|课程|作业|考试|复习|看书|阅读/.test(title)) type = 'study';
        else if (/运动|跑步|健身|游泳|篮球|足球|瑜伽|散步/.test(title)) type = 'sport';
        else if (/吃饭|午餐|晚餐|早餐|聚餐|火锅|奶茶/.test(title)) type = 'food';
        else if (/工作|开会|组会|汇报|项目|会议|面试|实习/.test(title)) type = 'work';
        else if (/游戏|电影|逛街|旅游|玩|聚会/.test(title)) type = 'play';
        else if (/看病|医院|牙|体检|理发/.test(title)) type = 'life';

        if (!title) {
            error = '未识别到标题';
        }
        if (!startTime || !endTime) {
            error = (error ? error + '；' : '') + '未识别到时间（如：下午2-4点）';
        }

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
                id: Date.now().toString() + Math.random().toString(36).slice(2,6),
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
    setTimeout(() => { el.nlPreview.innerHTML = ''; }, 5000);
}

// ===== 日视图 =====
function renderDayView() {
    const dateStr = formatDate(currentDate);
    const data = getData();
    const records = data.records.filter(r => r.date === dateStr);
    const dayTodos = getDayTodos(dateStr);

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

    const displayOrder = [];
    for (let i = 6; i <= 23; i++) displayOrder.push(i);
    for (let i = 0; i <= 5; i++) displayOrder.push(i);

    let html = '';
    displayOrder.forEach((realHour, idx) => {
        const yPos = idx * 60;
        const hourStr = String(realHour).padStart(2, '0') + ':00';
        html += `<div class="day-hour-label" style="top:${yPos}px;">${hourStr}</div>`;
        html += `<div class="day-hour-slot" style="top:${yPos}px;" data-date="${dateStr}" data-hour="${realHour}"></div>`;
    });

    const sepY = 18 * 60;
    html += `<div class="day-separator" style="top:${sepY}px;"></div>`;
    html += `<div class="day-separator-label" style="top:${sepY}px;">── 次日凌晨 ──</div>`;

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
            style="top:${top}px; height:${height}px; left:calc(70px + ${leftPct}%); width:calc(${item.widthPct}% - 4px);"
            data-id="${record.id}">
            <div class="day-event-title">${config.icon} ${escapeHtml(record.title)}</div>
            <div class="day-event-time">${record.startTime} - ${record.endTime}</div>
            ${record.note ? `<div class="day-event-note">${escapeHtml(record.note)}</div>` : ''}
        </div>`;
    });

    el.dayTimeline.innerHTML = html;
    const wrapper = el.dayView.querySelector('.day-timeline-wrapper');
    if (wrapper && !wrapper._scrolled) { wrapper.scrollTop = 0; wrapper._scrolled = true; }

    el.dayTimeline.querySelectorAll('.day-hour-slot').forEach(slot => {
        slot.addEventListener('click', () => {
            const hour = String(slot.dataset.hour).padStart(2, '0');
            const endHour = String(Math.min(23, parseInt(hour) + 1)).padStart(2, '0');
            openAddModal(slot.dataset.date, `${hour}:00`, `${endHour}:00`);
        });
    });

    el.dayTimeline.querySelectorAll('.day-event-block').forEach(block => {
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

// ===== 周视图 =====
function renderWeekView() {
    const weekGrid = el.weekView.querySelector('.week-grid');
    const weekStart = getWeekStart(currentDate);
    const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
    let html = '';
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
            if (hasMore) html += `<div class="week-more">...还有 ${allMerged.length - 7} 项</div>`;
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
        html += `</div>
            <button class="week-add-btn" data-date="${dateStr}">+ 添加日程</button>
        </div>`;
    }
    weekGrid.innerHTML = html;
    weekGrid.querySelectorAll('.week-add-btn').forEach(btn => {
        btn.addEventListener('click', () => openAddModal(btn.dataset.date, '09:00', '10:00'));
    });
    weekGrid.querySelectorAll('.week-todo-item').forEach(item => {
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
        本月已度过 <span class="highlight">${stats.percent}%</span>，
        累计专注 <span class="highlight">${stats.focusMinutes}</span> 分钟，
        完成待办 <span class="highlight">${stats.completedCount}</span> 件，
        尚有 <span class="highlight">${stats.pendingCount}</span> 件待办待完成。
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
    weekDays.forEach(d => { html += `<div class="month-header-cell">周${d}</div>`; });
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
            // 自适应字号：字少大一些，字多小一些
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

function closeModalFn() { el.recordModal.classList.remove('active'); editingRecordId = null; }

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

function closeFeelingModalFn() { el.feelingModal.classList.remove('active'); editingFeelingDate = null; }

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
            if (imgRatio > targetRatio) { sw = h * targetRatio; sx = (w - sw) / 2; }
            else { sh = w / targetRatio; sy = (h - sh) / 2; }
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
        this.renderSleepChart();
        this.renderWeightChart();
        this.renderExpenseChart();
        this.renderExerciseChart();
        this.renderSleepList();
        this.renderWeightList();
        this.renderExpenseList();
        this.renderExerciseList();
    },

    setDefaultDates() {
        const today = formatDate(new Date());
        ['sleepDate','weightDate','expenseDate','exerciseDate'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.value) el.value = today;
        });
    },

    // ===== 睡眠 =====
    renderSleepChart() {
        const canvas = document.getElementById('sleepChart');
        const ctx = canvas.getContext('2d');
        const data = getData().stats.sleep.slice(-14).sort((a,b) => a.date.localeCompare(b.date));
        this._setupCanvas(canvas);
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        if (data.length === 0) { this._drawEmpty(ctx, W, H); return; }

        const padL = 50, padR = 20, padT = 20, padB = 40;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;

        // Y轴：时间 18:00 ~ 10:00 (next day) → 映射为 0~16h
        const toY = (timeStr) => {
            const [h, m] = timeStr.split(':').map(Number);
            let val = h + m / 60;
            if (val < 12) val += 24; // 凌晨算作24+
            // 18:00=18 → 0, 10:00(34) → chartH
            const normalized = (val - 18) / 16;
            return padT + normalized * chartH;
        };

        // 画网格
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.5;
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        [18, 20, 22, 0, 2, 4, 6, 8, 10].forEach(h => {
            const label = `${String(h).padStart(2,'0')}:00`;
            let val = h;
            if (val < 12) val += 24;
            const y = padT + ((val - 18) / 16) * chartH;
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
            ctx.fillText(label, padL - 4, y + 3);
        });

        const barW = Math.min(chartW / data.length * 0.6, 30);
        const gap = chartW / data.length;

        data.forEach((d, i) => {
            const x = padL + i * gap + gap / 2 - barW / 2;
            const yBed = toY(d.bedtime);
            const yWake = toY(d.wakeup);
            const barH = Math.max(yWake - yBed, 2);

            // 渐变色柱
            const grad = ctx.createLinearGradient(x, yBed, x, yWake);
            grad.addColorStop(0, '#6366f1');
            grad.addColorStop(1, '#a78bfa');
            ctx.fillStyle = grad;
            ctx.fillRect(x, yBed, barW, barH);

            // X轴日期
            ctx.fillStyle = '#64748b';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(d.date.slice(5), x + barW / 2, H - padB + 14);
        });
    },

    addSleep() {
        const date = document.getElementById('sleepDate').value;
        const bedtime = document.getElementById('sleepBedtime').value;
        const wakeup = document.getElementById('sleepWakeup').value;
        if (!date || !bedtime || !wakeup) { showToast('请填写完整'); return; }
        const data = getData();
        data.stats.sleep.push({ id: Date.now().toString(), date, bedtime, wakeup });
        saveData(data);
        this.renderSleepChart();
        this.renderSleepList();
        showToast('已添加睡眠记录');
    },

    renderSleepList() {
        const data = getData().stats.sleep.sort((a,b) => b.date.localeCompare(a.date));
        const list = document.getElementById('sleepList');
        if (data.length === 0) { list.innerHTML = '<div style="color:var(--text-light);font-size:12px;padding:8px;">暂无数据</div>'; return; }
        list.innerHTML = data.map(d => `
            <div class="stats-data-item">
                <div class="stats-data-info">${d.date} | 入睡 ${d.bedtime} → 起床 ${d.wakeup}</div>
                <div class="stats-data-actions">
                    <button class="stats-del-btn" onclick="Stats.delSleep('${d.id}')">删除</button>
                </div>
            </div>
        `).join('');
    },

    delSleep(id) {
        const data = getData();
        data.stats.sleep = data.stats.sleep.filter(d => d.id !== id);
        saveData(data);
        this.renderSleepChart();
        this.renderSleepList();
    },

    // ===== 体重 =====
    renderWeightChart() {
        const canvas = document.getElementById('weightChart');
        const ctx = canvas.getContext('2d');
        const data = getData().stats.weight.slice(-30).sort((a,b) => a.date.localeCompare(b.date));
        this._setupCanvas(canvas);
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        if (data.length === 0) { this._drawEmpty(ctx, W, H); return; }

        const padL = 50, padR = 20, padT = 20, padB = 40;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;

        const values = data.map(d => d.value);
        const minV = Math.floor(Math.min(...values) - 1);
        const maxV = Math.ceil(Math.max(...values) + 1);
        const range = maxV - minV || 1;

        // 网格
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.5;
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        for (let v = minV; v <= maxV; v += 1) {
            const y = padT + chartH - ((v - minV) / range) * chartH;
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
            ctx.fillText(v + 'kg', padL - 4, y + 3);
        }

        // 折线
        ctx.beginPath();
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 2;
        data.forEach((d, i) => {
            const x = padL + (i / Math.max(data.length - 1, 1)) * chartW;
            const y = padT + chartH - ((d.value - minV) / range) * chartH;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // 点
        data.forEach((d, i) => {
            const x = padL + (i / Math.max(data.length - 1, 1)) * chartW;
            const y = padT + chartH - ((d.value - minV) / range) * chartH;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#4f46e5';
            ctx.fill();

            // X轴日期
            if (data.length <= 15 || i % Math.ceil(data.length / 10) === 0) {
                ctx.fillStyle = '#64748b';
                ctx.font = '9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(d.date.slice(5), x, H - padB + 14);
            }
        });
    },

    addWeight() {
        const date = document.getElementById('weightDate').value;
        const value = parseFloat(document.getElementById('weightValue').value);
        if (!date || isNaN(value)) { showToast('请填写完整'); return; }
        const data = getData();
        data.stats.weight.push({ id: Date.now().toString(), date, value });
        saveData(data);
        this.renderWeightChart();
        this.renderWeightList();
        showToast('已添加体重记录');
    },

    renderWeightList() {
        const data = getData().stats.weight.sort((a,b) => b.date.localeCompare(a.date));
        const list = document.getElementById('weightList');
        if (data.length === 0) { list.innerHTML = '<div style="color:var(--text-light);font-size:12px;padding:8px;">暂无数据</div>'; return; }
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

    // ===== 支出 =====
    renderExpenseChart() {
        const canvas = document.getElementById('expenseChart');
        const ctx = canvas.getContext('2d');
        const allData = getData().stats.expense;
        // 按月汇总
        const monthMap = {};
        allData.forEach(d => {
            const m = d.date.slice(0, 7);
            monthMap[m] = (monthMap[m] || 0) + d.amount;
        });
        const data = Object.entries(monthMap).sort((a,b) => a[0].localeCompare(b[0])).slice(-12);
        this._setupCanvas(canvas);
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        if (data.length === 0) { this._drawEmpty(ctx, W, H); return; }

        const padL = 60, padR = 20, padT = 20, padB = 40;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;
        const maxV = Math.max(...data.map(d => d[1])) * 1.1 || 1;

        // 网格
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.5;
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const v = (maxV / 4) * i;
            const y = padT + chartH - (v / maxV) * chartH;
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
            ctx.fillText(Math.round(v) + '元', padL - 4, y + 3);
        }

        const barW = Math.min(chartW / data.length * 0.6, 40);
        const gap = chartW / data.length;
        const colors = ['#4f46e5', '#6366f1', '#818cf8', '#a78bfa', '#7c3aed', '#8b5cf6'];

        data.forEach((d, i) => {
            const x = padL + i * gap + gap / 2 - barW / 2;
            const barH = (d[1] / maxV) * chartH;
            const y = padT + chartH - barH;
            ctx.fillStyle = colors[i % colors.length];
            ctx.fillRect(x, y, barW, barH);

            // 金额标注
            ctx.fillStyle = '#1e293b';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('¥' + Math.round(d[1]), x + barW / 2, y - 4);

            // X轴月份
            ctx.fillStyle = '#64748b';
            ctx.font = '9px sans-serif';
            ctx.fillText(d[0].slice(5), x + barW / 2, H - padB + 14);
        });
    },

    addExpense() {
        const date = document.getElementById('expenseDate').value;
        const category = document.getElementById('expenseCategory').value.trim();
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        if (!date || !category || isNaN(amount)) { showToast('请填写完整'); return; }
        const data = getData();
        data.stats.expense.push({ id: Date.now().toString(), date, category, amount });
        saveData(data);
        this.renderExpenseChart();
        this.renderExpenseList();
        showToast('已添加支出记录');
    },

    renderExpenseList() {
        const data = getData().stats.expense.sort((a,b) => b.date.localeCompare(a.date));
        const list = document.getElementById('expenseList');
        if (data.length === 0) { list.innerHTML = '<div style="color:var(--text-light);font-size:12px;padding:8px;">暂无数据</div>'; return; }
        list.innerHTML = data.map(d => `
            <div class="stats-data-item">
                <div class="stats-data-info">${d.date} | ${escapeHtml(d.category)} | ¥${d.amount}</div>
                <div class="stats-data-actions">
                    <button class="stats-del-btn" onclick="Stats.delExpense('${d.id}')">删除</button>
                </div>
            </div>
        `).join('');
    },

    delExpense(id) {
        const data = getData();
        data.stats.expense = data.stats.expense.filter(d => d.id !== id);
        saveData(data);
        this.renderExpenseChart();
        this.renderExpenseList();
    },

    // ===== 运动 =====
    renderExerciseChart() {
        const canvas = document.getElementById('exerciseChart');
        const ctx = canvas.getContext('2d');
        const data = getData().stats.exercise.slice(-14).sort((a,b) => a.date.localeCompare(b.date));
        this._setupCanvas(canvas);
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        if (data.length === 0) { this._drawEmpty(ctx, W, H); return; }

        const padL = 50, padR = 20, padT = 20, padB = 50;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;
        const maxV = Math.max(...data.map(d => d.duration)) * 1.2 || 1;

        // 网格
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.5;
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const v = (maxV / 4) * i;
            const y = padT + chartH - (v / maxV) * chartH;
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
            ctx.fillText(Math.round(v) + '分', padL - 4, y + 3);
        }

        const barW = Math.min(chartW / data.length * 0.6, 30);
        const gap = chartW / data.length;
        const colors = ['#f59e0b', '#f97316', '#ef4444', '#10b981', '#06b6d4', '#8b5cf6'];

        data.forEach((d, i) => {
            const x = padL + i * gap + gap / 2 - barW / 2;
            const barH = (d.duration / maxV) * chartH;
            const y = padT + chartH - barH;
            ctx.fillStyle = colors[i % colors.length];
            ctx.fillRect(x, y, barW, barH);

            // 运动名称标注
            ctx.fillStyle = '#1e293b';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(d.name, x + barW / 2, y - 4);

            // X轴日期
            ctx.fillStyle = '#64748b';
            ctx.font = '9px sans-serif';
            ctx.fillText(d.date.slice(5), x + barW / 2, H - padB + 14);
        });
    },

    addExercise() {
        const date = document.getElementById('exerciseDate').value;
        const name = document.getElementById('exerciseName').value.trim();
        const duration = parseInt(document.getElementById('exerciseDuration').value);
        if (!date || !name || isNaN(duration)) { showToast('请填写完整'); return; }
        const data = getData();
        data.stats.exercise.push({ id: Date.now().toString(), date, name, duration });
        saveData(data);
        this.renderExerciseChart();
        this.renderExerciseList();
        showToast('已添加运动记录');
    },

    renderExerciseList() {
        const data = getData().stats.exercise.sort((a,b) => b.date.localeCompare(a.date));
        const list = document.getElementById('exerciseList');
        if (data.length === 0) { list.innerHTML = '<div style="color:var(--text-light);font-size:12px;padding:8px;">暂无数据</div>'; return; }
        list.innerHTML = data.map(d => `
            <div class="stats-data-item">
                <div class="stats-data-info">${d.date} | ${escapeHtml(d.name)} | ${d.duration} 分钟</div>
                <div class="stats-data-actions">
                    <button class="stats-del-btn" onclick="Stats.delExercise('${d.id}')">删除</button>
                </div>
            </div>
        `).join('');
    },

    delExercise(id) {
        const data = getData();
        data.stats.exercise = data.stats.exercise.filter(d => d.id !== id);
        saveData(data);
        this.renderExerciseChart();
        this.renderExerciseList();
    },

    // ===== 图表工具 =====
    _setupCanvas(canvas) {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        canvas.getContext('2d').scale(2, 2);
        // 重新设置为CSS尺寸
        canvas.width = rect.width;
        canvas.height = rect.height;
    },

    _drawEmpty(ctx, W, H) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据，添加后显示图表', W / 2, H / 2);
    }
};

// ===== 数据导入导出 =====
function exportData() {
    const data = getData();
    const exportObj = {
        version: 2,
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

                // 合并 records：按 id 去重，新数据补充，同 id 的更新
                if (imported.records) {
                    const map = new Map();
                    current.records.forEach(r => map.set(r.id, r));
                    imported.records.forEach(r => map.set(r.id, r));
                    current.records = Array.from(map.values());
                }

                // 合并 todos：按 id 去重
                if (imported.todos) {
                    const map = new Map();
                    current.todos.forEach(t => map.set(t.id, t));
                    imported.todos.forEach(t => map.set(t.id, t));
                    current.todos = Array.from(map.values());
                }

                // 合并 feelings：按日期 key 合并
                if (imported.feelings) {
                    Object.assign(current.feelings, imported.feelings);
                }

                // 合并 stats：按 id 去重
                if (imported.stats) {
                    ['sleep', 'weight', 'expense', 'exercise'].forEach(key => {
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
    el.recordModal.addEventListener('click', (e) => { if (e.target === el.recordModal) closeModalFn(); });
    el.recordForm.addEventListener('submit', handleSubmit);
    el.deleteBtn.addEventListener('click', handleDelete);

    el.closeFeelingModal.addEventListener('click', closeFeelingModalFn);
    el.cancelFeelingBtn.addEventListener('click', closeFeelingModalFn);
    el.feelingModal.addEventListener('click', (e) => { if (e.target === el.feelingModal) closeFeelingModalFn(); });
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
    el.newTodoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(); });
    el.todoList.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        if (target.dataset.action === 'toggle') toggleTodo(target.dataset.id);
        else if (target.dataset.action === 'delete') deleteTodo(target.dataset.id);
    });

    // 自然语言输入
    el.nlParseBtn.addEventListener('click', handleNLParse);

    // 查看已完成
    document.getElementById('toggleCompletedBtn')?.addEventListener('click', () => {
        showCompletedTodos = !showCompletedTodos;
        renderTodoList();
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
        if (el.recordModal.classList.contains('active') || el.feelingModal.classList.contains('active')) {
            if (e.key === 'Escape') { closeModalFn(); closeFeelingModalFn(); }
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
