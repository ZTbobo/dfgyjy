// 标签页切换功能
class TabManager {
    constructor() {
        this.init();
    }
    
    init() {
        // 绑定所有标签按钮的点击事件
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = button.getAttribute('onclick');
                if (targetTab) {
                    // 提取目标标签ID
                    const match = targetTab.match(/showTab\('([^']+)'\)/);
                    if (match) {
                        this.showTab(match[1]);
                    }
                }
            });
        });
    }
    
    showTab(tabId) {
        // 隐藏所有标签内容
        const allTabPanes = document.querySelectorAll('.tab-pane');
        allTabPanes.forEach(pane => {
            pane.classList.remove('active');
        });
        
        // 移除所有按钮的活跃状态
        const allTabButtons = document.querySelectorAll('.tab-btn');
        allTabButtons.forEach(button => {
            button.classList.remove('active');
        });
        
        // 显示目标标签内容
        const targetPane = document.getElementById(tabId);
        if (targetPane) {
            targetPane.classList.add('active');
        }
        
        // 设置对应按钮为活跃状态
        const targetButton = document.querySelector(`[onclick="showTab('${tabId}')"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }
        
        // 添加淡入动画效果
        if (targetPane) {
            targetPane.style.opacity = '0';
            targetPane.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                targetPane.style.transition = 'all 0.3s ease';
                targetPane.style.opacity = '1';
                targetPane.style.transform = 'translateY(0)';
            }, 10);
        }
    }
}

// 全局函数，供HTML中的按钮调用
function showTab(tabId) {
    if (window.tabManagerInstance) {
        window.tabManagerInstance.showTab(tabId);
    }
}

// 页面加载完成后初始化标签管理器
document.addEventListener('DOMContentLoaded', () => {
    window.tabManagerInstance = new TabManager();
});

// 导出标签管理器类供其他脚本使用
window.TabManager = TabManager;

// 额外的交互功能
class InteractiveFeatures {
    constructor() {
        this.init();
    }
    
    init() {
        // 平滑滚动到锚点
        this.bindSmoothScroll();
        
        // 添加滚动动画
        this.bindScrollAnimations();
        
        // 添加表单验证
        this.bindFormValidation();
        
        // 添加返回顶部按钮
        this.addBackToTopButton();
    }
    
    bindSmoothScroll() {
        const links = document.querySelectorAll('a[href^="#"]');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href !== '#' && href.length > 1) {
                    const target = document.querySelector(href);
                    if (target) {
                        e.preventDefault();
                        const offsetTop = target.offsetTop - 80; // 考虑导航栏高度
                        window.scrollTo({
                            top: offsetTop,
                            behavior: 'smooth'
                        });
                    }
                }
            });
        });
    }
    
    bindScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, observerOptions);
        
        // 观察需要动画的元素
        const animateElements = document.querySelectorAll(
            '.service-card, .destination-card, .university-card, .stat-item, .cost-category'
        );
        
        animateElements.forEach(el => {
            observer.observe(el);
        });
    }
    
    bindFormValidation() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            // 防抖验证
            const debouncedValidation = this.debounce((field) => {
                this.validateField(field);
            }, 300);
            
            // 实时验证
            const inputs = form.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                input.addEventListener('blur', () => {
                    this.validateField(input);
                });
                
                input.addEventListener('input', () => {
                    debouncedValidation(input);
                });
            });
            
            // 表单提交验证
            form.addEventListener('submit', (e) => {
                if (!this.validateForm(form)) {
                    e.preventDefault();
                }
            });
        });
    }
    
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
    
    validateField(field) {
        let isValid = true;
        const value = field.value.trim();
        
        // 必填验证
        if (field.hasAttribute('required') && !value) {
            this.showFieldError(field, '此字段为必填项');
            return false;
        }
        
        // 邮箱验证
        if (field.type === 'email' && value && !this.isValidEmail(value)) {
            this.showFieldError(field, '请输入有效的邮箱地址');
            return false;
        }
        
        // 手机号验证
        if (field.name === 'phone' && value) {
            const phoneRegex = /^1[3-9]\d{9}$/;
            if (!phoneRegex.test(value)) {
                this.showFieldError(field, '请输入有效的手机号码');
                return false;
            }
        }
        
        // 姓名验证
        if (field.name === 'name' && value && value.length < 2) {
            this.showFieldError(field, '姓名至少需要2个字符');
            return false;
        }
        
        // 如果验证通过，清除错误
        if (isValid) {
            this.clearFieldError(field);
        }
        
        return isValid;
    }
    
    validateForm(form) {
        let isValid = true;
        const fields = form.querySelectorAll('input, textarea, select');
        
        fields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });
        
        return isValid;
    }
    
    showFieldError(field, message) {
        this.clearFieldError(field);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        errorDiv.style.color = '#dc3545';
        errorDiv.style.fontSize = '0.875rem';
        errorDiv.style.marginTop = '5px';
        
        field.style.borderColor = '#dc3545';
        field.parentNode.appendChild(errorDiv);
    }
    
    clearFieldError(field) {
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
        field.style.borderColor = '';
    }
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    addBackToTopButton() {
        const backToTopButton = document.createElement('button');
        backToTopButton.innerHTML = '↑';
        backToTopButton.className = 'back-to-top';
        backToTopButton.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: linear-gradient(45deg, #007bff, #0056b3);
            color: white;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
            z-index: 1000;
            box-shadow: 0 5px 15px rgba(0, 123, 255, 0.3);
        `;
        
        backToTopButton.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
        
        document.body.appendChild(backToTopButton);
        
        // 滚动时显示/隐藏按钮
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backToTopButton.style.opacity = '1';
                backToTopButton.style.visibility = 'visible';
            } else {
                backToTopButton.style.opacity = '0';
                backToTopButton.style.visibility = 'hidden';
            }
        });
    }
}

// 初始化交互功能
document.addEventListener('DOMContentLoaded', () => {
    new InteractiveFeatures();
});

// 添加CSS动画类
const style = document.createElement('style');
style.textContent = `
    .animate-in {
        animation: slideInUp 0.6s ease forwards;
    }
    
    @keyframes slideInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .back-to-top:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 20px rgba(0, 123, 255, 0.4) !important;
    }
`;
document.head.appendChild(style);