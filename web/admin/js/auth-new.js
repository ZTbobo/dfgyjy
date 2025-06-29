// 新的简化登录认证系统
class AuthSystem {
    constructor() {
        this.isInitialized = false;
        this.isAuthenticating = false;
        
        // 管理系统状态变量
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.totalItems = 0;
        this.allRegistrations = [];
        this.filteredRegistrations = [];
        this.allContacts = [];
        this.filteredContacts = [];
        this.currentContactPage = 1;
        this.contactItemsPerPage = 10;
        this.totalContactItems = 0;
        this.charts = {};
        
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        // 根据当前页面决定行为
        const currentPath = window.location.pathname;
        
        if (this.isLoginPage(currentPath)) {
            this.initLoginPage();
        } else {
            this.checkAuthAndRedirect();
        }
        
        this.isInitialized = true;
    }

    isLoginPage(path) {
        return path === '/admin/login' || path === '/admin/login.html' || path.endsWith('/login');
    }

    // 登录页面初始化
    initLoginPage() {
        console.log('初始化登录页面');
        
        // 如果已经有有效token，直接跳转到管理页面
        const token = this.getToken();
        if (token) {
            this.verifyTokenAndRedirect(token);
        }
        
        // 绑定登录表单事件
        this.bindLoginForm();
    }

    // 管理页面认证检查
    async checkAuthAndRedirect() {
        if (this.isAuthenticating) return;
        this.isAuthenticating = true;
        
        console.log('检查管理页面认证状态');

        const token = this.getToken();
        if (!token) {
            console.log('未找到token，跳转到登录页面');
            this.redirectToLogin();
            return;
        }

        try {
            const isValid = await this.verifyToken(token);
            if (isValid) {
                console.log('Token有效，初始化管理页面');
                this.initAdminPage();
            } else {
                console.log('Token无效，跳转到登录页面');
                this.clearAuth();
                this.redirectToLogin();
            }
        } catch (error) {
            console.error('Token验证失败:', error);
            this.clearAuth();
            this.redirectToLogin();
        } finally {
            this.isAuthenticating = false;
        }
    }

    // 绑定登录表单
    bindLoginForm() {
        const form = document.getElementById('loginForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });
    }

    // 处理登录
    async handleLogin() {
        const username = document.getElementById('username')?.value;
        const password = document.getElementById('password')?.value;
        const rememberMe = document.getElementById('rememberMe')?.checked || false;

        if (!username || !password) {
            this.showError('请输入用户名和密码');
            return;
        }

        this.setLoading(true);

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, rememberMe })
            });

            const result = await response.json();

            if (result.success) {
                console.log('登录成功');
                this.saveAuth(result.token, result.user);
                this.showSuccess('登录成功，正在跳转...');
                
                // 延迟跳转确保用户看到成功消息
                setTimeout(() => {
                    window.location.href = '/admin';
                }, 1000);
            } else {
                this.showError(result.message || '登录失败');
            }
        } catch (error) {
            console.error('登录请求失败:', error);
            this.showError('网络错误，请重试');
        } finally {
            this.setLoading(false);
        }
    }

    // 验证token
    async verifyToken(token) {
        try {
            const response = await fetch('/api/verify-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                return false;
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Token验证失败:', error);
            return false;
        }
    }

    // 验证token并重定向（用于登录页面）
    async verifyTokenAndRedirect(token) {
        try {
            const isValid = await this.verifyToken(token);
            if (isValid) {
                console.log('已登录，跳转到管理页面');
                window.location.href = '/admin';
            } else {
                console.log('Token已过期，清除认证信息');
                this.clearAuth();
            }
        } catch (error) {
            console.error('Token验证失败:', error);
            this.clearAuth();
        }
    }

    // 初始化管理页面
    initAdminPage() {
        console.log('初始化管理页面');
        
        // 初始化管理系统的核心功能
        this.initializeApp();
        
        // 绑定退出登录事件
        this.bindLogoutEvents();
    }

    // 初始化应用程序的核心功能
    initializeApp() {
        this.setupEventListeners();
        this.loadRegistrations();
        this.loadContacts();
        this.showPage('registrations');
    }

    // 设置事件监听器
    setupEventListeners() {
        // 侧边栏导航
        document.querySelectorAll('.nav-item a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = link.parentElement.getAttribute('data-page');
                this.showPage(pageId);
                this.updateActiveNav(link.parentElement);
            });
        });

        // 侧边栏切换
        const sidebarToggle = document.querySelector('.sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', this.toggleSidebar);
        }

        // 搜索功能
        const searchInput = document.querySelector('#searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(this.handleSearch.bind(this), 300));
        }

        // 过滤器
        const filters = document.querySelectorAll('.filter-group input, .filter-group select');
        filters.forEach(filter => {
            filter.addEventListener('change', this.applyFilters.bind(this));
        });

        // 分页按钮
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => this.changePage(this.currentPage - 1));
        }
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => this.changePage(this.currentPage + 1));
        }
        
        // 联系信息分页按钮
        const prevContactPageBtn = document.getElementById('prevContactPage');
        const nextContactPageBtn = document.getElementById('nextContactPage');
        if (prevContactPageBtn) {
            prevContactPageBtn.addEventListener('click', () => this.changeContactPage(this.currentContactPage - 1));
        }
        if (nextContactPageBtn) {
            nextContactPageBtn.addEventListener('click', () => this.changeContactPage(this.currentContactPage + 1));
        }

        // 模态框关闭
        const closeModal = document.getElementById('closeModal');
        const detailModal = document.getElementById('detailModal');
        if (closeModal) {
            closeModal.addEventListener('click', this.closeModal.bind(this));
        }
        if (detailModal) {
            detailModal.addEventListener('click', (e) => {
                if (e.target === detailModal) this.closeModal();
            });
        }

        // 刷新数据按钮
        const refreshBtn = document.getElementById('refreshData');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', this.refreshData.bind(this));
        }

        // 导入数据按钮
        const importBtn = document.getElementById('importData');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.showImportModal('registrations'));
        }
        
        // 导出数据按钮
        const exportBtn = document.getElementById('exportData');
        if (exportBtn) {
            exportBtn.addEventListener('click', this.exportData.bind(this));
        }
        
        // 联系信息导入按钮
        const importContactsBtn = document.getElementById('importContacts');
        if (importContactsBtn) {
            importContactsBtn.addEventListener('click', () => this.showImportModal('contacts'));
        }
        
        // 联系信息导出按钮
        const exportContactsBtn = document.getElementById('exportContacts');
        if (exportContactsBtn) {
            exportContactsBtn.addEventListener('click', this.exportContacts.bind(this));
        }
        
        // 联系信息刷新按钮
        const refreshContactsBtn = document.getElementById('refreshContacts');
        if (refreshContactsBtn) {
            refreshContactsBtn.addEventListener('click', this.refreshContacts.bind(this));
        }
        
        // 联系信息搜索
        const contactSearchInput = document.getElementById('contactSearchInput');
        if (contactSearchInput) {
            contactSearchInput.addEventListener('input', this.debounce(this.handleContactSearch.bind(this), 300));
        }
        
        // 联系信息过滤器
        const contactFilters = document.querySelectorAll('#contactTypeFilter, #contactStartDate, #contactEndDate');
        contactFilters.forEach(filter => {
            filter.addEventListener('change', this.applyContactFilters.bind(this));
        });

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
        
        // 批量删除按钮
        const batchDeleteBtn = document.getElementById('batchDelete');
        if (batchDeleteBtn) {
            batchDeleteBtn.addEventListener('click', this.batchDeleteRegistrations.bind(this));
        }
        
        // 联系信息批量删除按钮
        const batchDeleteContactsBtn = document.getElementById('batchDeleteContacts');
        if (batchDeleteContactsBtn) {
            batchDeleteContactsBtn.addEventListener('click', this.batchDeleteContacts.bind(this));
        }

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

        // 导入模态框事件监听器
        this.initImportModalEvents();
        
        // 表格操作按钮事件委托
        document.addEventListener('click', (e) => {
            if (e.target.closest('.view-btn')) {
                const id = e.target.closest('.view-btn').getAttribute('data-id');
                this.viewDetail(id);
            }
            if (e.target.closest('.delete-btn')) {
                const id = e.target.closest('.delete-btn').getAttribute('data-id');
                this.deleteRegistration(id);
            }
            if (e.target.closest('.recent-item')) {
                const id = e.target.closest('.recent-item').getAttribute('data-id');
                this.viewDetail(id);
            }
            // 联系信息操作按钮
            if (e.target.closest('.view-contact-btn')) {
                const id = e.target.closest('.view-contact-btn').getAttribute('data-id');
                this.viewContactDetail(id);
            }
            if (e.target.closest('.delete-contact-btn')) {
                const id = e.target.closest('.delete-contact-btn').getAttribute('data-id');
                this.deleteContactRecord(id);
            }
        });
    }

    // 显示指定页面
    showPage(pageId) {
        // 如果尝试访问仪表盘，重定向到报名管理
        if (pageId === 'dashboard') {
            pageId = 'registrations';
        }
        
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
            'registrations': '报名管理',
            'contacts': '联系信息',
            'settings': '系统设置'
        };
        if (pageTitle) {
            pageTitle.textContent = titles[pageId] || '管理系统';
        }

        // 根据页面执行特定操作
        switch(pageId) {
            case 'registrations':
                this.loadRegistrations();
                break;
            case 'contacts':
                this.loadContacts();
                this.renderContactsTable();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

    // 更新活动导航项
    updateActiveNav(activeItem) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        activeItem.classList.add('active');
    }

    // 切换侧边栏
    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('active');
    }

    // 请求重试机制
    fetchWithRetry(url, options = {}, maxRetries = 3) {
        return new Promise((resolve, reject) => {
            const attemptFetch = (retryCount) => {
                fetch(url, options)
                    .then(response => {
                        // 如果是401错误且不是验证token的请求，直接跳转到登录页面
                        if (response.status === 401 && !url.includes('/api/verify-token')) {
                            console.log('收到401错误，token可能已过期，跳转到登录页面');
                            this.clearAuth();
                            this.redirectToLogin();
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

    // 加载报名数据
    async loadRegistrations() {
        try {
            this.showLoading(true);
            const token = this.getToken();
            const response = await this.fetchWithRetry('/api/registrations', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                this.allRegistrations = await response.json();
                this.filteredRegistrations = [...this.allRegistrations];
                this.totalItems = this.allRegistrations.length;
    
                this.renderRegistrationsTable();
            } else {
                throw new Error('加载数据失败');
            }
        } catch (error) {
            console.error('加载报名数据失败:', error);
            this.showToast('加载数据失败，请稍后重试', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // 加载联系信息数据
    async loadContacts() {
        try {
            this.showLoading(true);
            const token = this.getToken();
            const response = await this.fetchWithRetry('/api/contacts', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                this.allContacts = await response.json();
                this.filteredContacts = [...this.allContacts];
                this.totalContactItems = this.allContacts.length;
                this.renderContactsTable();
            } else {
                throw new Error('加载联系信息失败');
            }
        } catch (error) {
            console.error('加载联系信息失败:', error);
            this.showToast('加载联系信息失败，请稍后重试', 'error');
        } finally {
            this.showLoading(false);
        }
    }



    // 初始化图表（已移除仪表盘功能）
    // initializeCharts() {
    //     console.log('图表功能已移除');
    // }

    // 渲染报名表格
    renderRegistrationsTable() {
        const tbody = document.querySelector('#registrationsTable tbody');
        if (!tbody) return;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = this.filteredRegistrations.slice(startIndex, endIndex);

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
            this.updatePagination();
            return;
        }

        tbody.innerHTML = pageData.map(item => `
            <tr>
                <td><input type="checkbox" class="row-checkbox" data-id="${item.id || item.timestamp}"></td>
                <td>${item.id || item.timestamp || '未知'}</td>
                <td>${this.formatDate(item.submitTime || item.timestamp)}</td>
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

        this.updatePagination();
    }

    // 渲染联系信息表格
    renderContactsTable() {
        const tbody = document.querySelector('#contactsTable tbody');
        if (!tbody) return;

        const startIndex = (this.currentContactPage - 1) * this.contactItemsPerPage;
        const endIndex = startIndex + this.contactItemsPerPage;
        const pageData = this.filteredContacts.slice(startIndex, endIndex);

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
            this.updateContactPagination();
            return;
        }

        tbody.innerHTML = pageData.map(item => `
            <tr>
                <td><input type="checkbox" class="row-checkbox" data-id="${item.id || item.timestamp}"></td>
                <td>${item.id || item.timestamp || '未知'}</td>
                <td>${this.formatDate(item.submitTime || item.timestamp)}</td>
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

        this.updateContactPagination();
    }

    // 加载设置
    loadSettings() {
        console.log('加载设置');
    }

    // 工具函数
    debounce(func, wait) {
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

    // 显示加载状态
    showLoading(show) {
        const loader = document.querySelector('.loading');
        if (loader) {
            loader.style.display = show ? 'block' : 'none';
        }
    }

    // 显示提示消息
    showToast(message, type = 'info') {
        console.log(`Toast [${type}]: ${message}`);
        // 这里可以添加实际的toast显示逻辑
    }

    // 格式化日期
    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 更新分页
    updatePagination() {
        const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (pageInfo) {
            pageInfo.textContent = `第 ${this.currentPage} 页，共 ${totalPages} 页`;
        }
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
        }
    }

    // 更新联系分页
    updateContactPagination() {
        const totalPages = Math.ceil(this.totalContactItems / this.contactItemsPerPage);
        const pageInfo = document.getElementById('contactPageInfo');
        const prevBtn = document.getElementById('prevContactPage');
        const nextBtn = document.getElementById('nextContactPage');
        
        if (pageInfo) {
            pageInfo.textContent = `第 ${this.currentContactPage} 页，共 ${totalPages} 页`;
        }
        
        if (prevBtn) {
            prevBtn.disabled = this.currentContactPage <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentContactPage >= totalPages;
        }
    }

    // 实现的方法
    handleSearch() {
        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
        
        if (!searchTerm) {
            this.filteredRegistrations = [...this.allRegistrations];
        } else {
            this.filteredRegistrations = this.allRegistrations.filter(reg => {
                return (
                    (reg.name || '').toLowerCase().includes(searchTerm) ||
                    (reg.phone || '').toLowerCase().includes(searchTerm) ||
                    (reg.email || '').toLowerCase().includes(searchTerm)
                );
            });
        }
        
        this.totalItems = this.filteredRegistrations.length;
        this.currentPage = 1;
        this.renderRegistrationsTable();
    }

    applyFilters() { 
        // 应用过滤器逻辑
        this.renderRegistrationsTable();
    }

    changePage(page) {
        const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.renderRegistrationsTable();
        }
    }

    changeContactPage(page) {
        const totalPages = Math.ceil(this.totalContactItems / this.contactItemsPerPage);
        if (page >= 1 && page <= totalPages) {
            this.currentContactPage = page;
            this.renderContactsTable();
        }
    }

    closeModal() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
    }

    refreshData() { this.loadRegistrations(); }
    
    exportData() {
        try {
            const csvContent = this.convertToCSV(this.allRegistrations, 'registrations');
            this.downloadCSV(csvContent, '报名数据.csv');
            this.showToast('导出成功', 'success');
        } catch (error) {
            console.error('导出数据失败:', error);
            this.showToast('导出失败', 'error');
        }
    }
    
    exportContacts() {
        try {
            const csvContent = this.convertToCSV(this.allContacts, 'contacts');
            this.downloadCSV(csvContent, '联系信息.csv');
            this.showToast('导出成功', 'success');
        } catch (error) {
            console.error('导出联系信息失败:', error);
            this.showToast('导出失败', 'error');
        }
    }
    
    refreshContacts() { this.loadContacts(); }
    
    // 显示导入模态框
    showImportModal(type) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>导入${type === 'registrations' ? '报名' : '联系'}数据</h3>
                    <span class="close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="import-area">
                        <input type="file" id="importFile" accept=".csv,.json" style="display: none;">
                        <div class="file-drop-zone" onclick="document.getElementById('importFile').click()">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <p>点击选择文件或拖拽文件到此处</p>
                            <small>支持 CSV 和 JSON 格式</small>
                        </div>
                    </div>
                    <div class="import-options">
                        <label>
                            <input type="checkbox" id="overwriteData"> 覆盖现有数据
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">取消</button>
                    <button class="btn btn-primary" onclick="authSystem.handleImport('${type}')">导入</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 文件选择事件
        const fileInput = modal.querySelector('#importFile');
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const dropZone = modal.querySelector('.file-drop-zone');
                dropZone.innerHTML = `
                    <i class="fas fa-file"></i>
                    <p>已选择: ${file.name}</p>
                    <small>文件大小: ${(file.size / 1024).toFixed(2)} KB</small>
                `;
            }
        });
    }
    
    // 处理导入
    async handleImport(type) {
        const fileInput = document.getElementById('importFile');
        const overwrite = document.getElementById('overwriteData').checked;
        
        if (!fileInput.files[0]) {
            this.showToast('请选择要导入的文件', 'error');
            return;
        }
        
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        formData.append('overwrite', overwrite);
        
        try {
            this.showLoading(true);
            const token = this.getToken();
            const response = await this.fetchWithRetry('/api/import', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showToast(`导入成功：${result.imported || 0} 条记录`, 'success');
                // 关闭模态框
                document.querySelector('.modal').remove();
                // 重新加载数据
                if (type === 'registrations') {
                    this.loadRegistrations();
                } else {
                    this.loadContacts();
                }
            } else {
                throw new Error('导入失败');
            }
        } catch (error) {
            console.error('导入数据失败:', error);
            this.showToast('导入失败，请检查文件格式', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    // 转换为CSV格式
    convertToCSV(data, type) {
        if (!data || data.length === 0) return '';
        
        let headers, rows;
        
        if (type === 'registrations') {
            headers = ['ID', '提交时间', '姓名', '性别', '电话', '邮箱', '报名项目', '就读学校'];
            rows = data.map(item => [
                item.id || item.timestamp || '',
                this.formatDate(item.submitTime || item.timestamp),
                item.name || '',
                item.gender || '',
                item.phone || '',
                item.email || '',
                item.projects || item.course || '',
                item.school || ''
            ]);
        } else {
            headers = ['ID', '提交时间', '姓名', '电话', '类型'];
            rows = data.map(item => [
                item.id || item.timestamp || '',
                this.formatDate(item.submitTime || item.timestamp),
                item.name || '',
                item.phone || '',
                item.type || 'contact'
            ]);
        }
        
        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
            
        return '\uFEFF' + csvContent; // 添加BOM以支持中文
    }
    
    // 下载CSV文件
    downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // 批量删除报名记录
    async batchDeleteRegistrations() {
        const selectedCheckboxes = document.querySelectorAll('#registrationsTable .row-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            this.showToast('请选择要删除的记录', 'warning');
            return;
        }
        
        if (!confirm(`确定要删除选中的 ${selectedCheckboxes.length} 条记录吗？`)) {
            return;
        }
        
        const ids = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-id'));
        
        try {
            this.showLoading(true);
            const token = this.getToken();
            const response = await this.fetchWithRetry('/api/registrations/batch-delete', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ids })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showToast(`成功删除 ${result.deleted || ids.length} 条记录`, 'success');
                this.loadRegistrations(); // 重新加载数据
                // 取消全选
                const selectAllCheckbox = document.getElementById('selectAll');
                if (selectAllCheckbox) selectAllCheckbox.checked = false;
            } else {
                throw new Error('批量删除失败');
            }
        } catch (error) {
            console.error('批量删除报名记录失败:', error);
            this.showToast('批量删除失败，请稍后重试', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    // 批量删除联系记录
    async batchDeleteContacts() {
        const selectedCheckboxes = document.querySelectorAll('#contactsTable .row-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            this.showToast('请选择要删除的记录', 'warning');
            return;
        }
        
        if (!confirm(`确定要删除选中的 ${selectedCheckboxes.length} 条记录吗？`)) {
            return;
        }
        
        const ids = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-id'));
        
        try {
            this.showLoading(true);
            const token = this.getToken();
            const response = await this.fetchWithRetry('/api/contacts/batch-delete', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ids })
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showToast(`成功删除 ${result.deleted || ids.length} 条记录`, 'success');
                this.loadContacts(); // 重新加载数据
                // 取消全选
                const selectAllContactsCheckbox = document.getElementById('selectAllContacts');
                if (selectAllContactsCheckbox) selectAllContactsCheckbox.checked = false;
            } else {
                throw new Error('批量删除失败');
            }
        } catch (error) {
            console.error('批量删除联系记录失败:', error);
            this.showToast('批量删除失败，请稍后重试', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    handleContactSearch() {
        const searchTerm = document.getElementById('contactSearchInput')?.value.toLowerCase() || '';
        
        if (!searchTerm) {
            this.filteredContacts = [...this.allContacts];
        } else {
            this.filteredContacts = this.allContacts.filter(contact => {
                return (
                    (contact.name || '').toLowerCase().includes(searchTerm) ||
                    (contact.phone || '').toLowerCase().includes(searchTerm)
                );
            });
        }
        
        this.totalContactItems = this.filteredContacts.length;
        this.currentContactPage = 1;
        this.renderContactsTable();
    }

    applyContactFilters() {
        // 应用联系信息过滤器逻辑
        this.renderContactsTable();
    }

    viewDetail(id) {
        const item = this.allRegistrations.find(reg => {
            const regId = reg.id || reg.timestamp;
            return regId == id;
        });
        if (!item) {
            this.showToast('找不到该记录', 'error');
            return;
        }
        
        // 显示详情模态框
        const modalBody = document.querySelector('#detailModal .modal-body');
        if (!modalBody) {
            console.error('找不到模态框元素');
            return;
        }
        
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
                    <div class="detail-label">就读学校</div>
                    <div class="detail-value">${item.current_school || item.school || '未填写'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">毕业时间</div>
                    <div class="detail-value">${item.graduation_time || '未填写'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">学历</div>
                    <div class="detail-value">${item.education_level || '未填写'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">高考成绩</div>
                    <div class="detail-value">${item.gaokao_score || '未填写'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">英语成绩</div>
                    <div class="detail-value">${item.english_score || '未填写'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">意向国家</div>
                    <div class="detail-value">${item.target_country || '未填写'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">意向专业</div>
                    <div class="detail-value">${item.target_major || '未填写'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">父亲姓名</div>
                    <div class="detail-value">${item.father_name || '未填写'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">父亲电话</div>
                    <div class="detail-value">${item.father_phone || '未填写'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">母亲姓名</div>
                    <div class="detail-value">${item.mother_name || '未填写'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">母亲电话</div>
                    <div class="detail-value">${item.mother_phone || '未填写'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">紧急联系电话</div>
                    <div class="detail-value">${item.emergency_contact || '未填写'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">过敏史/病史</div>
                    <div class="detail-value">${item.medical_history || '未填写'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">报名时间</div>
                    <div class="detail-value">${this.formatDate(item.submitTime || item.timestamp)}</div>
                </div>
                ${item.remarks ? `
                    <div class="detail-item" style="grid-column: 1 / -1;">
                        <div class="detail-label">备注</div>
                        <div class="detail-value">${item.remarks}</div>
                    </div>
                ` : ''}
            </div>
        `;
        
        const detailModal = document.getElementById('detailModal');
        if (detailModal) {
            detailModal.style.display = 'block';
        }
    }

    async deleteRegistration(id) {
        if (confirm('确定要删除这条记录吗？')) {
            try {
                this.showLoading(true);
                const token = this.getToken();
                const response = await this.fetchWithRetry(`/api/registrations/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    this.showToast('删除成功', 'success');
                    this.loadRegistrations(); // 重新加载数据
                } else {
                    throw new Error('删除失败');
                }
            } catch (error) {
                console.error('删除报名记录失败:', error);
                this.showToast('删除失败，请稍后重试', 'error');
            } finally {
                this.showLoading(false);
            }
        }
    }

    viewContactDetail(id) {
        const item = this.allContacts.find(contact => {
            const contactId = contact.id || contact.timestamp;
            return contactId == id;
        });
        if (!item) {
            this.showToast('找不到该记录', 'error');
            return;
        }
        
        // 显示联系详情模态框
        const modalBody = document.querySelector('#detailModal .modal-body');
        if (!modalBody) {
            console.error('找不到模态框元素');
            return;
        }
        
        modalBody.innerHTML = `
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">提交时间</div>
                    <div class="detail-value">${this.formatDate(item.submitTime || item.timestamp)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">姓名</div>
                    <div class="detail-value">${item.name || '未填写'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">电话</div>
                    <div class="detail-value">${item.phone || '未填写'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">类型</div>
                    <div class="detail-value">${item.type === 'contact' ? '联系咨询' : '回电申请'}</div>
                </div>
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-label">留言内容</div>
                    <div class="detail-value">${item.message || '无留言'}</div>
                </div>
            </div>
        `;
        
        const detailModal = document.getElementById('detailModal');
        if (detailModal) {
            detailModal.style.display = 'block';
        }
    }

    async deleteContactRecord(id) {
        if (confirm('确定要删除这条联系记录吗？')) {
            try {
                this.showLoading(true);
                const token = this.getToken();
                const response = await this.fetchWithRetry(`/api/contacts/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    this.showToast('删除成功', 'success');
                    this.loadContacts(); // 重新加载数据
                } else {
                    throw new Error('删除失败');
                }
            } catch (error) {
                console.error('删除联系记录失败:', error);
                this.showToast('删除失败，请稍后重试', 'error');
            } finally {
                this.showLoading(false);
            }
        }
    }

    // 绑定退出登录事件
    bindLogoutEvents() {
        const logoutBtns = document.querySelectorAll('.logout-btn, [onclick="logout()"]');
        logoutBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        });
    }

    // 退出登录
    async logout() {
        try {
            const token = this.getToken();
            if (token) {
                await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            }
        } catch (error) {
            console.error('退出登录请求失败:', error);
        } finally {
            this.clearAuth();
            this.redirectToLogin();
        }
    }

    // 保存认证信息
    saveAuth(token, user) {
        sessionStorage.setItem('admin_token', token);
        sessionStorage.setItem('admin_user', JSON.stringify(user));
    }

    // 获取token
    getToken() {
        return sessionStorage.getItem('admin_token');
    }

    // 获取用户信息
    getUser() {
        const userStr = sessionStorage.getItem('admin_user');
        return userStr ? JSON.parse(userStr) : null;
    }

    // 清除认证信息
    clearAuth() {
        sessionStorage.removeItem('admin_token');
        sessionStorage.removeItem('admin_user');
    }

    // 跳转到登录页面
    redirectToLogin() {
        if (this.isLoginPage(window.location.pathname)) {
            console.log('已在登录页面');
            return;
        }
        
        console.log('跳转到登录页面');
        window.location.href = '/admin/login';
    }

    // 显示错误信息
    showError(message) {
        const errorEl = document.getElementById('loginError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        } else {
            alert(message);
        }
    }

    // 显示成功信息
    showSuccess(message) {
        const errorEl = document.getElementById('loginError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.color = '#10b981';
            errorEl.style.display = 'block';
        } else {
            alert(message);
        }
    }

    // 设置加载状态
    setLoading(loading) {
        const btn = document.getElementById('loginBtn');
        const btnText = btn?.querySelector('.btn-text');
        const btnLoading = btn?.querySelector('.btn-loading');

        if (btn && btnText && btnLoading) {
            btn.disabled = loading;
            btnText.style.display = loading ? 'none' : 'inline';
            btnLoading.style.display = loading ? 'inline' : 'none';
        }
    }

    // 数据导入相关方法
    initImportModalEvents() {
        const importModal = document.getElementById('importModal');
        const closeImportModal = document.getElementById('closeImportModal');
        const cancelImport = document.getElementById('cancelImport');
        const importFileInput = document.getElementById('importFileInput');
        const uploadPlaceholder = document.getElementById('uploadPlaceholder');
        const fileInfo = document.getElementById('fileInfo');
        const removeFile = document.getElementById('removeFile');
        const confirmImport = document.getElementById('confirmImport');
        
        // 关闭模态框
        if (closeImportModal) {
            closeImportModal.addEventListener('click', () => this.hideImportModal());
        }
        if (cancelImport) {
            cancelImport.addEventListener('click', () => this.hideImportModal());
        }
        
        // 点击背景关闭模态框
        if (importModal) {
            importModal.addEventListener('click', (e) => {
                if (e.target === importModal) {
                    this.hideImportModal();
                }
            });
        }
        
        // 文件选择
        if (uploadPlaceholder) {
            uploadPlaceholder.addEventListener('click', () => {
                importFileInput?.click();
            });
        }
        
        if (importFileInput) {
            importFileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files[0]);
            });
        }
        
        // 移除文件
        if (removeFile) {
            removeFile.addEventListener('click', () => {
                this.clearSelectedFile();
            });
        }
        
        // 确认导入
        if (confirmImport) {
            confirmImport.addEventListener('click', () => {
                this.performImport();
            });
        }
        
        // 拖拽上传
        if (uploadPlaceholder) {
            uploadPlaceholder.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadPlaceholder.classList.add('dragover');
            });
            
            uploadPlaceholder.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadPlaceholder.classList.remove('dragover');
            });
            
            uploadPlaceholder.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadPlaceholder.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileSelect(files[0]);
                }
            });
        }
    }
    
    showImportModal(dataType) {
        this.currentImportType = dataType;
        const modal = document.getElementById('importModal');
        const title = modal?.querySelector('.modal-header h3');
        
        if (title) {
            title.textContent = dataType === 'registrations' ? '导入报名数据' : '导入联系信息';
        }
        
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
        
        this.clearSelectedFile();
    }
    
    hideImportModal() {
        const modal = document.getElementById('importModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        this.clearSelectedFile();
    }
    
    handleFileSelect(file) {
        if (!file) return;
        
        const allowedTypes = ['application/json', 'text/csv', 'application/vnd.ms-excel'];
        const allowedExtensions = ['.json', '.csv'];
        
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        
        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            alert('请选择 JSON 或 CSV 格式的文件');
            return;
        }
        
        this.selectedFile = file;
        this.showFileInfo(file);
        this.previewFileData(file);
    }
    
    showFileInfo(file) {
        const uploadPlaceholder = document.getElementById('uploadPlaceholder');
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        
        if (uploadPlaceholder) uploadPlaceholder.style.display = 'none';
        if (fileInfo) fileInfo.style.display = 'flex';
        if (fileName) fileName.textContent = file.name;
    }
    
    clearSelectedFile() {
        const uploadPlaceholder = document.getElementById('uploadPlaceholder');
        const fileInfo = document.getElementById('fileInfo');
        const importFileInput = document.getElementById('importFileInput');
        const importPreview = document.getElementById('importPreview');
        const confirmImport = document.getElementById('confirmImport');
        
        if (uploadPlaceholder) uploadPlaceholder.style.display = 'block';
        if (fileInfo) fileInfo.style.display = 'none';
        if (importFileInput) importFileInput.value = '';
        if (importPreview) importPreview.style.display = 'none';
        if (confirmImport) confirmImport.disabled = true;
        
        this.selectedFile = null;
        this.importData = null;
    }
    
    async previewFileData(file) {
        try {
            const text = await this.readFileAsText(file);
            let data;
            
            if (file.name.toLowerCase().endsWith('.json')) {
                data = JSON.parse(text);
            } else if (file.name.toLowerCase().endsWith('.csv')) {
                data = this.parseCSV(text);
            }
            
            if (!Array.isArray(data)) {
                throw new Error('数据格式错误：文件内容必须是数组格式');
            }
            
            this.importData = data;
            this.showPreview(data);
            
            const confirmImport = document.getElementById('confirmImport');
            if (confirmImport) confirmImport.disabled = false;
            
        } catch (error) {
            alert('文件解析失败：' + error.message);
            this.clearSelectedFile();
        }
    }
    
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file, 'UTF-8');
        });
    }
    
    parseCSV(text) {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error('CSV文件格式错误：至少需要标题行和一行数据');
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const obj = {};
            
            headers.forEach((header, index) => {
                obj[header] = values[index] || '';
            });
            
            data.push(obj);
        }
        
        return data;
    }
    
    showPreview(data) {
        const importPreview = document.getElementById('importPreview');
        const previewContent = document.getElementById('previewContent');
        
        if (!importPreview || !previewContent) return;
        
        const preview = data.slice(0, 3); // 只显示前3条数据
        const previewText = JSON.stringify(preview, null, 2);
        
        previewContent.textContent = previewText;
        importPreview.style.display = 'block';
    }
    
    async performImport() {
        if (!this.importData || !this.currentImportType) {
            alert('请先选择要导入的文件');
            return;
        }
        
        const replaceExisting = document.getElementById('replaceExisting')?.checked;
        const confirmImport = document.getElementById('confirmImport');
        
        if (confirmImport) {
            confirmImport.disabled = true;
            confirmImport.textContent = '导入中...';
        }
        
        try {
            const endpoint = this.currentImportType === 'registrations' ? '/admin/api/import-registrations' : '/admin/api/import-contacts';
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getToken()}`
                },
                body: JSON.stringify({
                    data: this.importData,
                    replace: replaceExisting
                })
            });
            
            if (!response.ok) {
                throw new Error('导入失败：' + response.statusText);
            }
            
            const result = await response.json();
            
            alert(`导入成功！共导入 ${result.imported} 条数据`);
            
            // 刷新数据
            if (this.currentImportType === 'registrations') {
                this.loadRegistrations();
            } else {
                this.loadContacts();
            }
            
            this.hideImportModal();
            
        } catch (error) {
            alert('导入失败：' + error.message);
        } finally {
            if (confirmImport) {
                confirmImport.disabled = false;
                confirmImport.textContent = '导入数据';
            }
        }
    }
}

// 全局函数，保持兼容性
function logout() {
    if (window.authSystem) {
        window.authSystem.logout();
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.authSystem = new AuthSystem();
});

// 如果DOM已经加载完成，立即初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.authSystem = new AuthSystem();
    });
} else {
    window.authSystem = new AuthSystem();
}