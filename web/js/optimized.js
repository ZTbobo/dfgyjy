/* 优化后的JavaScript - 提升性能和用户体验 */

// 性能优化的工具函数
const Utils = {
    // 防抖函数
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
    },

    // 节流函数
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // 优化的DOM查询缓存
    cache: new Map(),
    
    $(selector) {
        if (!this.cache.has(selector)) {
            this.cache.set(selector, document.querySelectorAll(selector));
        }
        return this.cache.get(selector);
    },

    // 清除缓存
    clearCache() {
        this.cache.clear();
    }
};

// 优化后的轮播图类
class OptimizedCarousel {
    constructor(selector = '.carousel-container') {
        this.container = document.querySelector(selector);
        if (!this.container) return;
        
        this.currentSlide = 0;
        this.slides = this.container.querySelectorAll('.carousel-slide');
        this.indicators = this.container.querySelectorAll('.indicator');
        this.totalSlides = this.slides.length;
        this.autoPlayInterval = null;
        this.autoPlayDelay = 5000;
        this.isTransitioning = false;
        
        this.init();
    }
    
    init() {
        if (this.totalSlides === 0) return;
        
        // 预加载图片
        this.preloadImages();
        
        // 绑定事件（使用事件委托）
        this.bindEvents();
        
        // 开始自动播放
        this.startAutoPlay();
        
        // 页面可见性API优化
        this.handleVisibilityChange();
    }
    
    preloadImages() {
        this.slides.forEach(slide => {
            const img = slide.querySelector('img');
            if (img && img.dataset.src) {
                img.src = img.dataset.src;
                img.onload = () => img.classList.add('loaded');
            }
        });
    }
    
    bindEvents() {
        // 使用事件委托优化性能
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('indicator')) {
                const index = parseInt(e.target.dataset.slide);
                this.goToSlide(index);
            } else if (e.target.classList.contains('prev')) {
                this.previousSlide();
            } else if (e.target.classList.contains('next')) {
                this.nextSlide();
            }
        });
        
        // 键盘导航
        document.addEventListener('keydown', Utils.throttle((e) => {
            if (e.key === 'ArrowLeft') this.previousSlide();
            if (e.key === 'ArrowRight') this.nextSlide();
        }, 300));
        
        // 鼠标悬停控制
        this.container.addEventListener('mouseenter', () => this.stopAutoPlay());
        this.container.addEventListener('mouseleave', () => this.startAutoPlay());
        
        // 触摸支持
        this.bindTouchEvents();
    }
    
    bindTouchEvents() {
        let startX = 0;
        let startY = 0;
        let endX = 0;
        let endY = 0;
        
        this.container.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });
        
        this.container.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            endY = e.changedTouches[0].clientY;
            
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            
            // 确保是水平滑动
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                if (deltaX > 0) {
                    this.previousSlide();
                } else {
                    this.nextSlide();
                }
            }
        }, { passive: true });
    }
    
    goToSlide(index) {
        if (this.isTransitioning || index === this.currentSlide) return;
        
        this.isTransitioning = true;
        
        // 使用requestAnimationFrame优化动画
        requestAnimationFrame(() => {
            this.slides[this.currentSlide].classList.remove('active');
            this.indicators[this.currentSlide].classList.remove('active');
            
            this.currentSlide = index;
            
            this.slides[this.currentSlide].classList.add('active');
            this.indicators[this.currentSlide].classList.add('active');
            
            setTimeout(() => {
                this.isTransitioning = false;
            }, 500);
        });
    }
    
    nextSlide() {
        const nextIndex = (this.currentSlide + 1) % this.totalSlides;
        this.goToSlide(nextIndex);
    }
    
    previousSlide() {
        const prevIndex = (this.currentSlide - 1 + this.totalSlides) % this.totalSlides;
        this.goToSlide(prevIndex);
    }
    
    startAutoPlay() {
        this.stopAutoPlay();
        this.autoPlayInterval = setInterval(() => {
            this.nextSlide();
        }, this.autoPlayDelay);
    }
    
    stopAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }
    
    handleVisibilityChange() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAutoPlay();
            } else {
                this.startAutoPlay();
            }
        });
    }
}

// 优化后的标签管理器
class OptimizedTabManager {
    constructor() {
        this.activeTab = null;
        this.init();
    }
    
    init() {
        // 使用事件委托
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                e.preventDefault();
                const tabId = this.extractTabId(e.target);
                if (tabId) {
                    this.showTab(tabId, e.target);
                }
            }
        });
    }
    
    extractTabId(button) {
        const onclick = button.getAttribute('onclick');
        if (onclick) {
            const match = onclick.match(/showTab\('([^']+)'\)/);
            return match ? match[1] : null;
        }
        return button.dataset.tab;
    }
    
    showTab(tabId, clickedButton) {
        if (this.activeTab === tabId) return;
        
        // 使用DocumentFragment优化DOM操作
        const fragment = document.createDocumentFragment();
        
        // 批量更新DOM
        requestAnimationFrame(() => {
            // 隐藏所有标签内容
            const allTabPanes = document.querySelectorAll('.tab-pane');
            allTabPanes.forEach(pane => pane.classList.remove('active'));
            
            // 移除所有按钮的活跃状态
            const allTabButtons = document.querySelectorAll('.tab-btn');
            allTabButtons.forEach(button => button.classList.remove('active'));
            
            // 显示目标标签内容
            const targetPane = document.getElementById(tabId);
            if (targetPane) {
                targetPane.classList.add('active');
                this.activeTab = tabId;
            }
            
            // 设置按钮活跃状态
            if (clickedButton) {
                clickedButton.classList.add('active');
            }
        });
    }
}

// 性能监控和优化
class PerformanceOptimizer {
    constructor() {
        this.init();
    }
    
    init() {
        // 懒加载图片
        this.lazyLoadImages();
        
        // 优化滚动性能
        this.optimizeScroll();
        
        // 预加载关键资源
        this.preloadCriticalResources();
    }
    
    lazyLoadImages() {
        const images = document.querySelectorAll('img[data-src]');
        
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.add('lazy-img');
                        img.onload = () => img.classList.add('loaded');
                        imageObserver.unobserve(img);
                    }
                });
            });
            
            images.forEach(img => imageObserver.observe(img));
        } else {
            // 降级方案
            images.forEach(img => {
                img.src = img.dataset.src;
                img.classList.add('loaded');
            });
        }
    }
    
    optimizeScroll() {
        let ticking = false;
        
        const updateScrollPosition = () => {
            // 滚动相关的优化操作
            ticking = false;
        };
        
        const requestTick = () => {
            if (!ticking) {
                requestAnimationFrame(updateScrollPosition);
                ticking = true;
            }
        };
        
        window.addEventListener('scroll', requestTick, { passive: true });
    }
    
    preloadCriticalResources() {
        // 预加载关键CSS和JS
        const criticalResources = [
            'css/style.css',
            'css/country-page.css'
        ];
        
        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource;
            link.as = resource.endsWith('.css') ? 'style' : 'script';
            document.head.appendChild(link);
        });
    }
}

// 全局函数（保持向后兼容）
function showTab(tabId) {
    if (window.tabManager) {
        window.tabManager.showTab(tabId);
    }
}

function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化所有组件
    window.carousel = new OptimizedCarousel();
    window.tabManager = new OptimizedTabManager();
    window.performanceOptimizer = new PerformanceOptimizer();
    
    console.log('网站优化完成，性能提升！');
});