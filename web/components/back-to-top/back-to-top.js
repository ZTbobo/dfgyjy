// 回到顶部按钮组件
class BackToTopButton {
    constructor() {
        this.button = null;
        this.isVisible = false;
        this.init();
    }

    init() {
        this.createButton();
        this.bindEvents();
        this.handleScroll();
    }

    createButton() {
        // 创建按钮元素
        this.button = document.createElement('div');
        this.button.className = 'back-to-top-btn';
        this.button.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L12 20M12 4L6 10M12 4L18 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        this.button.title = '回到顶部';
        
        // 添加到页面
        document.body.appendChild(this.button);
    }

    bindEvents() {
        // 点击事件
        this.button.addEventListener('click', () => {
            this.scrollToTop();
        });

        // 滚动事件
        window.addEventListener('scroll', () => {
            this.handleScroll();
        });

        // 页面大小改变事件
        window.addEventListener('resize', () => {
            this.handleScroll();
        });
    }

    handleScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const shouldShow = scrollTop > 300; // 滚动超过300px时显示

        if (shouldShow && !this.isVisible) {
            this.showButton();
        } else if (!shouldShow && this.isVisible) {
            this.hideButton();
        }
    }

    showButton() {
        this.isVisible = true;
        this.button.classList.add('visible');
    }

    hideButton() {
        this.isVisible = false;
        this.button.classList.remove('visible');
    }

    scrollToTop() {
        // 平滑滚动到顶部
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

        // 添加点击动画效果
        this.button.classList.add('clicked');
        setTimeout(() => {
            this.button.classList.remove('clicked');
        }, 200);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new BackToTopButton();
});

// 导出供其他脚本使用
window.BackToTopButton = BackToTopButton;