// 轮播图功能
class Carousel {
    constructor() {
        this.currentSlide = 0;
        this.slides = document.querySelectorAll('.carousel-slide');
        this.indicators = document.querySelectorAll('.indicator');
        this.totalSlides = this.slides.length;
        this.autoPlayInterval = null;
        this.autoPlayDelay = 5000; // 5秒自动切换
        
        this.init();
    }
    
    init() {
        // 重新获取DOM元素，确保元素已加载
        this.slides = document.querySelectorAll('.carousel-slide');
        this.indicators = document.querySelectorAll('.indicator');
        this.totalSlides = this.slides.length;
        
        console.log('轮播图初始化开始，幻灯片数量:', this.totalSlides);
        if (this.totalSlides === 0) {
            console.log('没有找到轮播图幻灯片');
            return;
        }
        
        // 绑定指示器点击事件
        this.indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => {
                this.goToSlide(index);
            });
        });
        
        // 绑定键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.previousSlide();
            } else if (e.key === 'ArrowRight') {
                this.nextSlide();
            }
        });
        
        // 鼠标悬停时暂停自动播放
        const carouselContainer = document.querySelector('.carousel-container');
        if (carouselContainer) {
            carouselContainer.addEventListener('mouseenter', () => {
                this.stopAutoPlay();
            });
            
            carouselContainer.addEventListener('mouseleave', () => {
                this.startAutoPlay();
            });
        }
        
        // 触摸事件支持
        this.bindTouchEvents();
        
        // 开始自动播放
        this.startAutoPlay();
        
        // 显示第一张幻灯片
        this.showSlide(0);
    }
    
    showSlide(index) {
        // 移除所有活跃状态
        this.slides.forEach(slide => slide.classList.remove('active'));
        this.indicators.forEach(indicator => indicator.classList.remove('active'));
        
        // 设置当前幻灯片为活跃状态
        if (this.slides[index]) {
            this.slides[index].classList.add('active');
        }
        if (this.indicators[index]) {
            this.indicators[index].classList.add('active');
        }
        
        this.currentSlide = index;
    }
    
    nextSlide() {
        const nextIndex = (this.currentSlide + 1) % this.totalSlides;
        this.showSlide(nextIndex);
    }
    
    previousSlide() {
        const prevIndex = (this.currentSlide - 1 + this.totalSlides) % this.totalSlides;
        this.showSlide(prevIndex);
    }
    
    goToSlide(index) {
        if (index >= 0 && index < this.totalSlides) {
            this.showSlide(index);
        }
    }
    
    startAutoPlay() {
        console.log('开始自动播放，延迟时间:', this.autoPlayDelay + 'ms');
        console.log('当前幻灯片数量:', this.totalSlides);
        this.stopAutoPlay(); // 清除现有的定时器
        
        // 确保有幻灯片才开始自动播放
        if (this.totalSlides > 1) {
            console.log('设置自动播放定时器');
            this.autoPlayInterval = setInterval(() => {
                console.log('自动切换到下一张幻灯片，当前索引:', this.currentSlide);
                this.nextSlide();
            }, this.autoPlayDelay);
            console.log('自动播放定时器已设置，ID:', this.autoPlayInterval);
        } else {
            console.log('幻灯片数量不足，无法启动自动播放');
        }
    }
    
    stopAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
        }
    }
    
    bindTouchEvents() {
        const carouselContainer = document.querySelector('.carousel-container');
        if (!carouselContainer) return;
        
        let startX = 0;
        let endX = 0;
        
        carouselContainer.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        });
        
        carouselContainer.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            this.handleSwipe(startX, endX);
        });
    }
    
    handleSwipe(startX, endX) {
        const threshold = 50; // 最小滑动距离
        const diff = startX - endX;
        
        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                // 向左滑动，显示下一张
                this.nextSlide();
            } else {
                // 向右滑动，显示上一张
                this.previousSlide();
            }
        }
    }
}

// 全局函数，供HTML中的按钮调用
function changeSlide(direction) {
    if (window.carouselInstance) {
        if (direction === 1) {
            window.carouselInstance.nextSlide();
        } else if (direction === -1) {
            window.carouselInstance.previousSlide();
        }
    }
}

// 将函数绑定到全局作用域
window.changeSlide = changeSlide;

// 页面加载完成后初始化轮播图
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，开始初始化轮播图');
    window.carouselInstance = new Carousel();
    console.log('轮播图实例创建完成:', window.carouselInstance);
});

// 窗口失去焦点时暂停自动播放
document.addEventListener('visibilitychange', () => {
    if (window.carouselInstance) {
        if (document.hidden) {
            console.log('页面隐藏，暂停自动播放');
            window.carouselInstance.stopAutoPlay();
        } else {
            console.log('页面显示，恢复自动播放');
            window.carouselInstance.startAutoPlay();
        }
    }
});

// 导出轮播图类供其他脚本使用
window.Carousel = Carousel;