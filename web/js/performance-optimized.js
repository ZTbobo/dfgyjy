// 高性能滚动动画和交互优化
class PerformanceOptimizedAnimations {
    constructor() {
        this.isScrolling = false;
        this.scrollTimeout = null;
        this.observers = new Map();
        this.animationFrameId = null;
        this.lastScrollY = 0;
        this.init();
    }

    init() {
        // 禁用滚动动画以避免闪烁效果
        // this.setupIntersectionObserver();
        this.optimizeScrollHandling();
        this.setupPerformanceMonitoring();
        this.preloadCriticalResources();
    }

    // 优化的交叉观察器
    setupIntersectionObserver() {
        const observerOptions = {
            threshold: [0, 0.1, 0.5, 1],
            rootMargin: '50px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const element = entry.target;
                
                if (entry.isIntersecting) {
                    // 使用 requestAnimationFrame 确保动画在下一帧执行
                    requestAnimationFrame(() => {
                        element.classList.add('animate-in');
                        element.style.willChange = 'auto'; // 动画完成后清除will-change
                    });
                } else {
                    element.classList.remove('animate-in');
                }
            });
        }, observerOptions);

        // 观察所有需要动画的元素
        const animatedElements = document.querySelectorAll(
            'section, .service-card, .advantage-card, .destination-card, .process-step'
        );
        
        animatedElements.forEach((element, index) => {
            element.classList.add('fade-in-element');
            element.style.animationDelay = `${index * 0.05}s`; // 减少延迟间隔
            observer.observe(element);
        });

        this.observers.set('main', observer);
    }

    // 优化滚动处理
    optimizeScrollHandling() {
        let ticking = false;
        let scrollDirection = 'down';

        const updateScrollEffects = () => {
            const currentScrollY = window.pageYOffset;
            const scrollDelta = currentScrollY - this.lastScrollY;
            
            scrollDirection = scrollDelta > 0 ? 'down' : 'up';
            this.lastScrollY = currentScrollY;

            // 只在必要时更新视差效果
            if (Math.abs(scrollDelta) > 2) {
                this.updateParallaxElements(currentScrollY);
            }

            // 更新导航栏状态
            this.updateNavigationState(currentScrollY, scrollDirection);

            ticking = false;
        };

        const requestScrollUpdate = () => {
            if (!ticking) {
                this.animationFrameId = requestAnimationFrame(updateScrollEffects);
                ticking = true;
            }
        };

        // 使用被动监听器提高性能
        window.addEventListener('scroll', requestScrollUpdate, { 
            passive: true,
            capture: false
        });

        // 滚动结束检测
        window.addEventListener('scroll', () => {
            clearTimeout(this.scrollTimeout);
            this.isScrolling = true;
            
            this.scrollTimeout = setTimeout(() => {
                this.isScrolling = false;
                this.cleanupScrollEffects();
            }, 150);
        }, { passive: true });
    }

    // 更新视差元素（减少DOM操作）
    updateParallaxElements(scrollY) {
        const particles = document.querySelectorAll('.particle');
        const batchSize = 3; // 批量处理减少重绘
        
        for (let i = 0; i < particles.length; i += batchSize) {
            requestAnimationFrame(() => {
                for (let j = i; j < Math.min(i + batchSize, particles.length); j++) {
                    const particle = particles[j];
                    if (particle) {
                        const speed = 0.1 + (j * 0.05);
                        const translateY = scrollY * speed;
                        particle.style.transform = `translate3d(0, ${translateY}px, 0)`;
                    }
                }
            });
        }
    }

    // 更新导航状态
    updateNavigationState(scrollY, direction) {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;

        if (scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    // 清理滚动效果
    cleanupScrollEffects() {
        // 清理不必要的will-change属性
        const animatedElements = document.querySelectorAll('[style*="will-change"]');
        animatedElements.forEach(element => {
            if (!element.classList.contains('animating')) {
                element.style.willChange = 'auto';
            }
        });
    }

    // 性能监控
    setupPerformanceMonitoring() {
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    if (entry.entryType === 'measure' && entry.duration > 16) {
                        console.warn(`Performance warning: ${entry.name} took ${entry.duration}ms`);
                    }
                });
            });
            
            observer.observe({ entryTypes: ['measure', 'navigation'] });
        }
    }

    // 预加载关键资源
    preloadCriticalResources() {
        const criticalImages = document.querySelectorAll('img[data-critical="true"]');
        
        criticalImages.forEach(img => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = img.src || img.dataset.src;
            document.head.appendChild(link);
        });
        
        // 处理懒加载图片
        this.setupLazyImages();
    }
    
    // 设置懒加载图片
    setupLazyImages() {
        const lazyImages = document.querySelectorAll('.lazy-image');
        
        lazyImages.forEach(img => {
            // 确保图片能够正常显示
            img.addEventListener('load', () => {
                img.classList.add('loaded');
                img.classList.remove('loading');
            });
            
            img.addEventListener('error', () => {
                console.warn('图片加载失败:', img.src);
                img.classList.add('error');
            });
            
            // 如果图片已经加载完成
            if (img.complete && img.naturalHeight !== 0) {
                img.classList.add('loaded');
            }
        });
    }

    // 优化的平滑滚动
    setupSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                
                if (target) {
                    // 使用原生平滑滚动，性能更好
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                        inline: 'nearest'
                    });
                }
            }, { passive: false });
        });
    }

    // 销毁方法
    destroy() {
        // 清理观察器
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        
        // 取消动画帧
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        // 清理定时器
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
    }
}

// 页面可见性API优化
class VisibilityOptimizer {
    constructor() {
        this.isVisible = !document.hidden;
        this.setupVisibilityHandling();
    }

    setupVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            this.isVisible = !document.hidden;
            
            if (this.isVisible) {
                this.resumeAnimations();
            } else {
                this.pauseAnimations();
            }
        });
    }

    pauseAnimations() {
        // 暂停所有CSS动画
        const style = document.createElement('style');
        style.id = 'pause-animations';
        style.textContent = `
            *, *::before, *::after {
                animation-play-state: paused !important;
                transition-duration: 0s !important;
            }
        `;
        document.head.appendChild(style);
    }

    resumeAnimations() {
        // 恢复动画
        const pauseStyle = document.getElementById('pause-animations');
        if (pauseStyle) {
            pauseStyle.remove();
        }
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否支持现代特性
    if ('IntersectionObserver' in window && 'requestAnimationFrame' in window) {
        new PerformanceOptimizedAnimations();
        new VisibilityOptimizer();
    } else {
        // 降级处理
        console.warn('Browser does not support modern performance features');
    }
});

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PerformanceOptimizedAnimations, VisibilityOptimizer };
}