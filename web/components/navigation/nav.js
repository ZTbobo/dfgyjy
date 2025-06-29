// 导航组件JavaScript

// 导航HTML模板
const navigationHTML = `
<nav class="navbar">
    <div class="nav-container">
        <a href="index.html" class="nav-logo">
            <img src="images/logo1.png" alt="西安顶峰国际教育中心">
        </a>
        
        <ul class="nav-menu" id="nav-menu">
            <li class="nav-item">
                <a href="index.html" class="nav-link" data-page="index">首页</a>
            </li>
            <li class="nav-item dropdown">
                <a href="#" class="nav-link">留学目的地</a>
                <div class="dropdown-menu">
                    <a href="singapore.html" class="dropdown-item" data-page="singapore">新加坡留学</a>
                <a href="malaysia.html" class="dropdown-item" data-page="malaysia">马来西亚留学</a>
                <a href="korea.html" class="dropdown-item" data-page="korea">韩国留学</a>
                <a href="russia.html" class="dropdown-item" data-page="russia">俄罗斯留学</a>
                </div>
            </li>
            <li class="nav-item">
                <a href="#services" class="nav-link" onclick="scrollToSection('services')">服务项目</a>
            </li>
            <li class="nav-item">
                <a href="#about" class="nav-link" onclick="scrollToSection('about')">关于我们</a>
            </li>
            <li class="nav-item">
                <a href="#contact" class="nav-link" onclick="scrollToSection('contact')">联系我们</a>
            </li>
            <li class="nav-item">
                <a href="#contact" class="nav-contact-btn" onclick="scrollToSection('contact')">免费咨询</a>
            </li>
        </ul>
        

        
        <button class="mobile-menu-btn" id="mobile-menu-btn">
            ☰
        </button>
    </div>
</nav>
`;

// 初始化导航组件
function initNavigation() {
    // 插入导航HTML
    const navContainer = document.getElementById('navigation-container');
    if (navContainer) {
        navContainer.innerHTML = navigationHTML;
    }
    
    // 设置当前页面的活跃状态
    setActiveNavItem();
    
    // 绑定移动端菜单事件
    bindMobileMenuEvents();
    
    // 绑定滚动事件
    bindScrollEvents();
    
    // 绑定平滑滚动
    bindSmoothScroll();
    

    
    // 处理页面加载时的锚点跳转
    handleAnchorOnLoad();
}

// 设置当前页面的导航项为活跃状态
function setActiveNavItem() {
    const currentPage = getCurrentPageName();
    const navLinks = document.querySelectorAll('.nav-link[data-page]');
    const dropdownItems = document.querySelectorAll('.dropdown-item[data-page]');
    
    // 移除所有活跃状态
    navLinks.forEach(link => link.classList.remove('active'));
    dropdownItems.forEach(item => item.classList.remove('active'));
    
    // 设置当前页面的活跃状态
    const activeLink = document.querySelector(`[data-page="${currentPage}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
        
        // 如果是下拉菜单项，也要高亮父级菜单
        if (activeLink.classList.contains('dropdown-item')) {
            const parentDropdown = activeLink.closest('.dropdown');
            if (parentDropdown) {
                const parentLink = parentDropdown.querySelector('.nav-link');
                if (parentLink) {
                    parentLink.classList.add('active');
                }
            }
        }
    }
}

// 获取当前页面名称
function getCurrentPageName() {
    const path = window.location.pathname;
    const fileName = path.split('/').pop();
    
    if (fileName === '' || fileName === 'index.html') {
        return 'index';
    }
    
    return fileName.replace('.html', '');
}

// 绑定移动端菜单事件
function bindMobileMenuEvents() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navMenu = document.getElementById('nav-menu');
    
    if (mobileMenuBtn && navMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            
            // 切换按钮图标
            if (navMenu.classList.contains('active')) {
                mobileMenuBtn.innerHTML = '✕';
            } else {
                mobileMenuBtn.innerHTML = '☰';
            }
        });
        
        // 点击菜单项时关闭移动端菜单
        const navLinks = navMenu.querySelectorAll('.nav-link, .dropdown-item');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    navMenu.classList.remove('active');
                    mobileMenuBtn.innerHTML = '☰';
                }
            });
        });
    }
}

// 绑定滚动事件
function bindScrollEvents() {
    const navbar = document.querySelector('.navbar');
    
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }
}

// 绑定平滑滚动
function bindSmoothScroll() {
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            
            // 如果是锚点链接
            if (href.startsWith('#') && href !== '#') {
                e.preventDefault();
                
                const targetElement = document.querySelector(href);
                if (targetElement) {
                    const offsetTop = targetElement.offsetTop - 70; // 减去导航栏高度
                    
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
}

// 窗口大小改变时的处理
function handleResize() {
    const navMenu = document.getElementById('nav-menu');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    
    if (window.innerWidth > 768) {
        if (navMenu) {
            navMenu.classList.remove('active');
        }
        if (mobileMenuBtn) {
            mobileMenuBtn.innerHTML = '☰';
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initNavigation);

// 窗口大小改变时的处理
window.addEventListener('resize', handleResize);

// 滚动到指定部分的函数
function scrollToSection(sectionId) {
    // 首先检查当前页面是否为首页
    const currentPage = getCurrentPageName();
    
    if (currentPage !== 'index') {
        // 如果不在首页，先跳转到首页，然后滚动到指定部分
        window.location.href = `index.html#${sectionId}`;
        return;
    }
    
    // 如果在首页，直接滚动到指定部分
    const targetElement = document.querySelector(`#${sectionId}`) || 
                         document.querySelector(`.${sectionId}-section`);
    
    if (targetElement) {
        const offsetTop = targetElement.offsetTop - 120; // 增加偏移量，确保正确定位
        
        window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
        });
    } else {
        // 如果找不到目标元素，滚动到页面顶部
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
}

// 处理页面加载时的锚点跳转
function handleAnchorOnLoad() {
    const hash = window.location.hash;
    if (hash) {
        // 延迟执行，确保页面完全加载
        setTimeout(() => {
            const sectionId = hash.substring(1);
            scrollToSection(sectionId);
        }, 100);
    }
}



// 导出函数供其他脚本使用
window.NavigationComponent = {
    init: initNavigation,
    scrollToSection: scrollToSection
};

// 将scrollToSection函数设为全局函数
window.scrollToSection = scrollToSection;