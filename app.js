// ===== 数据存储 =====
const STORAGE_KEY = 'life_recorder_data';

function getDefaultData() {
    return { records: [], todos: [], feelings: {} };
}

function getData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return getDefaultData();
        const data = JSON.parse(raw);
        if (!data.records) data.records = [];
        if (!data.todos) data.todos = [];
        if (!data.feelings) data.feelings = {};
        // 迁移：旧 feelings 从 string 转为 object
        for (const k in data.feelings) {
            if (typeof data.feelings[k] === 'string') {
                data.feelings[k] = { text: data.feelings[k], image: null };
            }
        }
        // 迁移：旧 todos 添加 date 字段
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
    focus: { icon: '🍅', label: '专注' }, // 保留兼容旧数据
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
    return (visualHour(h) * 60 + m); // px, 1min = 1px
}

// ===== 事件合并（按标题） =====
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

    // 本月已度过小时数
    const now = new Date();
    let elapsedHours = 0;
    if (now.getFullYear() === year && now.getMonth() === month) {
        // 当前月：已过天数 * 24 + 当前小时
        elapsedHours = (now.getDate() - 1) * 24 + now.getHours() + now.getMinutes() / 60;
    } else if (now > new Date(year, month + 1, 0)) {
        elapsedHours = totalHours;
    }
    const percent = ((elapsedHours / totalHours) * 100).toFixed(1);

    // 累计专注分钟（fromPomodoro 标记的记录）
    let focusMinutes = 0;
    data.records.forEach(r => {
        if (r.date && r.date.startsWith(prefix) && r.fromPomodoro) {
            focusMinutes += calcDurationMinutes(r.startTime, r.endTime);
        }
    });

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

    return { percent, focusMinutes, completedCount, pendingCount };
}

// ===== 本周待办 =====
function getWeekTodos() {
    const data = getData();
    const now = new Date();
    const weekStart = getWeekStart(now);
    const weekStartStr = formatDate(weekStart);
    return data.todos.filter(t => {
        if (!t.completed) return true;
        if (t.completedAt && t.completedAt >= weekStartStr) return true;
        return false;
    });
}

// ===== 某日待办 =====
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
        // 每日随机：用日期做种子
        const today = new Date();
        const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
        dailyQuote = quotes[seed % quotes.length];
    } catch (e) {
        // fetch 失败则使用默认文案
    }
}

// ===== 状态 =====
let currentView = 'home';
let currentDate = new Date();
let editingRecordId = null;
let editingFeelingDate = null;
let showCompletedTodos = false;

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
    // Record modal
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
    // Feeling modal
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
    // FAB & Toast
    el.fabAdd = document.getElementById('fabAdd');
    el.toast = document.getElementById('toast');
    // Todo
    el.newTodoInput = document.getElementById('newTodoInput');
    el.newTodoDate = document.getElementById('newTodoDate');
    el.newTodoTime = document.getElementById('newTodoTime');
    el.addTodoBtn = document.getElementById('addTodoBtn');
    el.todoList = document.getElementById('todoList');
    // Pomodoro
    el.pomodoroTitle = document.getElementById('pomodoroTitle');
    el.pomodoroType = document.getElementById('pomodoroType');
    el.pomodoroTime = document.getElementById('pomodoroTime');
    el.pomodoroMode = document.getElementById('pomodoroMode');
    el.pomodoroProgress = document.getElementById('pomodoroProgress');
    el.pomodoroStartBtn = document.getElementById('pomodoroStartBtn');
    el.pomodoroFinishBtn = document.getElementById('pomodoroFinishBtn');
    el.pomodoroResetBtn = document.getElementById('pomodoroResetBtn');
    el.todayFocusMin = document.getElementById('todayFocusMin');
    el.todayPomodoroCount = document.getElementById('todayPomodoroCount');
    // Day view
    el.dayTodoBar = document.getElementById('dayTodoBar');
    el.dayTimeline = document.getElementById('dayTimeline');
}

// ===== 视图切换 =====
function switchView(view) {
    currentView = view;
    el.navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
    el.views.forEach(v => v.classList.toggle('active', v.id === `${view}View`));
    el.dateControls.style.display = view === 'home' ? 'none' : 'flex';
    el.fabAdd.style.display = view === 'home' ? 'none' : 'block';
    render();
}

// ===== 日期导航 =====
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
        const we = new Date(ws); we.setDate(we.getDate() + 6);
        el.currentDate.textContent = `${ws.getMonth()+1}月${ws.getDate()}日 - ${we.getMonth()+1}月${we.getDate()}日`;
    } else {
        el.currentDate.textContent = `${currentDate.getFullYear()}年${currentDate.getMonth()+1}月`;
    }
}

// ===== 渲染总控 =====
function render() {
    updateDateDisplay();
    if (currentView === 'home') renderHomeView();
    else if (currentView === 'day') renderDayView();
    else if (currentView === 'week') renderWeekView();
    else if (currentView === 'month') renderMonthView();
}

// ===== 首页 =====
function renderHomeView() {
    el.artTitle.textContent = dailyQuote;
    renderTodoList();
    updatePomodoroStats();
}

function renderTodoList() {
    const todos = getWeekTodos();
    const toggleBtn = document.getElementById('toggleCompletedBtn');
    
    // Check if there are completed todos
    const hasCompleted = todos.some(t => t.completed);
    if (toggleBtn) {
        toggleBtn.style.display = hasCompleted ? 'inline-block' : 'none';
        toggleBtn.textContent = showCompletedTodos ? '🙈 隐藏已完成' : '👁 查看已完成';
        toggleBtn.classList.toggle('active', showCompletedTodos);
    }

    // Filter based on showCompletedTodos
    const displayTodos = showCompletedTodos ? todos : todos.filter(t => !t.completed);
    
    displayTodos.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    if (displayTodos.length === 0) {
        el.todoList.innerHTML = '<div style="text-align:center;color:var(--text-light);padding:20px;">暂无待办，添加一个吧 ✨</div>';
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

function toggleShowCompleted() {
    showCompletedTodos = !showCompletedTodos;
    renderTodoList();
}

// ===== 日视图 =====
function renderDayView() {
    const dateStr = formatDate(currentDate);
    const data = getData();
    const records = data.records.filter(r => r.date === dateStr);
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

    // 时间轴：显示顺序 6,7,...,23,0,1,2,3,4,5
    const displayOrder = [];
    for (let i = 6; i <= 23; i++) displayOrder.push(i);
    for (let i = 0; i <= 5; i++) displayOrder.push(i);

    let html = '';

    // 绘制小时线和可点击区域
    displayOrder.forEach((realHour, idx) => {
        const yPos = idx * 60;
        const hourStr = String(realHour).padStart(2, '0') + ':00';
        html += `<div class="day-hour-label" style="top:${yPos}px;">${hourStr}</div>`;
        html += `<div class="day-hour-slot" style="top:${yPos}px;" data-date="${dateStr}" data-hour="${realHour}"></div>`;
    });

    // 在 23:00 和 0:00 之间画分隔线（idx=18 是 0:00）
    const sepY = 18 * 60; // 18 hours after 6:00
    html += `<div class="day-separator" style="top:${sepY}px;"></div>`;
    html += `<div class="day-separator-label" style="top:${sepY}px;">── 次日凌晨 ──</div>`;

    // 绘制事件块（绝对定位）
    const layoutResult = layoutEvents(records);
    layoutResult.forEach(item => {
        const record = item.record;
        const config = TYPE_CONFIG[record.type] || TYPE_CONFIG.other;

        // 计算视觉位置
        let startY = visualY(record.startTime);
        let endY = visualY(record.endTime);

        // 处理跨 6AM 边界的情况
        if (endY <= startY) {
            // 事件跨越了 6AM 边界（如 5:00-7:00）
            // 在视觉布局中，5:00 在底部，7:00 在顶部
            // 只显示下半部分（从起始时间到时间轴底部）
            endY = 1440;
        }

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

    // 滚动到 6:00 位置（即顶部）
    const wrapper = el.dayView.querySelector('.day-timeline-wrapper');
    if (wrapper && !wrapper._scrolled) {
        wrapper.scrollTop = 0;
        wrapper._scrolled = true;
    }

    // 事件绑定
    el.dayTimeline.querySelectorAll('.day-hour-slot').forEach(slot => {
        slot.addEventListener('click', (e) => {
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

// ===== 事件布局算法（并行检测） =====
function layoutEvents(records) {
    if (records.length === 0) return [];

    // 按开始时间排序
    const sorted = [...records].sort((a, b) => a.startTime.localeCompare(b.startTime));

    // 分配列
    const columns = []; // 每列存放不重叠的事件
    const assignments = []; // { record, col }

    sorted.forEach(record => {
        const rStart = timeToMinutes(record.startTime);
        const rEnd = timeToMinutes(record.endTime);
        let placed = false;
        for (let c = 0; c < columns.length; c++) {
            const lastEnd = columns[c];
            if (rStart >= lastEnd) {
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

    // 计算每个事件所在重叠组的最大列数
    // 简化方案：对每个事件，找出所有与它时间重叠的事件，取最大列数
    const result = assignments.map(a => {
        const rStart = timeToMinutes(a.record.startTime);
        const rEnd = timeToMinutes(a.record.endTime);
        let maxCol = a.col;
        assignments.forEach(b => {
            const bStart = timeToMinutes(b.record.startTime);
            const bEnd = timeToMinutes(b.record.endTime);
            // 检查是否重叠
            if (bStart < rEnd && bEnd > rStart) {
                maxCol = Math.max(maxCol, b.col);
            }
        });
        const totalCols = maxCol + 1;
        return {
            record: a.record,
            col: a.col,
            widthPct: 100 / totalCols
        };
    });

    return result;
}

// ===== 周视图 =====
function renderWeekView() {
    const weekGrid = el.weekView.querySelector('.week-grid');
    const weekStart = getWeekStart(currentDate);
    const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
    const data = getData();

    let html = '';
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        const dateStr = formatDate(date);
        const todayClass = isToday(date) ? 'today' : '';

        // 合并事件（最多7条）
        const merged = getMergedEvents(dateStr, 7);
        const allMerged = getMergedEvents(dateStr);
        const hasMore = allMerged.length > 7;

        // 当日待办
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
            if (hasMore) {
                html += `<div class="week-more">...还有 ${allMerged.length - 7} 项</div>`;
            }
        }

        html += `</div>`;

        // 待办区域（紧跟日程下方，允许浮动）
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

    // 事件绑定
    weekGrid.querySelectorAll('.week-add-btn').forEach(btn => {
        btn.addEventListener('click', () => openAddModal(btn.dataset.date, '09:00', '10:00'));
    });

    // 周视图待办点击切换
    weekGrid.querySelectorAll('.week-todo-item').forEach(item => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
            const todoId = item.dataset.todoId;
            if (todoId) toggleTodo(todoId);
        });
    });
}

// ===== 月视图 =====
function renderMonthView() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // 看板
    const stats = getMonthStats(year, month);
    el.monthDashboard.innerHTML = `
        <span>📊 本月看板：</span>
        本月已度过 <span class="highlight">${stats.percent}%</span>，
        累计专注 <span class="highlight">${stats.focusMinutes}</span> 分钟，
        完成待办 <span class="highlight">${stats.completedCount}</span> 件，
        尚有 <span class="highlight">${stats.pendingCount}</span> 件待办待完成。
    `;

    // 日历
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

        // 感悟
        const feeling = data.feelings[dateStr];
        const hasFeeling = feeling && (feeling.text || feeling.image);
        const feelingClass = hasFeeling ? 'has-feeling' : '';
        const bgStyle = (hasFeeling && feeling.image) ? `background-image:url('${feeling.image}');` : '';

        html += `<div class="month-cell ${todayClass} ${otherClass} ${feelingClass}" style="${bgStyle}" data-date="${dateStr}">
            <div class="month-cell-inner">
                <div class="month-date">${date.getDate()}</div>`;

        if (hasFeeling && feeling.text) {
            html += `<div class="month-feeling-text">${escapeHtml(feeling.text)}</div>`;
        }

        html += `</div></div>`;

        if (date >= lastDay && date.getDay() === 0) break;
    }

    html += '</div>';
    monthGrid.innerHTML = html;

    // 点击日期 → 编辑感悟
    monthGrid.querySelectorAll('.month-cell').forEach(cell => {
        cell.addEventListener('click', (e) => {
            if (!cell.classList.contains('other-month')) {
                openFeelingModal(cell.dataset.date);
            }
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

    // 更新预览
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

    // 检查是否有新图片
    const file = el.feelingImage.files[0];
    if (file) {
        compressImage(file, 400, 300, (dataUrl) => {
            processAndSave(dataUrl);
        });
    } else {
        // 保留旧图片
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
            // 裁切为 maxW:maxH 比例
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
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, maxW, maxH);
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
    // 重置日期时间为当前
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

// ===== 番茄钟 =====
const Pomodoro = {
    WORK_DURATION: 25 * 60,
    state: 'idle', // idle, running, paused, completed
    timeLeft: 25 * 60,
    totalTime: 25 * 60,
    interval: null,
    actualStartTime: null,
    actualStartDate: null,
    overtimeSeconds: 0,
    circumference: 2 * Math.PI * 90,

    start() {
        if (this.state === 'idle' || this.state === 'paused') {
            if (this.state === 'idle') {
                const now = new Date();
                this.actualStartTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
                this.actualStartDate = formatDate(now);
                this.overtimeSeconds = 0;
            }
            this.state = 'running';
            this.interval = setInterval(() => this.tick(), 1000);
            this.updateUI();
        }
    },

    pause() {
        if (this.state === 'running') {
            this.state = 'paused';
            clearInterval(this.interval);
            this.updateUI();
        }
    },

    reset() {
        clearInterval(this.interval);
        this.state = 'idle';
        this.timeLeft = this.WORK_DURATION;
        this.totalTime = this.WORK_DURATION;
        this.actualStartTime = null;
        this.actualStartDate = null;
        this.overtimeSeconds = 0;
        el.pomodoroProgress.classList.remove('overtime');
        this.updateUI();
    },

    tick() {
        if (this.timeLeft > 0) {
            this.timeLeft--;
            if (this.timeLeft <= 0) {
                // 25分钟到
                playBeep();
                this.state = 'completed';
                clearInterval(this.interval);
                showToast('🍅 25分钟到！点击「结束专注」记录时长');
            }
        } else {
            // 超时计时
            this.overtimeSeconds++;
        }
        this.updateUI();
    },

    finish() {
        // 结束专注：记录实际时长
        const now = new Date();
        const endTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        const title = el.pomodoroTitle.value.trim() || '🍅 专注';
        const type = el.pomodoroType.value || 'study';

        const data = getData();
        data.records.push({
            id: Date.now().toString(),
            date: this.actualStartDate || formatDate(now),
            startTime: this.actualStartTime,
            endTime: endTime,
            title: title,
            type: type,
            note: '',
            fromPomodoro: true
        });
        saveData(data);

        const totalMins = calcDurationMinutes(this.actualStartTime, endTime);
        showToast(`🍅 专注完成！共 ${totalMins} 分钟`);
        this.reset();
        updatePomodoroStats();
        if (currentView === 'day') render();
    },

    updateUI() {
        let displayTime;
        if (this.state === 'completed' || (this.state === 'running' && this.timeLeft <= 0)) {
            // 显示超时
            displayTime = `+${String(Math.floor(this.overtimeSeconds / 60)).padStart(2,'0')}:${String(this.overtimeSeconds % 60).padStart(2,'0')}`;
        } else {
            const mins = Math.floor(this.timeLeft / 60);
            const secs = this.timeLeft % 60;
            displayTime = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        }
        el.pomodoroTime.textContent = displayTime;

        // 进度环
        if (this.state === 'completed') {
            el.pomodoroProgress.style.strokeDashoffset = 0;
            el.pomodoroProgress.classList.add('overtime');
        } else {
            const progress = 1 - (this.timeLeft / this.totalTime);
            const offset = this.circumference * (1 - progress);
            el.pomodoroProgress.style.strokeDashoffset = offset;
            el.pomodoroProgress.classList.remove('overtime');
        }

        // 模式标签
        if (this.state === 'completed') {
            el.pomodoroMode.textContent = '已完成！';
        } else {
            el.pomodoroMode.textContent = '专注';
        }

        // 按钮显示
        if (this.state === 'completed') {
            el.pomodoroStartBtn.style.display = 'none';
            el.pomodoroFinishBtn.style.display = 'inline-block';
        } else {
            el.pomodoroFinishBtn.style.display = 'none';
            el.pomodoroStartBtn.style.display = 'inline-block';
            if (this.state === 'running') {
                el.pomodoroStartBtn.textContent = '暂停';
            } else if (this.state === 'paused') {
                el.pomodoroStartBtn.textContent = '继续';
            } else {
                el.pomodoroStartBtn.textContent = '开始';
            }
        }
    }
};

function updatePomodoroStats() {
    const data = getData();
    const todayStr = formatDate(new Date());
    const todayRecords = data.records.filter(r => r.date === todayStr && r.fromPomodoro);
    let totalMins = 0;
    todayRecords.forEach(r => { totalMins += calcDurationMinutes(r.startTime, r.endTime); });
    el.todayFocusMin.textContent = totalMins;
    el.todayPomodoroCount.textContent = todayRecords.length;
}

function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start();
        setTimeout(() => { osc.stop(); ctx.close(); }, 500);
    } catch (e) {}
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

// ===== 数据导入导出 =====
function exportData() {
    const data = getData();
    const exportObj = {
        version: 1,
        exportDate: new Date().toISOString(),
        records: data.records,
        todos: data.todos,
        feelings: data.feelings
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
                const data = JSON.parse(ev.target.result);
                const currentData = getData();
                // 合并数据（导入的数据覆盖当前数据）
                if (data.records) currentData.records = data.records;
                if (data.todos) currentData.todos = data.todos;
                if (data.feelings) currentData.feelings = data.feelings;
                saveData(currentData);
                render();
                showToast('数据导入成功');
            } catch (err) {
                showToast('导入失败：文件格式错误');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ===== 事件绑定 =====
function bindEvents() {
    // 视图切换
    el.navBtns.forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // 日期导航
    el.prevBtn.addEventListener('click', () => navigateDate(-1));
    el.nextBtn.addEventListener('click', () => navigateDate(1));
    el.todayBtn.addEventListener('click', goToday);

    // FAB
    el.fabAdd.addEventListener('click', () => openAddModal());

    // 导入导出
    document.getElementById('exportDataBtn')?.addEventListener('click', exportData);
    document.getElementById('importDataBtn')?.addEventListener('click', importData);

    // 日程弹窗
    el.closeModal.addEventListener('click', closeModalFn);
    el.cancelBtn.addEventListener('click', closeModalFn);
    el.recordModal.addEventListener('click', (e) => { if (e.target === el.recordModal) closeModalFn(); });
    el.recordForm.addEventListener('submit', handleSubmit);
    el.deleteBtn.addEventListener('click', handleDelete);

    // 感悟弹窗
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

    // 待办
    el.addTodoBtn.addEventListener('click', addTodo);
    el.newTodoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(); });
    el.todoList.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const id = target.dataset.id;
        if (action === 'toggle') toggleTodo(id);
        else if (action === 'delete') deleteTodo(id);
    });

    // 番茄钟
    el.pomodoroStartBtn.addEventListener('click', () => {
        if (Pomodoro.state === 'running') Pomodoro.pause();
        else Pomodoro.start();
    });
    el.pomodoroFinishBtn.addEventListener('click', () => Pomodoro.finish());
    el.pomodoroResetBtn.addEventListener('click', () => Pomodoro.reset());

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
    Pomodoro.updateUI();
    render();
}

init();
