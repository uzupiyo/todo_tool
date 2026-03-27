// [文字](URL) をリンクに変換
function renderText(text) {
    return text.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
const taskInput = document.getElementById('taskInput');
const categoryInput = document.getElementById('categoryInput');
const priorityInput = document.getElementById('priorityInput');
const addBtn = document.getElementById('addBtn');
const taskList = document.getElementById('taskList');

window.onload = loadTasks;
addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });

// ── ソート ────────────────────────────────────────────────
let currentSort = null; // 'star' | 'category' | 'date'

const CATEGORY_ORDER = ['メンテ', 'サーバー', 'IDC', '自主', '設置前設定', '設置後設定', '撤去後設定'];

document.getElementById('sortStar').addEventListener('click', () => setSort('star'));
document.getElementById('sortCategory').addEventListener('click', () => setSort('category'));
document.getElementById('sortDate').addEventListener('click', () => setSort('date'));

function setSort(key) {
    currentSort = key;
    document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`sort${key.charAt(0).toUpperCase() + key.slice(1)}`).classList.add('active');
    applySortToDOM();
}

function applySortToDOM() {
    const items = [...taskList.querySelectorAll('li')];
    items.sort((a, b) => {
        // 完了済みは常に下
        const ac = a.classList.contains('completed') ? 1 : 0;
        const bc = b.classList.contains('completed') ? 1 : 0;
        if (ac !== bc) return ac - bc;

        if (currentSort === 'star') {
            const as = a.querySelector('.priority-star').textContent === '★' ? 0 : 1;
            const bs = b.querySelector('.priority-star').textContent === '★' ? 0 : 1;
            return as - bs;
        }
        if (currentSort === 'category') {
            const ai = CATEGORY_ORDER.indexOf(a.querySelector('.tag-badge').textContent);
            const bi = CATEGORY_ORDER.indexOf(b.querySelector('.tag-badge').textContent);
            return ai - bi;
        }
        if (currentSort === 'date') {
            // "M/D" → 比較用数値
            const parseDate = el => {
                const [m, d] = el.querySelector('.date-badge').textContent.split('/').map(Number);
                return m * 100 + d;
            };
            return parseDate(a) - parseDate(b);
        }
        return 0;
    });
    items.forEach(item => taskList.appendChild(item));
}

// ── タスク追加 ────────────────────────────────────────────
function addTask() {
    let text = taskInput.value.trim();
    if (!text) return;
    const urlText = document.getElementById('urlText').value.trim();
    const url    = document.getElementById('urlInput').value.trim();
    if (url) {
        const label = urlText || url;
        text += ` [${label}](${url})`;
    }
    const now = new Date();
    const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;
    createTaskElement(dateStr, text, categoryInput.value, priorityInput.value, false);
    saveTasks();
    if (currentSort) applySortToDOM();
    taskInput.value = '';
    document.getElementById('urlText').value = '';
    document.getElementById('urlInput').value = '';
}

function createTaskElement(date, text, category, star, isCompleted) {
    const li = document.createElement('li');
    if (isCompleted) li.classList.add('completed');

    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';
    cardHeader.innerHTML = `<span class="date-badge">${date}</span><span class="priority-star" title="クリックで★切替">${star}</span>`;

    const starEl = cardHeader.querySelector('.priority-star');
    starEl.style.cursor = 'pointer';
    starEl.addEventListener('click', () => {
        starEl.textContent = starEl.textContent === '★' ? '☆' : '★';
        saveTasks();
        if (currentSort === 'star') applySortToDOM();
    });

    const tagBadge = document.createElement('div');
    tagBadge.className = `tag-badge tag-${category}`;
    tagBadge.textContent = category;

    const taskText = document.createElement('span');
    taskText.className = 'task-text';
    taskText.dataset.raw = text;
    taskText.innerHTML = renderText(text);
    taskText.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') return;
        enableEdit(taskText);
    });

    const btnGroup = document.createElement('div');
    btnGroup.className = 'btn-group';
    btnGroup.innerHTML = `<button class="action-btn done-btn">完了</button><button class="action-btn delete-btn">削除</button>`;

    btnGroup.querySelector('.done-btn').addEventListener('click', () => {
        li.classList.toggle('completed');
        saveTasks();
        if (currentSort) applySortToDOM(); else reSortCompleted();
    });
    btnGroup.querySelector('.delete-btn').addEventListener('click', () => {
        li.remove();
        saveTasks();
    });

    li.appendChild(cardHeader);
    li.appendChild(tagBadge);
    li.appendChild(taskText);
    li.appendChild(btnGroup);

    // 新規タスクは完了済みの前に挿入
    const firstCompleted = taskList.querySelector('li.completed');
    taskList.insertBefore(li, firstCompleted || null);
}

// ソートなし時の完了後整列（完了済みを下に）
function reSortCompleted() {
    const items = [...taskList.querySelectorAll('li')];
    items.sort((a, b) => {
        return (a.classList.contains('completed') ? 1 : 0) - (b.classList.contains('completed') ? 1 : 0);
    });
    items.forEach(item => taskList.appendChild(item));
}

// ── 編集 ─────────────────────────────────────────────────
function enableEdit(element) {
    const li = element.closest('li');
    if (li.classList.contains('completed')) return;
    if (li.querySelector('.edit-container')) return;

    // data-raw から本文とリンクを分離
    const raw = element.dataset.raw || element.innerText;
    const linkMatch = raw.match(/^([\s\S]*?)\s*\[([^\]]*)\]\((https?:\/\/[^)]+)\)\s*$/);
    const currentBody    = linkMatch ? linkMatch[1].trim() : raw;
    const currentLinkText = linkMatch ? linkMatch[2] : '';
    const currentUrl     = linkMatch ? linkMatch[3] : '';

    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container';

    // タスク本文
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-input';
    input.value = currentBody;
    input.placeholder = 'タスク内容';

    // URLフィールド行
    const urlRow = document.createElement('div');
    urlRow.className = 'edit-url-row';

    const urlTextInput = document.createElement('input');
    urlTextInput.type = 'text';
    urlTextInput.className = 'edit-input edit-url-text';
    urlTextInput.value = currentLinkText;
    urlTextInput.placeholder = '表示テキスト（任意）';

    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.className = 'edit-input edit-url-url';
    urlInput.value = currentUrl;
    urlInput.placeholder = 'URL（任意）';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'clear-link-btn';
    clearBtn.textContent = '🗑';
    clearBtn.title = 'リンクを削除';
    clearBtn.addEventListener('mousedown', (e) => e.preventDefault());
    clearBtn.addEventListener('click', () => { urlTextInput.value = ''; urlInput.value = ''; });

    urlRow.appendChild(urlTextInput);
    urlRow.appendChild(urlInput);
    urlRow.appendChild(clearBtn);

    // 確定ボタン
    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-btn';
    saveBtn.textContent = '変更確定';

    editContainer.appendChild(input);
    editContainer.appendChild(urlRow);
    editContainer.appendChild(saveBtn);
    element.replaceWith(editContainer);
    input.focus();
    input.select();

    let done = false;

    const finish = (cancel = false) => {
        if (done) return;
        done = true;
        document.removeEventListener('pointerdown', onOutsideClick, true);
        if (!cancel) {
            const body = input.value.trim() || currentBody;
            const lt  = urlTextInput.value.trim();
            const url = urlInput.value.trim();
            const newRaw = url ? `${body} [${lt || url}](${url})` : body;
            element.dataset.raw = newRaw;
            element.innerHTML = renderText(newRaw);
            saveTasks();
        }
        editContainer.replaceWith(element);
    };

    const onOutsideClick = (e) => {
        if (!editContainer.contains(e.target)) finish(true);
    };
    setTimeout(() => document.addEventListener('pointerdown', onOutsideClick, true), 0);

    saveBtn.addEventListener('mousedown', (e) => e.preventDefault());
    saveBtn.addEventListener('click', () => finish(false));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish(false);
        if (e.key === 'Escape') finish(true);
    });
}

// ── 保存・読込 ────────────────────────────────────────────
function saveTasks() {
    const tasks = [];
    document.querySelectorAll('#taskList li').forEach(li => {
        const taskTextEl = li.querySelector('.task-text');
        const editInputEl = li.querySelector('.edit-input');
        tasks.push({
            date: li.querySelector('.date-badge').textContent,
            star: li.querySelector('.priority-star').textContent,
            category: li.querySelector('.tag-badge').textContent,
            text: taskTextEl ? taskTextEl.dataset.raw : (editInputEl ? editInputEl.value : ''),
            completed: li.classList.contains('completed')
        });
    });
    localStorage.setItem('myFinalAppV2', JSON.stringify(tasks));
}

function loadTasks() {
    const saved = localStorage.getItem('myFinalAppV2');
    if (!saved) return;
    let tasks = JSON.parse(saved);
    tasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed - b.completed;
        return 0;
    });
    tasks.forEach(t => createTaskElement(t.date, t.text, t.category, t.star, t.completed));
}
