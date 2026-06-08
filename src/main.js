const API = 'https://recycled-mystify-mahogany.ngrok-free.dev';

function getToken() { return localStorage.getItem('token'); }
function getUsername() { return localStorage.getItem('username'); }

function api(path, options = {}) {
    const headers = options.headers || {};
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    return fetch(API + path, { ...options, headers }).then(r => {
        if (!r.ok) return r.json().then(e => { throw e; });
        if (r.status === 204) return null;
        return r.json();
    });
}

// ========== 页面切换 ==========

function showPanel(id) {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// ========== Tab 切换 ==========

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.getElementById('login-form').classList.toggle('hidden', target !== 'login');
        document.getElementById('register-form').classList.toggle('hidden', target !== 'register');
    });
});

// ========== 认证 ==========

async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) return alert('请输入用户名和密码');
    try {
        const data = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('username', data.username);
        enterApp();
    } catch (e) {
        alert(e.detail || '登录失败');
    }
}

async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    if (!username || !password) return alert('请输入用户名和密码');
    if (password.length < 6) return alert('密码至少6位');
    try {
        await api('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        alert('注册成功，请登录');
        document.querySelectorAll('.tab')[0].click();
        document.getElementById('login-username').value = username;
    } catch (e) {
        alert(e.detail || '注册失败');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    location.reload();
}

// ========== 进入主界面 ==========

function enterApp() {
    showPanel('main-panel');
    document.getElementById('username-display').textContent = getUsername();
    loadTodos();
    loadTodoCount();
}

async function loadTodos() {
    try {
        const todos = await api('/todos/');
        renderTodos(todos);
    } catch (e) {
        alert('加载待办失败，请重新登录');
        logout();
    }
}

async function loadTodoCount() {
    try {
        const data = await api('/redis/todo-count');
        document.getElementById('todo-count').textContent = `未完成: ${data.todo_count}`;
        document.getElementById('cache-source').textContent = data.source.includes('Redis') ? '⚡ 缓存' : '💾 数据库';
    } catch (e) { /* Redis 可能未连接 */ }
}

function renderTodos(todos) {
    const container = document.getElementById('todo-list');
    if (todos.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#999;padding:30px;">暂无待办事项</p>';
        return;
    }
    container.innerHTML = todos.map(t => `
        <div class="todo-item ${t.is_completed ? 'completed' : ''}" id="todo-${t.id}">
            <div class="todo-body">
                <div class="todo-title-text">${escapeHtml(t.title)}</div>
                ${t.content ? `<div class="todo-content-text">${escapeHtml(t.content)}</div>` : ''}
            </div>
            <div class="todo-actions" id="actions-${t.id}">
                ${t.is_completed ? '' : `<button class="btn btn-done" onclick="markDone(${t.id})">完成</button>`}
                <button class="btn btn-sm" onclick="startEdit(${t.id}, '${escapeAttr(t.title)}', '${escapeAttr(t.content || '')}')">编辑</button>
                <button class="btn btn-danger" onclick="deleteTodo(${t.id})">删除</button>
            </div>
        </div>
    `).join('');
}

// ========== CRUD ==========

async function addTodo() {
    const title = document.getElementById('todo-title').value.trim();
    const content = document.getElementById('todo-content').value.trim();
    if (!title) return alert('请输入任务标题');
    try {
        await api('/todos/', {
            method: 'POST',
            body: JSON.stringify({ title, content: content || null })
        });
        document.getElementById('todo-title').value = '';
        document.getElementById('todo-content').value = '';
        loadTodos();
        loadTodoCount();
    } catch (e) { alert(e.detail || '添加失败'); }
}

async function deleteTodo(id) {
    if (!confirm('确认删除？')) return;
    try {
        await api(`/todos/${id}`, { method: 'DELETE' });
        loadTodos();
        loadTodoCount();
    } catch (e) { alert(e.detail || '删除失败'); }
}

async function markDone(id) {
    try {
        await api(`/todos/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ is_completed: true })
        });
        loadTodos();
        loadTodoCount();
    } catch (e) { alert(e.detail || '操作失败'); }
}

function startEdit(id, title, content) {
    const item = document.getElementById(`todo-${id}`);
    const actions = document.getElementById(`actions-${id}`);
    const body = item.querySelector('.todo-body');

    item.classList.add('editing');
    body.innerHTML = `
        <input class="edit-input" id="edit-title-${id}" value="${title}" style="margin-bottom:4px;display:block;width:100%;">
        <input class="edit-input" id="edit-content-${id}" value="${content}" placeholder="详细描述..." style="display:block;width:100%;">
    `;
    actions.innerHTML = `
        <button class="btn btn-primary" style="padding:6px 12px;font-size:12px;" onclick="saveEdit(${id})">保存</button>
        <button class="btn btn-sm" onclick="loadTodos()">取消</button>
    `;
}

async function saveEdit(id) {
    const title = document.getElementById(`edit-title-${id}`).value.trim();
    const content = document.getElementById(`edit-content-${id}`).value.trim();
    if (!title) return alert('标题不能为空');
    try {
        await api(`/todos/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ title, content: content || null })
        });
        loadTodos();
    } catch (e) { alert(e.detail || '保存失败'); }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ========== 回车快捷 ==========

document.getElementById('todo-title').addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });
document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
document.getElementById('reg-password').addEventListener('keydown', e => { if (e.key === 'Enter') register(); });

// ========== 初始化 ==========

if (getToken()) { enterApp(); } else { showPanel('auth-panel'); }
