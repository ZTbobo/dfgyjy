// 全局变量
let currentPage = 1;
let itemsPerPage = 10;
let totalItems = 0;
let allRegistrations = [];
let filteredRegistrations = [];
let allContacts = [];
let filteredContacts = [];
let currentContactPage = 1;
let contactItemsPerPage = 10;
let totalContactItems = 0;
let charts = {};

// 防止重复初始化的标志
let isInitialized = false;
let isInitializing = false;

// 请求重试机制
function fetchWithRetry(url, options = {}, maxRetries = 3) {
    return new Promise((resolve, reject) => {
        const attemptFetch = (retryCount) => {
            fetch(url, options)
                .then(response => {
                    // 如果是401错误且不是验证token的请求，直接跳转到登录页面
                    if (response.status === 401 && !url.includes('/api/verify-token')) {
                        console.log('收到401错误，token可能已过期，跳转到登录页面');
                        sessionStorage.removeItem('admin_token');
                        sessionStorage.removeItem('admin_user');
                        window.location.href = '/admin/login';
                        return;
                    }
                    
                    if (response.status === 429 && retryCount < maxRetries) {
                        console.log(`遇到速率限制，第${retryCount + 1}次重试`);
                        setTimeout(() => {
                            attemptFetch(retryCount + 1);
                        }, Math.pow(2, retryCount) * 1000); // 指数退避
                    } else {
                        resolve(response);
                    }
                })
                .catch(error => {
                    if (retryCount < maxRetries) {
                        console.log(`请求失败，第${retryCount + 1}次重试:`, error.message);
                        setTimeout(() => {
                            attemptFetch(retryCount + 1);
                        }, Math.pow(2, retryCount) * 1000);
                    } else {
                        reject(error);
                    }
                });
        };
        
        attemptFetch(0);
    });
}

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    if (isInitialized || isInitializing) {
        console.log('应用已初始化或正在初始化中，跳过');
        return;
    }
    checkAuthAndInit();
});

// 检查认证状态并初始化
function checkAuthAndInit() {
    if (isInitializing) {
        console.log('正在初始化中，跳过重复调用');
        return;
    }
    
    // 检查当前页面是否是登录页面，避免在登录页面执行认证检查
    if (window.location.pathname === '/admin/login' || window.location.pathname === '/admin/login.html') {
        console.log('当前在登录页面，跳过认证检查');
        return;
    }
    
    isInitializing = true;
    console.log('开始检查认证状态');
    const token = sessionStorage.getItem('admin_token');
    
    if (!token) {
        console.log('没有找到token，跳转到登录页面');
        isInitializing = false;
        redirectToLogin();
        return;
    }
    
    console.log('找到token，开始验证:', token.substring(0, 20) + '...');
    
    // 验证token
    fetchWithRetry('/api/verify-token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        console.log('Token验证响应状态:', response.status);
        if (response.status === 401) {
            // token无效，直接处理
            console.log('Token验证返回401，token无效');
            isInitializing = false;
            redirectToLogin();
            return null;
        }
        if (!response.ok) {
            console.log('Token验证响应异常:', response.status, response.statusText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(result => {
        if (!result) return; // 如果是401错误，result为null，直接返回
        
        console.log('Token验证结果:', result);
        if (result.success) {
            // token有效，初始化应用
            console.log('Token有效，初始化应用，用户信息:', result.user);
            console.log('当前页面路径:', window.location.pathname);
            
            // 检查是否在登录页面，如果是则跳转到管理页面
            if (window.location.pathname === '/admin/login' || window.location.pathname === '/admin/login.html') {
                console.log('当前在登录页面，跳转到管理页面');
                window.location.href = '/admin';
                return;
            }
            
            initializeApp();
            setupUserInfo(result.user);
            isInitialized = true;
            isInitializing = false;
        } else {
            // token无效，清除并跳转到登录页面
            console.log('Token无效，清除并跳转到登录页面:', result.message);
            isInitializing = false;
            redirectToLogin();
        }
    })
    .catch(error => {
        console.error('Token验证失败:', error);
        console.log('网络错误，跳转到登录页面');
        isInitializing = false;
        redirectToLogin();
    });
}

// 防止频繁重定向的标志
let isRedirecting = false;
let lastRedirectTime = 0;

// 跳转到登录页面
function redirectToLogin() {
    const now = Date.now();
    
    // 如果距离上次重定向不足3秒，则跳过
    if (now - lastRedirectTime < 3000) {
        console.log('重定向过于频繁，跳过此次重定向');
        return;
    }
    
    if (isRedirecting) {
        console.log('已经在重定向过程中，跳过此次重定向');
        return;
    }
    
    // 检查当前是否已经在登录页面
    if (window.location.pathname === '/admin/login' || window.location.pathname === '/admin/login.html') {
        console.log('已经在登录页面，无需重定向');
        return;
    }
    
    isRedirecting = true;
    lastRedirectTime = now;
    console.log('准备跳转到登录页面');
    
    // 清除所有相关的存储数据
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_user');
    
    // 延迟跳转，避免频繁重定向
    setTimeout(() => {
        window.location.href = '/admin/login';
    }, 500);
}

// 设置用户信息
function setupUserInfo(user) {
    // 在页面上显示用户信息
    const userInfo = document.querySelector('.user-info');
    if (userInfo) {
        userInfo.innerHTML = `
            <span class="user-name">欢迎，${user.username}</span>
            <button class="logout-btn" onclick="logout()">退出登录</button>
        `;
    }
    
    // 添加用户信息到侧边栏
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        const userSection = document.createElement('div');
        userSection.className = 'user-section';
        userSection.innerHTML = `
            <div class="user-profile">
                <div class="user-avatar">
                    <i class="fas fa-user-circle"></i>
                </div>
                <div class="user-details">
                    <div class="user-name">${user.username}</div>
                    <div class="user-role">${user.role === 'admin' ? '管理员' : '用户'}</div>
                </div>
            </div>
            <div class="user-actions">
                <button class="btn-secondary" onclick="showChangePasswordModal()">修改密码</button>
                <button class="btn-danger" onclick="logout()">退出登录</button>
            </div>
        `;
        sidebar.appendChild(userSection);
    }
}

// 退出登录
function logout() {
    const token = sessionStorage.getItem('admin_token');
    
    if (token) {
        fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(result => {
            console.log('登出结果:', result);
        })
        .catch(error => {
            console.error('登出请求失败:', error);
        })
        .finally(() => {
            // 清除本地存储
            sessionStorage.removeItem('admin_token');
            sessionStorage.removeItem('admin_user');
            localStorage.removeItem('admin_username');
            localStorage.removeItem('admin_remember_me');
            
            // 跳转到登录页面
            redirectToLogin();
        });
    } else {
        redirectToLogin();
    }
}

// 显示修改密码模态框
function showChangePasswordModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>修改密码</h3>
                <button class="modal-close" onclick="closeModal(this)">&times;</button>
            </div>
            <div class="modal-body">
                <form id="changePasswordForm">
                    <div class="form-group">
                        <label for="oldPassword">原密码</label>
                        <input type="password" id="oldPassword" name="oldPassword" required>
                    </div>
                    <div class="form-group">
                        <label for="newPassword">新密码</label>
                        <input type="password" id="newPassword" name="newPassword" required minlength="6">
                    </div>
                    <div class="form-group">
                        <label for="confirmPassword">确认新密码</label>
                        <input type="password" id="confirmPassword" name="confirmPassword" required>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="closeModal(this)">取消</button>
                        <button type="submit" class="btn-primary">确认修改</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 设置表单提交事件
    document.getElementById('changePasswordForm').addEventListener('submit', handleChangePassword);
    
    // 显示模态框
    setTimeout(() => modal.classList.add('show'), 10);
}

// 处理修改密码
function handleChangePassword(e) {
    e.preventDefault();
    
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (newPassword !== confirmPassword) {
        alert('新密码和确认密码不匹配');
        return;
    }
    
    if (newPassword.length < 6) {
        alert('新密码至少需要6个字符');
        return;
    }
    
    const token = sessionStorage.getItem('admin_token');
    
    fetch('/api/change-password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            oldPassword,
            newPassword
        })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            alert('密码修改成功，请重新登录');
            logout();
        } else {
            alert('密码修改失败：' + result.message);
        }
    })
    .catch(error => {
        console.error('修改密码失败:', error);
        alert('修改密码失败，请重试');
    });
}

// 关闭模态框
function closeModal(element) {
    const modal = element.closest('.modal');
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
}

// 初始化应用
function initializeApp() {
    setupEventListeners();
    loadRegistrations();
    loadContacts();
    showPage('dashboard');
    updateStats();
    initializeCharts();
}

// 设置事件监听器
function setupEventListeners() {
    // 侧边栏导航
    document.querySelectorAll('.nav-item a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.parentElement.getAttribute('data-page');
            showPage(pageId);
            updateActiveNav(this.parentElement);
        });
    });

    // 侧边栏切换
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }

    // 搜索功能
    const searchInput = document.querySelector('#searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    // 过滤器
    const filters = document.querySelectorAll('.filter-group input, .filter-group select');
    filters.forEach(filter => {
        filter.addEventListener('change', applyFilters);
    });

    // 分页按钮
    document.getElementById('prevPage').addEventListener('click', () => changePage(currentPage - 1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(currentPage + 1));
    
    // 联系信息分页按钮
    const prevContactPageBtn = document.getElementById('prevContactPage');
    const nextContactPageBtn = document.getElementById('nextContactPage');
    if (prevContactPageBtn) {
        prevContactPageBtn.addEventListener('click', () => changeContactPage(currentContactPage - 1));
    }
    if (nextContactPageBtn) {
        nextContactPageBtn.addEventListener('click', () => changeContactPage(currentContactPage + 1));
    }

    // 模态框关闭
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('detailModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });

    // 刷新数据按钮
    const refreshBtn = document.getElementById('refreshData');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
    }

    // 导出数据按钮
    const exportBtn = document.getElementById('exportData');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }
    
    // 联系信息导出按钮
    const exportContactsBtn = document.getElementById('exportContacts');
    if (exportContactsBtn) {
        exportContactsBtn.addEventListener('click', exportContacts);
    }
    
    // 联系信息刷新按钮
    const refreshContactsBtn = document.getElementById('refreshContacts');
    if (refreshContactsBtn) {
        refreshContactsBtn.addEventListener('click', refreshContacts);
    }
    
    // 联系信息搜索
    const contactSearchInput = document.getElementById('contactSearchInput');
    if (contactSearchInput) {
        contactSearchInput.addEventListener('input', debounce(handleContactSearch, 300));
    }
    
    // 联系信息过滤器
    const contactFilters = document.querySelectorAll('#contactTypeFilter, #contactStartDate, #contactEndDate');
    contactFilters.forEach(filter => {
        filter.addEventListener('change', applyContactFilters);
    });
    
    // 联系信息全选复选框
    const selectAllContactsCheckbox = document.getElementById('selectAllContacts');
    if (selectAllContactsCheckbox) {
        selectAllContactsCheckbox.addEventListener('change', function() {
            const rowCheckboxes = document.querySelectorAll('#contactsTable .row-checkbox');
            rowCheckboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
        });
    }

    // 全选复选框
    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const rowCheckboxes = document.querySelectorAll('.row-checkbox');
            rowCheckboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
        });
    }

    // 表格操作按钮事件委托
    document.addEventListener('click', function(e) {
        if (e.target.closest('.view-btn')) {
            const id = e.target.closest('.view-btn').getAttribute('data-id');
            viewDetail(id);
        }
        if (e.target.closest('.delete-btn')) {
            const id = e.target.closest('.delete-btn').getAttribute('data-id');
            console.log('删除按钮被点击，ID:', id, '类型:', typeof id);
            deleteRegistration(id);
        }
        if (e.target.closest('.recent-item')) {
            const id = e.target.closest('.recent-item').getAttribute('data-id');
            viewDetail(id);
        }
        // 联系信息操作按钮
        if (e.target.closest('.view-contact-btn')) {
            const id = e.target.closest('.view-contact-btn').getAttribute('data-id');
            viewContactDetail(id);
        }
        if (e.target.closest('.delete-contact-btn')) {
            const id = e.target.closest('.delete-contact-btn').getAttribute('data-id');
            deleteContactRecord(id);
        }
    });
}

// 显示指定页面
function showPage(pageId) {
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // 显示目标页面
    const targetPage = document.getElementById(pageId + '-page');
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // 更新页面标题
    const pageTitle = document.querySelector('.page-title');
    const titles = {
        'dashboard': '仪表盘',
        'registrations': '报名管理',
        'contacts': '联系信息',
        'settings': '系统设置'
    };
    if (pageTitle) {
        pageTitle.textContent = titles[pageId] || '管理系统';
    }

    // 根据页面执行特定操作
    switch(pageId) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'registrations':
            renderRegistrationsTable();
            break;
        case 'contacts':
            loadContacts();
            renderContactsTable();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// 更新活动导航项
function updateActiveNav(activeItem) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    activeItem.classList.add('active');
}

// 切换侧边栏
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');
}

// 加载报名数据
async function loadRegistrations() {
    try {
        showLoading(true);
        const token = sessionStorage.getItem('admin_token');
        const response = await fetchWithRetry('/api/registrations', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.ok) {
            allRegistrations = await response.json();
            filteredRegistrations = [...allRegistrations];
            totalItems = allRegistrations.length;
            updateStats();
            renderRegistrationsTable();
        } else {
            throw new Error('加载数据失败');
        }
    } catch (error) {
        console.error('加载报名数据失败:', error);
        showToast('加载数据失败，请稍后重试', 'error');
    } finally {
        showLoading(false);
    }
}

// 更新统计数据
async function updateStats() {
    try {
        const token = sessionStorage.getItem('admin_token');
        const response = await fetchWithRetry('/api/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('获取统计数据失败');
        }
        const stats = await response.json();
        
        document.getElementById('totalRegistrations').textContent = stats.total || 0;
        document.getElementById('todayRegistrations').textContent = stats.today || 0;
        document.getElementById('weekRegistrations').textContent = stats.thisWeek || 0;
        
        // 获取最热门的课程
        const courses = Object.entries(stats.byCourse || {});
        const popularCourse = courses.length > 0 
            ? courses.reduce((a, b) => a[1] > b[1] ? a : b)[0]
            : '暂无数据';
        document.getElementById('popularCountry').textContent = popularCourse;
    } catch (error) {
        console.error('更新统计数据失败:', error);
        // 显示默认值
        document.getElementById('totalRegistrations').textContent = '0';
        document.getElementById('todayRegistrations').textContent = '0';
        document.getElementById('weekRegistrations').textContent = '0';
        document.getElementById('popularCountry').textContent = '暂无数据';
    }
}

// 计算统计数据
function calculateStats(data) {
    const today = new Date();
    const todayStr = today.toDateString();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // 计算本周报名
    const weekCount = data.filter(item => {
        const itemDate = new Date(item.submitTime || item.timestamp);
        return itemDate >= weekAgo && itemDate <= today;
    }).length;
    
    // 计算热门项目
    const projectCount = {};
    data.forEach(item => {
        const project = item.projects || item.course || item.country || item.interestedCountry || '未知';
        projectCount[project] = (projectCount[project] || 0) + 1;
    });
    
    const popularProject = Object.keys(projectCount).length > 0 
        ? Object.keys(projectCount).reduce((a, b) => projectCount[a] > projectCount[b] ? a : b)
        : '-';
    
    return {
        total: data.length,
        today: data.filter(item => new Date(item.submitTime || item.timestamp).toDateString() === todayStr).length,
        week: weekCount,
        popularCountry: popularProject
    };
}

// 渲染报名表格
function renderRegistrationsTable() {
    const tbody = document.querySelector('#registrationsTable tbody');
    if (!tbody) return;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredRegistrations.slice(startIndex, endIndex);

    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h3>暂无数据</h3>
                    <p>还没有报名记录</p>
                </td>
            </tr>
        `;
        updatePagination();
        return;
    }

    tbody.innerHTML = pageData.map(item => `
        <tr>
            <td><input type="checkbox" class="row-checkbox" data-id="${item.id || item.timestamp}"></td>
            <td>${item.id || item.timestamp || '未知'}</td>
            <td>${formatDate(item.submitTime || item.timestamp)}</td>
            <td>${item.name || '未填写'}</td>
            <td>${item.gender || '未填写'}</td>
            <td>${item.phone || '未填写'}</td>
            <td>${item.email || '未填写'}</td>
            <td>${item.projects || item.course || '未选择'}</td>
            <td>${item.school || '未填写'}</td>
            <td>
                <button class="btn btn-sm btn-secondary view-btn" data-id="${item.id || item.timestamp}">
                    <i class="fas fa-eye"></i> 查看
                </button>
                <button class="btn btn-sm btn-danger delete-btn" data-id="${item.id || item.timestamp}">
                    <i class="fas fa-trash"></i> 删除
                </button>
            </td>
        </tr>
    `).join('');

    updatePagination();
}

// 格式化日期
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 获取状态样式类
function getStatusClass(status) {
    switch(status) {
        case 'completed': return 'status-completed';
        case 'pending': return 'status-pending';
        default: return 'status-pending';
    }
}

// 获取状态文本
function getStatusText(status) {
    switch(status) {
        case 'completed': return '已完成';
        case 'pending': return '待处理';
        default: return '待处理';
    }
}

// 查看详情
function viewDetail(id) {
    const item = allRegistrations.find(reg => {
        const regId = reg.id || reg.timestamp;
        return regId == id; // 使用宽松比较以处理字符串和数字
    });
    if (!item) {
        showToast('找不到该记录', 'error');
        return;
    }

    const modalBody = document.querySelector('#detailModal .modal-body');
    modalBody.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-label">姓名</div>
                <div class="detail-value">${item.name || '未填写'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">手机号</div>
                <div class="detail-value">${item.phone || '未填写'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">项目</div>
                <div class="detail-value">${item.projects || item.course || '未选择'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">邮箱</div>
                <div class="detail-value">${item.email || '未填写'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">性别</div>
                <div class="detail-value">${item.gender || '未填写'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">民族</div>
                <div class="detail-value">${item.ethnicity || '未填写'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">身份证号</div>
                <div class="detail-value">${item.id_number || '未填写'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">报名时间</div>
                <div class="detail-value">${formatDate(item.submitTime || item.timestamp)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">状态</div>
                <div class="detail-value">
                    <span class="status-badge ${getStatusClass(item.status)}">
                        ${getStatusText(item.status)}
                    </span>
                </div>
            </div>
            ${item.remarks ? `
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-label">备注</div>
                    <div class="detail-value">${item.remarks}</div>
                </div>
            ` : ''}
        </div>
    `;

    document.getElementById('detailModal').style.display = 'block';
}

// 删除报名记录
async function deleteRegistration(id) {
    console.log('deleteRegistration函数被调用，ID:', id, '类型:', typeof id);
    if (!confirm('确定要删除这条记录吗？此操作不可恢复。')) {
        console.log('用户取消删除');
        return;
    }
    console.log('用户确认删除，开始发送请求');

    // 找到删除按钮并添加加载状态
    const deleteBtn = document.querySelector(`.delete-btn[data-id="${id}"]`);
    const originalText = deleteBtn ? deleteBtn.innerHTML : '';
    const originalDisabled = deleteBtn ? deleteBtn.disabled : false;
    
    if (deleteBtn) {
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 删除中...';
        deleteBtn.disabled = true;
        deleteBtn.style.opacity = '0.6';
    }

    try {
        console.log('发送DELETE请求到:', `/api/registrations/${id}`);
        const response = await fetch(`/api/registrations/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('收到响应，状态:', response.status, 'OK:', response.ok);

        if (response.ok) {
            showToast('删除成功', 'success');
            // 局部更新而不是重新加载整个页面
            await loadRegistrations();
        } else {
            // 尝试解析错误信息
            let errorMessage = '删除失败';
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorMessage;
            } catch (e) {
                // 如果无法解析JSON，使用默认错误信息
                if (response.status === 404) {
                    errorMessage = '记录不存在';
                } else if (response.status === 403) {
                    errorMessage = '没有权限删除此记录';
                } else if (response.status >= 500) {
                    errorMessage = '服务器错误，请稍后重试';
                }
            }
            showToast(errorMessage, 'error');
        }
    } catch (error) {
        console.error('删除记录失败:', error);
        let errorMessage = '删除失败，请稍后重试';
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = '网络连接失败，请检查网络后重试';
        }
        showToast(errorMessage, 'error');
    } finally {
        // 恢复按钮状态
        if (deleteBtn) {
            deleteBtn.innerHTML = originalText;
            deleteBtn.disabled = originalDisabled;
            deleteBtn.style.opacity = '1';
        }
    }
}

// 关闭模态框
function closeModal() {
    document.getElementById('detailModal').style.display = 'none';
}

// 搜索处理
function handleSearch(event) {
    const query = event.target.value.toLowerCase().trim();
    
    if (query === '') {
        filteredRegistrations = [...allRegistrations];
    } else {
        filteredRegistrations = allRegistrations.filter(item => 
            (item.name && item.name.toLowerCase().includes(query)) ||
            (item.phone && item.phone.includes(query)) ||
            (item.projects && item.projects.toLowerCase().includes(query)) ||
            (item.course && item.course.toLowerCase().includes(query))
        );
    }
    
    currentPage = 1;
    renderRegistrationsTable();
}

// 应用过滤器
function applyFilters() {
    const courseFilter = document.getElementById('courseFilter')?.value;
    const statusFilter = document.getElementById('statusFilter')?.value;
    const dateFromFilter = document.getElementById('dateFrom')?.value;
    const dateToFilter = document.getElementById('dateTo')?.value;

    filteredRegistrations = allRegistrations.filter(item => {
        // 课程过滤
        if (courseFilter && courseFilter !== 'all' && item.course !== courseFilter) {
            return false;
        }

        // 状态过滤
        if (statusFilter && statusFilter !== 'all') {
            const itemStatus = item.status || 'pending';
            if (itemStatus !== statusFilter) {
                return false;
            }
        }

        // 日期过滤
        if (dateFromFilter || dateToFilter) {
            const itemDate = new Date(item.timestamp);
            if (dateFromFilter && itemDate < new Date(dateFromFilter)) {
                return false;
            }
            if (dateToFilter && itemDate > new Date(dateToFilter + ' 23:59:59')) {
                return false;
            }
        }

        return true;
    });

    currentPage = 1;
    renderRegistrationsTable();
}

// 更新分页
function updatePagination() {
    const totalPages = Math.ceil(filteredRegistrations.length / itemsPerPage);
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredRegistrations.length);

    document.getElementById('pageInfo').textContent = 
        `显示 ${startItem}-${endItem} 条，共 ${filteredRegistrations.length} 条记录`;

    document.getElementById('prevPage').disabled = currentPage <= 1;
    document.getElementById('nextPage').disabled = currentPage >= totalPages;
}

// 切换页面
function changePage(page) {
    const totalPages = Math.ceil(filteredRegistrations.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderRegistrationsTable();
    }
}

// 刷新数据
async function refreshData() {
    await loadRegistrations();
    showToast('数据已刷新', 'success');
}

// 导出数据
function exportData() {
    if (filteredRegistrations.length === 0) {
        showToast('没有数据可导出', 'error');
        return;
    }

    const csvContent = generateCSV(filteredRegistrations);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `报名数据_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('数据导出成功', 'success');
    }
}

// 生成CSV内容
function generateCSV(data) {
    const headers = ['姓名', '手机号', '课程', '年龄', '性别', '学历', '工作经验', '报名时间', '状态', '备注'];
    const csvRows = [headers.join(',')];

    data.forEach(item => {
        const row = [
            item.name || '',
            item.phone || '',
            item.course || '',
            item.age || '',
            item.gender || '',
            item.education || '',
            item.experience || '',
            formatDate(item.timestamp),
            getStatusText(item.status),
            item.remarks || ''
        ];
        csvRows.push(row.map(field => `"${field}"`).join(','));
    });

    return '\uFEFF' + csvRows.join('\n'); // 添加BOM以支持中文
}

// 更新仪表盘
async function updateDashboard() {
    await updateStats();
    updateRecentRegistrations();
    await updateCharts();
}

// 更新最新报名
function updateRecentRegistrations() {
    const recentList = document.querySelector('#recentTable tbody');
    if (!recentList) return;

    const recent = allRegistrations
        .sort((a, b) => new Date(b.submitTime || b.timestamp) - new Date(a.submitTime || a.timestamp))
        .slice(0, 5);

    if (recent.length === 0) {
        recentList.innerHTML = '<tr><td colspan="5" class="empty-state">暂无最新报名</td></tr>';
        return;
    }

    recentList.innerHTML = recent.map(item => `
        <tr class="recent-item" data-id="${item.id || item.timestamp}">
            <td>${item.name || '未知'}</td>
            <td>${item.projects || item.target_country || '未选择项目'}</td>
            <td>${item.phone || '未填写'}</td>
            <td>${formatDate(item.submitTime || item.timestamp)}</td>
            <td>
                <button class="btn btn-sm btn-secondary view-btn" data-id="${item.id || item.timestamp}">
                    <i class="fas fa-eye"></i> 查看
                </button>
            </td>
        </tr>
    `).join('');
}

// 初始化图表
function initializeCharts() {
    // 报名趋势图表
    const trendCtx = document.getElementById('registrationChart');
    if (trendCtx) {
        charts.trend = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '报名数量',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: 10,
                        ticks: {
                            stepSize: 1,
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    // 课程分布图表
    const courseCtx = document.getElementById('countryChart');
    if (courseCtx) {
        charts.course = new Chart(courseCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#3b82f6',
                        '#10b981',
                        '#f59e0b',
                        '#8b5cf6',
                        '#ef4444'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    // 数据分析页面图表初始化

}

// 更新图表
async function updateCharts() {
    await updateTrendChart();
    await updateCourseChart();
}

// 更新趋势图表
async function updateTrendChart() {
    if (!charts.trend) return;

    try {
        const token = sessionStorage.getItem('admin_token');
        const response = await fetchWithRetry('/api/trends?days=7', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('获取趋势数据失败');
        }
        const trends = await response.json();

        charts.trend.data.labels = trends.map(item => item.label);
        charts.trend.data.datasets[0].data = trends.map(item => item.count);
        charts.trend.update();
    } catch (error) {
        console.error('更新趋势图表失败:', error);
        // 显示空数据
        charts.trend.data.labels = [];
        charts.trend.data.datasets[0].data = [];
        charts.trend.update();
    }
}

// 更新课程分布图表
async function updateCourseChart() {
    if (!charts.course) return;

    try {
        const token = sessionStorage.getItem('admin_token');
        const response = await fetchWithRetry('/api/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('获取统计数据失败');
        }
        const stats = await response.json();
        
        const countryData = stats.country_stats || {};
        const labels = Object.keys(countryData);
        const data = Object.values(countryData);

        charts.course.data.labels = labels;
        charts.course.data.datasets[0].data = data;
        charts.course.update();
    } catch (error) {
        console.error('更新课程分布图表失败:', error);
        // 显示空数据
        charts.course.data.labels = [];
        charts.course.data.datasets[0].data = [];
        charts.course.update();
    }
}



// 加载设置
function loadSettings() {
    // 这里可以加载系统设置
    console.log('加载系统设置');
}

// 显示加载状态
function showLoading(show) {
    const loadingElements = document.querySelectorAll('.loading');
    loadingElements.forEach(el => {
        el.style.display = show ? 'inline-block' : 'none';
    });
}

// 显示提示消息
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ==================== 联系信息管理功能 ====================

// 加载联系数据
async function loadContacts() {
    try {
        showLoading(true);
        const token = sessionStorage.getItem('admin_token');
        const response = await fetchWithRetry('/api/contacts', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.ok) {
            allContacts = await response.json();
            filteredContacts = [...allContacts];
            totalContactItems = allContacts.length;
            updateContactStats();
            renderContactsTable();
        } else {
            throw new Error('加载联系数据失败');
        }
    } catch (error) {
        console.error('加载联系数据失败:', error);
        showToast('加载联系数据失败，请稍后重试', 'error');
    } finally {
        showLoading(false);
    }
}

// 更新联系统计数据
async function updateContactStats() {
    try {
        const token = sessionStorage.getItem('admin_token');
        const response = await fetchWithRetry('/api/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('获取统计数据失败');
        }
        const stats = await response.json();
        
        document.getElementById('totalContacts').textContent = stats.contacts?.total || 0;
        document.getElementById('todayContacts').textContent = stats.contacts?.today || 0;
        document.getElementById('weekContacts').textContent = stats.contacts?.thisWeek || 0;
        document.getElementById('monthContacts').textContent = stats.contacts?.thisMonth || 0;
        
    } catch (error) {
        console.error('更新联系统计数据失败:', error);
        // 显示默认值
        document.getElementById('totalContacts').textContent = '0';
        document.getElementById('todayContacts').textContent = '0';
        document.getElementById('weekContacts').textContent = '0';
        document.getElementById('monthContacts').textContent = '0';
    }
}

// 渲染联系表格
function renderContactsTable() {
    const tbody = document.querySelector('#contactsTable tbody');
    if (!tbody) return;

    const startIndex = (currentContactPage - 1) * contactItemsPerPage;
    const endIndex = startIndex + contactItemsPerPage;
    const pageData = filteredContacts.slice(startIndex, endIndex);

    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h3>暂无数据</h3>
                    <p>还没有联系记录</p>
                </td>
            </tr>
        `;
        updateContactPagination();
        return;
    }

    tbody.innerHTML = pageData.map(item => `
        <tr>
            <td><input type="checkbox" class="row-checkbox" data-id="${item.id || item.timestamp}"></td>
            <td>${item.id || item.timestamp || '未知'}</td>
            <td>${formatDate(item.submitTime || item.timestamp)}</td>
            <td>${item.name || '未填写'}</td>
            <td>${item.phone || '未填写'}</td>
            <td>${item.type === 'contact' ? '联系咨询' : '回电申请'}</td>
            <td>
                <button class="btn btn-sm btn-secondary view-contact-btn" data-id="${item.id || item.timestamp}">
                    <i class="fas fa-eye"></i> 查看
                </button>
                <button class="btn btn-sm btn-danger delete-contact-btn" data-id="${item.id || item.timestamp}">
                    <i class="fas fa-trash"></i> 删除
                </button>
            </td>
        </tr>
    `).join('');

    updateContactPagination();
}

// 更新联系分页
function updateContactPagination() {
    const totalPages = Math.ceil(totalContactItems / contactItemsPerPage);
    const pageInfo = document.getElementById('contactPageInfo');
    const prevBtn = document.getElementById('prevContactPage');
    const nextBtn = document.getElementById('nextContactPage');
    
    if (pageInfo) {
        pageInfo.textContent = `第 ${currentContactPage} 页，共 ${totalPages} 页`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = currentContactPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentContactPage >= totalPages;
    }
}

// 切换联系分页
function changeContactPage(page) {
    const totalPages = Math.ceil(totalContactItems / contactItemsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentContactPage = page;
        renderContactsTable();
    }
}

// 联系信息搜索
function handleContactSearch() {
    const searchTerm = document.getElementById('contactSearchInput').value.toLowerCase();
    
    if (!searchTerm) {
        filteredContacts = [...allContacts];
    } else {
        filteredContacts = allContacts.filter(contact => {
            return (
                (contact.name || '').toLowerCase().includes(searchTerm) ||
                (contact.phone || '').toLowerCase().includes(searchTerm)
            );
        });
    }
    
    totalContactItems = filteredContacts.length;
    currentContactPage = 1;
    renderContactsTable();
}

// 应用联系过滤器
function applyContactFilters() {
    const typeFilter = document.getElementById('contactTypeFilter').value;
    const startDate = document.getElementById('contactStartDate').value;
    const endDate = document.getElementById('contactEndDate').value;
    
    filteredContacts = allContacts.filter(contact => {
        // 类型过滤
        if (typeFilter && contact.type !== typeFilter) {
            return false;
        }
        
        // 日期过滤
        if (startDate || endDate) {
            const contactDate = new Date(contact.submitTime || contact.timestamp);
            if (startDate && contactDate < new Date(startDate)) {
                return false;
            }
            if (endDate && contactDate > new Date(endDate + ' 23:59:59')) {
                return false;
            }
        }
        
        return true;
    });
    
    totalContactItems = filteredContacts.length;
    currentContactPage = 1;
    renderContactsTable();
}

// 查看联系详情
function viewContactDetail(id) {
    const contact = allContacts.find(c => (c.id || c.timestamp) == id);
    if (!contact) {
        showToast('联系记录不存在', 'error');
        return;
    }
    
    const detailContent = document.getElementById('detailContent');
    detailContent.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <label>ID:</label>
                <span>${contact.id || contact.timestamp}</span>
            </div>
            <div class="detail-item">
                <label>姓名:</label>
                <span>${contact.name || '未填写'}</span>
            </div>
            <div class="detail-item">
                <label>电话:</label>
                <span>${contact.phone || '未填写'}</span>
            </div>
            <div class="detail-item">
                <label>类型:</label>
                <span>${contact.type === 'contact' ? '联系咨询' : '回电申请'}</span>
            </div>
            <div class="detail-item">
                <label>提交时间:</label>
                <span>${formatDate(contact.submitTime || contact.timestamp)}</span>
            </div>
        </div>
    `;
    
    document.getElementById('detailModal').style.display = 'flex';
}

// 删除联系记录
async function deleteContactRecord(id) {
    if (!confirm('确定要删除这条联系记录吗？')) {
        return;
    }
    
    try {
        // 调用后端删除API
        const response = await fetch(`/api/contacts/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            // 删除成功，重新加载数据
            await loadContacts();
            showToast('联系记录删除成功');
        } else {
            const errorData = await response.json();
            showToast(errorData.error || '删除失败', 'error');
        }
    } catch (error) {
        console.error('删除联系记录时出错:', error);
        showToast('删除失败，请检查网络连接', 'error');
    }
}

// 刷新联系数据
function refreshContacts() {
    loadContacts();
    showToast('联系数据已刷新');
}

// 导出联系数据
function exportContacts() {
    if (filteredContacts.length === 0) {
        showToast('没有数据可导出', 'error');
        return;
    }
    
    const headers = ['ID', '姓名', '电话', '类型', '提交时间'];
    const csvContent = [
        headers.join(','),
        ...filteredContacts.map(contact => [
            contact.id || contact.timestamp,
            contact.name || '',
            contact.phone || '',
            contact.type === 'contact' ? '联系咨询' : '回电申请',
            contact.submitTime || contact.timestamp
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `联系信息_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('联系数据导出成功');
}

// 添加状态样式
const style = document.createElement('style');
style.textContent = `
    .status-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
    }
    
    .status-pending {
        background-color: #fef3c7;
        color: #d97706;
    }
    
    .status-completed {
        background-color: #d1fae5;
        color: #059669;
    }
    
    .recent-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid #f1f5f9;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }
    
    .recent-item:hover {
        background-color: #f8fafc;
    }
    
    .recent-item:last-child {
        border-bottom: none;
    }
    
    .recent-info strong {
        display: block;
        color: #1e293b;
    }
    
    .recent-info span {
        font-size: 12px;
        color: #64748b;
    }
    
    .recent-time {
        font-size: 12px;
        color: #94a3b8;
    }
`;
document.head.appendChild(style);