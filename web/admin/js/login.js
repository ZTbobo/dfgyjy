// 登录页面JavaScript逻辑
class LoginManager {
    constructor() {
        this.form = document.getElementById('loginForm');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.rememberMeCheckbox = document.getElementById('rememberMe');
        this.loginBtn = document.getElementById('loginBtn');
        this.togglePasswordBtn = document.getElementById('togglePassword');
        
        this.initEventListeners();
        this.checkSavedCredentials();
    }
    
    initEventListeners() {
        // 表单提交
        this.form.addEventListener('submit', (e) => this.handleLogin(e));
        
        // 密码显示/隐藏切换
        this.togglePasswordBtn.addEventListener('click', () => this.togglePasswordVisibility());
        
        // 输入验证
        this.usernameInput.addEventListener('input', () => this.clearError('usernameError'));
        this.passwordInput.addEventListener('input', () => this.clearError('passwordError'));
        
        // 回车键登录
        this.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleLogin(e);
            }
        });
        
        // 防止表单自动填充时的样式问题
        setTimeout(() => {
            if (this.usernameInput.value) {
                this.usernameInput.classList.add('has-value');
            }
            if (this.passwordInput.value) {
                this.passwordInput.classList.add('has-value');
            }
        }, 100);
    }
    
    checkSavedCredentials() {
        // 检查是否有保存的登录信息
        const savedUsername = localStorage.getItem('admin_username');
        const rememberMe = localStorage.getItem('admin_remember_me') === 'true';
        
        if (savedUsername && rememberMe) {
            this.usernameInput.value = savedUsername;
            this.rememberMeCheckbox.checked = true;
        }
    }
    
    async handleLogin(e) {
        e.preventDefault();
        
        // 清除之前的错误信息
        this.clearAllErrors();
        
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;
        const rememberMe = this.rememberMeCheckbox.checked;
        
        // 前端验证
        if (!this.validateForm(username, password)) {
            return;
        }
        
        // 显示加载状态
        this.setLoadingState(true);
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    password,
                    rememberMe
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                // 登录成功
                this.handleLoginSuccess(result, username, rememberMe);
            } else {
                // 登录失败
                this.handleLoginError(result.message || '登录失败，请重试');
            }
        } catch (error) {
            console.error('登录请求失败:', error);
            this.handleLoginError('网络连接失败，请检查网络后重试');
        } finally {
            this.setLoadingState(false);
        }
    }
    
    validateForm(username, password) {
        let isValid = true;
        
        // 验证用户名
        if (!username) {
            this.showError('usernameError', '请输入用户名');
            isValid = false;
        } else if (username.length < 3) {
            this.showError('usernameError', '用户名至少需要3个字符');
            isValid = false;
        }
        
        // 验证密码
        if (!password) {
            this.showError('passwordError', '请输入密码');
            isValid = false;
        } else if (password.length < 6) {
            this.showError('passwordError', '密码至少需要6个字符');
            isValid = false;
        }
        
        return isValid;
    }
    
    handleLoginSuccess(result, username, rememberMe) {
        // 保存登录状态
        sessionStorage.setItem('admin_token', result.token);
        sessionStorage.setItem('admin_user', JSON.stringify(result.user));
        
        // 处理记住我功能
        if (rememberMe) {
            localStorage.setItem('admin_username', username);
            localStorage.setItem('admin_remember_me', 'true');
        } else {
            localStorage.removeItem('admin_username');
            localStorage.removeItem('admin_remember_me');
        }
        
        // 显示成功消息
        this.showSuccess('登录成功，正在跳转...');
        
        // 延迟跳转到管理页面
        setTimeout(() => {
            window.location.href = '/admin';
        }, 1000);
    }
    
    handleLoginError(message) {
        this.showError('loginError', message);
        
        // 清空密码输入框
        this.passwordInput.value = '';
        this.passwordInput.focus();
        
        // 添加错误动画
        this.form.classList.add('shake');
        setTimeout(() => {
            this.form.classList.remove('shake');
        }, 500);
    }
    
    togglePasswordVisibility() {
        const isPassword = this.passwordInput.type === 'password';
        this.passwordInput.type = isPassword ? 'text' : 'password';
        
        const icon = this.togglePasswordBtn.querySelector('i');
        icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    }
    
    setLoadingState(loading) {
        if (loading) {
            this.loginBtn.disabled = true;
            this.loginBtn.querySelector('.btn-text').style.display = 'none';
            this.loginBtn.querySelector('.btn-loading').style.display = 'flex';
            this.form.classList.add('loading');
        } else {
            this.loginBtn.disabled = false;
            this.loginBtn.querySelector('.btn-text').style.display = 'block';
            this.loginBtn.querySelector('.btn-loading').style.display = 'none';
            this.form.classList.remove('loading');
        }
    }
    
    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }
    
    showSuccess(message) {
        const loginError = document.getElementById('loginError');
        loginError.textContent = message;
        loginError.className = 'success-message';
        loginError.style.display = 'block';
    }
    
    clearError(elementId) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    }
    
    clearAllErrors() {
        this.clearError('usernameError');
        this.clearError('passwordError');
        this.clearError('loginError');
        
        const loginError = document.getElementById('loginError');
        loginError.className = 'error-message';
    }
}

// 检查是否已经登录
function checkLoginStatus() {
    const token = sessionStorage.getItem('admin_token');
    if (token) {
        // 验证token是否有效
        fetch('/api/verify-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                // token有效，跳转到管理页面
                window.location.href = '/admin';
            }
        })
        .catch(error => {
            console.log('Token验证失败:', error);
            // token无效，清除并继续显示登录页面
            sessionStorage.removeItem('admin_token');
            sessionStorage.removeItem('admin_user');
        });
    }
}

// 添加震动动画样式
const style = document.createElement('style');
style.textContent = `
    .shake {
        animation: shake 0.5s ease-in-out;
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    new LoginManager();
});

// 防止页面被嵌入iframe（安全措施）
if (window.top !== window.self) {
    window.top.location = window.self.location;
}