// 滚动动画效果
class ScrollAnimations {
    constructor() {
        this.init();
    }

    init() {
        this.setupIntersectionObserver();
        this.addScrollEffects();
        this.createFloatingElements();
    }

    // 设置交叉观察器，用于检测元素进入视口
    setupIntersectionObserver() {
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

        // 观察所有主要板块
        const sections = document.querySelectorAll('section');
        sections.forEach(section => {
            section.classList.add('fade-in-section');
            observer.observe(section);
        });

        // 观察卡片元素
        const cards = document.querySelectorAll('.service-card, .advantage-card, .destination-card, .process-step');
        cards.forEach((card, index) => {
            card.classList.add('fade-in-card');
            card.style.animationDelay = `${index * 0.1}s`;
            observer.observe(card);
        });
    }

    // 添加滚动视差效果
    addScrollEffects() {
        let ticking = false;

        const updateScrollEffects = () => {
            const scrolled = window.pageYOffset;
            const rate = scrolled * -0.5;

            // 为粒子添加视差效果
            const particles = document.querySelectorAll('.particle');
            particles.forEach((particle, index) => {
                const speed = 0.2 + (index * 0.1);
                particle.style.transform = `translateY(${scrolled * speed}px)`;
            });

            ticking = false;
        };

        const requestScrollUpdate = () => {
            if (!ticking) {
                requestAnimationFrame(updateScrollEffects);
                ticking = true;
            }
        };

        window.addEventListener('scroll', requestScrollUpdate, { passive: true });
    }

    // 创建额外的浮动装饰元素
    createFloatingElements() {
        const hero = document.querySelector('.hero-section');
        if (hero) {
            for (let i = 0; i < 8; i++) {
                const floatingElement = document.createElement('div');
                floatingElement.className = 'floating-decoration';
                floatingElement.style.cssText = `
                    position: absolute;
                    width: ${Math.random() * 6 + 4}px;
                    height: ${Math.random() * 6 + 4}px;
                    background: radial-gradient(circle, rgba(255, 255, 255, 0.6) 0%, transparent 70%);
                    border-radius: 50%;
                    top: ${Math.random() * 100}%;
                    left: ${Math.random() * 100}%;
                    animation: float ${Math.random() * 3 + 4}s ease-in-out infinite;
                    animation-delay: ${Math.random() * 2}s;
                    pointer-events: none;
                    z-index: 1;
                `;
                hero.appendChild(floatingElement);
            }
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new ScrollAnimations();
});

// 添加平滑滚动
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});