// 联系表单处理
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

// 输入验证函数
function validateContactForm(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length < 2) {
        errors.push('姓名至少需要2个字符');
    }
    
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!data.phone || !phoneRegex.test(data.phone)) {
        errors.push('请输入有效的手机号码');
    }
    
    if (data.message && data.message.length > 500) {
        errors.push('留言内容不能超过500个字符');
    }
    
    return errors;
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，开始初始化表单');
    const contactForm = document.getElementById('contactForm');
    console.log('找到表单元素:', contactForm ? '是' : '否');
    console.log('表单元素详情:', contactForm);
    
    if (contactForm) {
        // 防抖提交处理
        const debouncedSubmit = debounce(async function(e) {
            console.log('表单提交事件触发');
            e.preventDefault();
            console.log('默认行为已阻止');
            
            const formData = new FormData(contactForm);
            const data = {
                name: formData.get('name')?.trim(),
                phone: formData.get('phone')?.trim(),
                message: formData.get('message')?.trim(),
                timestamp: new Date().toISOString(),
                type: 'contact'
            };
            
            // 前端验证
            const validationErrors = validateContactForm(data);
            if (validationErrors.length > 0) {
                showCenterMessage(validationErrors.join('\n'), 'error');
                return;
            }
            
            const submitBtn = contactForm.querySelector('.submit-btn');
            const originalText = submitBtn.textContent;
            
            try {
                // 显示提交中状态
                submitBtn.textContent = '提交中...';
                submitBtn.disabled = true;
                
                // 发送数据到后端
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    // 成功提示
                    showCenterMessage(result.message || '提交成功！我们会尽快与您联系。', 'success');
                    contactForm.reset();
                } else {
                    // 显示服务器返回的错误信息
                    const errorMessage = result.errors ? result.errors.join('\n') : result.message || '提交失败';
                    showCenterMessage(errorMessage, 'error');
                }
            } catch (error) {
                console.error('提交错误:', error);
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    showCenterMessage('网络连接失败，请检查网络后重试。', 'error');
                } else {
                    showCenterMessage('提交失败，请稍后重试。', 'error');
                }
            } finally {
                // 恢复按钮状态
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        }, 300);
        
        // 添加多重事件阻止机制
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('表单提交被拦截');
            debouncedSubmit(e);
            return false;
        });
        
        // 额外的按钮点击事件处理
        const submitBtn = contactForm.querySelector('.submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('提交按钮被点击');
                const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                contactForm.dispatchEvent(submitEvent);
                return false;
            });
        }
        
        console.log('表单事件监听器已绑定');
    }
});

// 显示就近消息提示
function showCenterMessage(message, type) {
    // 找到表单容器
    const formContainer = document.querySelector('.contact-form-container');
    if (!formContainer) {
        // 如果找不到表单容器，使用原来的中央显示方式
        showFallbackMessage(message, type);
        return;
    }
    
    // 移除已存在的提示
    const existingToast = formContainer.querySelector('.form-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // 创建消息提示框
    const toast = document.createElement('div');
    toast.className = 'form-toast';
    toast.style.cssText = `
        position: relative;
        background: ${type === 'success' ? '#f0f9ff' : '#fef2f2'};
        border: 2px solid ${type === 'success' ? '#10b981' : '#ef4444'};
        border-radius: 8px;
        padding: 16px 20px;
        margin-top: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideDown 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    `;
    
    // 创建图标
    const icon = document.createElement('div');
    icon.style.cssText = `
        font-size: 20px;
        color: ${type === 'success' ? '#10b981' : '#ef4444'};
        font-weight: bold;
    `;
    icon.textContent = type === 'success' ? '✓' : '✗';
    
    // 创建消息文本
    const messageText = document.createElement('div');
    messageText.style.cssText = `
        flex: 1;
        font-size: 14px;
        color: ${type === 'success' ? '#065f46' : '#991b1b'};
        line-height: 1.4;
    `;
    messageText.textContent = message;
    
    // 创建关闭按钮
    const closeButton = document.createElement('button');
    closeButton.style.cssText = `
        background: none;
        border: none;
        color: ${type === 'success' ? '#10b981' : '#ef4444'};
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    closeButton.innerHTML = '×';
    closeButton.onclick = () => {
        toast.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    };
    
    // 组装提示框
    toast.appendChild(icon);
    toast.appendChild(messageText);
    toast.appendChild(closeButton);
    
    // 添加到表单容器
    formContainer.appendChild(toast);
    
    // 自动消失
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }, 5000);
}

// 备用的中央显示方式
function showFallbackMessage(message, type) {
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        animation: fadeIn 0.3s ease;
    `;
    
    // 创建消息框
    const messageBox = document.createElement('div');
    messageBox.style.cssText = `
        background: white;
        padding: 40px 60px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        text-align: center;
        max-width: 500px;
        animation: slideUp 0.3s ease;
    `;
    
    // 创建图标
    const icon = document.createElement('div');
    icon.style.cssText = `
        font-size: 48px;
        margin-bottom: 20px;
        ${type === 'success' ? 'color: #10b981;' : 'color: #ef4444;'}
    `;
    icon.textContent = type === 'success' ? '✓' : '✗';
    
    // 创建消息文本
    const messageText = document.createElement('div');
    messageText.style.cssText = `
        font-size: 18px;
        color: #333;
        margin-bottom: 30px;
        line-height: 1.5;
    `;
    messageText.textContent = message;
    
    // 创建确定按钮
    const okButton = document.createElement('button');
    okButton.style.cssText = `
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border: none;
        padding: 12px 30px;
        border-radius: 6px;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
    `;
    okButton.textContent = '确定';
    okButton.onclick = () => {
        overlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 300);
    };
    
    // 组装消息框
    messageBox.appendChild(icon);
    messageBox.appendChild(messageText);
    messageBox.appendChild(okButton);
    overlay.appendChild(messageBox);
    
    // 添加动画样式
    if (!document.querySelector('#centerMessageStyles')) {
        const style = document.createElement('style');
        style.id = 'centerMessageStyles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            @keyframes slideUp {
                from { transform: translateY(30px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // 添加到页面
    document.body.appendChild(overlay);
}