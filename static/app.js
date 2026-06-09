const API = 'https://recycled-mystify-mahogany.ngrok-free.dev';

function getToken() { return localStorage.getItem('token'); }
function getUsername() { return localStorage.getItem('username'); }

function showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast ' + type;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('hidden'), 2500);
}

function api(path, options = {}) {
    const headers = options.headers || {};
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    headers['ngrok-skip-browser-warning'] = '1';
    return fetch(API + path, { ...options, headers }).then(r => {
        if (!r.ok) return r.json().then(e => { throw e; });
        if (r.status === 204) return null;
        return r.json();
    });
}

function showPanel(id) {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// Tab 切换
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.getElementById('login-form').classList.toggle('hidden', target !== 'login');
        document.getElementById('register-form').classList.toggle('hidden', target !== 'register');
    });
});

// 回车快捷
document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
document.getElementById('reg-password').addEventListener('keydown', e => { if (e.key === 'Enter') register(); });
document.getElementById('todo-title').addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });

// ========== 认证 ==========

async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) return showToast('请输入用户名和密码', 'error');
    try {
        const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('username', data.username);
        showToast('登录成功', 'success');
        enterApp();
    } catch (e) {
        showToast(e.detail || '登录失败', 'error');
    }
}

async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    if (!username || !password) return showToast('请输入用户名和密码', 'error');
    if (password.length < 6) return showToast('密码至少6位', 'error');
    try {
        await api('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
        showToast('注册成功，请登录', 'success');
        document.querySelectorAll('.tab')[0].click();
        document.getElementById('login-username').value = username;
    } catch (e) {
        showToast(e.detail || '注册失败', 'error');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    location.reload();
}

// ========== 主界面 ==========

function enterApp() {
    showPanel('main-panel');
    const name = getUsername();
    document.getElementById('username-display').textContent = name;
    document.getElementById('avatar-display').textContent = name.charAt(0).toUpperCase();
    loadTodos();
    loadStats();
}

async function loadTodos() {
    try {
        const todos = await api('/todos/');
        renderTodos(todos);
    } catch (e) {
        showToast('会话过期，请重新登录', 'error');
        logout();
    }
}

async function loadStats() {
    try {
        const todos = await api('/todos/');
        const active = todos.filter(t => !t.is_completed).length;
        document.getElementById('todo-count').textContent = active;
        document.getElementById('total-count').textContent = todos.length;
    } catch (e) { /* ignore */ }

    try {
        const data = await api('/redis/todo-count');
        document.getElementById('cache-badge').textContent = data.source.includes('Redis') ? '⚡ 缓存' : '💾 DB';
    } catch (e) { document.getElementById('cache-badge').textContent = '💾 DB'; }
}

function renderTodos(todos) {
    const container = document.getElementById('todo-list');
    const empty = document.getElementById('empty-state');

    if (todos.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    container.innerHTML = todos.map(t => `
        <div class="todo-item ${t.is_completed ? 'completed' : ''}" id="todo-${t.id}">
            ${t.is_completed
                ? '<span class="todo-check"></span>'
                : '<span class="todo-check" onclick="markDone(' + t.id + ')" title="标记完成"></span>'}
            <div class="todo-body">
                <div class="todo-title-text">${escapeHtml(t.title)}</div>
                ${t.content ? '<div class="todo-content-text">' + escapeHtml(t.content) + '</div>' : ''}
            </div>
            <div class="todo-actions" id="actions-${t.id}">
                ${t.is_completed
                    ? '<button class="btn btn-sm" onclick="markUndo(' + t.id + ')">撤销</button>'
                    : '<button class="btn btn-sm" onclick="startEdit(' + t.id + ",'" + escapeAttr(t.title) + "','" + escapeAttr(t.content || '') + "')\">编辑</button>"}
                <button class="btn btn-danger btn-sm" onclick="deleteTodo(${t.id})">删除</button>
            </div>
        </div>
    `).join('');
}

// ========== CRUD ==========

async function addTodo() {
    const title = document.getElementById('todo-title').value.trim();
    const content = document.getElementById('todo-content').value.trim();
    if (!title) return showToast('请输入任务标题', 'error');
    try {
        await api('/todos/', { method: 'POST', body: JSON.stringify({ title, content: content || null }) });
        document.getElementById('todo-title').value = '';
        document.getElementById('todo-content').value = '';
        showToast('添加成功', 'success');
        loadTodos();
        loadStats();
    } catch (e) { showToast(e.detail || '添加失败', 'error'); }
}

async function deleteTodo(id) {
    if (!confirm('确认删除这条任务？')) return;
    try {
        await api('/todos/' + id, { method: 'DELETE' });
        showToast('已删除', 'success');
        loadTodos();
        loadStats();
    } catch (e) { showToast(e.detail || '删除失败', 'error'); }
}

async function markDone(id) {
    try {
        await api('/todos/' + id, { method: 'PUT', body: JSON.stringify({ is_completed: true }) });
        loadTodos();
        loadStats();
    } catch (e) { showToast(e.detail || '操作失败', 'error'); }
}

async function markUndo(id) {
    try {
        await api('/todos/' + id, { method: 'PUT', body: JSON.stringify({ is_completed: false }) });
        loadTodos();
        loadStats();
    } catch (e) { showToast(e.detail || '操作失败', 'error'); }
}

function startEdit(id, title, content) {
    const item = document.getElementById('todo-' + id);
    const actions = document.getElementById('actions-' + id);
    const body = item.querySelector('.todo-body');
    const check = item.querySelector('.todo-check');
    if (check) check.style.pointerEvents = 'none';

    body.innerHTML = `
        <input class="edit-input" id="edit-title-${id}" value="${title}" style="margin-bottom:6px;display:block;width:100%;">
        <input class="edit-input" id="edit-content-${id}" value="${content}" placeholder="详细描述..." style="display:block;width:100%;">
    `;
    actions.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="saveEdit(${id})">保存</button>
        <button class="btn btn-sm" onclick="loadTodos();loadStats();">取消</button>
    `;
    document.getElementById('edit-title-' + id).focus();
}

async function saveEdit(id) {
    const title = document.getElementById('edit-title-' + id).value.trim();
    const content = document.getElementById('edit-content-' + id).value.trim();
    if (!title) return showToast('标题不能为空', 'error');
    try {
        await api('/todos/' + id, { method: 'PUT', body: JSON.stringify({ title, content: content || null }) });
        showToast('已更新', 'success');
        loadTodos();
        loadStats();
    } catch (e) { showToast(e.detail || '保存失败', 'error'); }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ========== 初始化 ==========

if (getToken()) { enterApp(); } else { showPanel('auth-panel'); }
