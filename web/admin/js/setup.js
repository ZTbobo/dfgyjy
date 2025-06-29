// 设置页面JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const setupForm = document.getElementById('setupForm');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const setupBtn = document.getElementById('setupBtn');
    const messageDiv = document.getElementById('message');
    
    // 密码强度检查
    passwordInput.addEventListener('input', checkPasswordStrength);
    confirmPasswordInput.addEventListener('input', checkPasswordMatch);
    
    // 表单提交
    setupForm.addEventListener('submit', handleSetup);
    
    // 检查是否已经初始化
    checkInitializationStatus();
});

// 检查系统是否已经初始化
function checkInitializationStatus() {
    fetch('/api/check-initialization')
        .then(response => response.json())
        .then(result => {
            if (result.initialized) {
                // 如果已经初始化，跳转到登录页面
                window.location.href = '/admin/login';
            }
        })
        .catch(error => {
            console.error('检查初始化状态失败:', error);
        });
}

// 密码显示/隐藏切换
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// 检查密码强度
function checkPasswordStrength() {
    const password = document.getElementById('password').value;
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    
    if (!password) {
        strengthFill.style.width = '0%';
        strengthText.textContent = '密码强度：未设置';
        strengthText.style.color = '#666';
        return;
    }
    
    let score = 0;
    let feedback = [];
    
    // 长度检查
    if (password.length >= 8) {
        score += 1;
    } else {
        feedback.push('至少8个字符');
    }
    
    // 大写字母
    if (/[A-Z]/.test(password)) {
        score += 1;
    } else {
        feedback.push('包含大写字母');
    }
    
    // 小写字母
    if (/[a-z]/.test(password)) {
        score += 1;
    } else {
        feedback.push('包含小写字母');
    }
    
    // 数字
    if (/[0-9]/.test(password)) {
        score += 1;
    } else {
        feedback.push('包含数字');
    }
    
    // 特殊字符
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        score += 1;
    } else {
        feedback.push('包含特殊字符');
    }
    
    // 更新强度显示
    let strength, color, width;
    
    if (score <= 2) {
        strength = '弱';
        color = '#dc3545';
        width = '33%';
        strengthFill.className = 'strength-fill strength-weak';
    } else if (score <= 4) {
        strength = '中等';
        color = '#ffc107';
        width = '66%';
        strengthFill.className = 'strength-fill strength-medium';
    } else {
        strength = '强';
        color = '#28a745';
        width = '100%';
        strengthFill.className = 'strength-fill strength-strong';
    }
    
    strengthFill.style.width = width;
    strengthText.textContent = `密码强度：${strength}`;
    strengthText.style.color = color;
    
    if (feedback.length > 0) {
        strengthText.textContent += ` (缺少: ${feedback.join(', ')})`;
    }
    
    // 检查密码匹配
    checkPasswordMatch();
}

// 检查密码匹配
function checkPasswordMatch() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const confirmInput = document.getElementById('confirmPassword');
    
    if (!confirmPassword) {
        confirmInput.style.borderColor = '#ddd';
        return;
    }
    
    if (password === confirmPassword) {
        confirmInput.style.borderColor = '#28a745';
    } else {
        confirmInput.style.borderColor = '#dc3545';
    }
}

// 验证密码强度
function isPasswordStrong(password) {
    const requirements = [
        password.length >= 8,
        /[A-Z]/.test(password),
        /[a-z]/.test(password),
        /[0-9]/.test(password),
        /[!@#$%^&*(),.?":{}|<>]/.test(password)
    ];
    
    return requirements.filter(req => req).length >= 4;
}

// 处理设置表单提交
function handleSetup(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const email = formData.get('email');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    
    // 验证表单
    if (!validateSetupForm(username, email, password, confirmPassword)) {
        return;
    }
    
    // 显示加载状态
    const setupBtn = document.getElementById('setupBtn');
    const originalText = setupBtn.innerHTML;
    setupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在设置...';
    setupBtn.disabled = true;
    
    // 发送设置请求
    fetch('/api/setup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username,
            email,
            password
        })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showMessage('设置成功！正在跳转到登录页面...', 'success');
            
            // 3秒后跳转到登录页面
            setTimeout(() => {
                window.location.href = '/admin/login';
            }, 3000);
        } else {
            showMessage('设置失败：' + result.message, 'error');
            setupBtn.innerHTML = originalText;
            setupBtn.disabled = false;
        }
    })
    .catch(error => {
        console.error('设置失败:', error);
        showMessage('设置失败，请重试', 'error');
        setupBtn.innerHTML = originalText;
        setupBtn.disabled = false;
    });
}

// 验证设置表单
function validateSetupForm(username, email, password, confirmPassword) {
    // 用户名验证
    if (!username || username.length < 3 || username.length > 20) {
        showMessage('用户名长度必须在3-20个字符之间', 'error');
        return false;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        showMessage('用户名只能包含字母、数字和下划线', 'error');
        return false;
    }
    
    // 邮箱验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        showMessage('请输入有效的邮箱地址', 'error');
        return false;
    }
    
    // 密码验证
    if (!password || password.length < 8) {
        showMessage('密码长度至少为8个字符', 'error');
        return false;
    }
    
    if (!isPasswordStrong(password)) {
        showMessage('密码强度不够，请包含大写字母、小写字母、数字和特殊字符', 'error');
        return false;
    }
    
    // 确认密码验证
    if (password !== confirmPassword) {
        showMessage('两次输入的密码不一致', 'error');
        return false;
    }
    
    return true;
}

// 显示消息
function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // 3秒后隐藏消息（除非是成功消息）
    if (type !== 'success') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    }
}

// 防止页面被嵌入iframe
if (window.top !== window.self) {
    window.top.location = window.self.location;
}