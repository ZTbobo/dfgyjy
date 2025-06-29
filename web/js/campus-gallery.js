// 校区图片画廊功能
let currentCultureImageIndex = 0;
let cultureAutoPlayInterval = null;
const cultureAutoPlayDelay = 4000; // 4秒自动切换

// 切换图片函数
function changeCultureImage(direction) {
    console.log('changeCultureImage 被调用，方向:', direction);
    const images = document.querySelectorAll('.culture-image');
    
    console.log('找到图片数量:', images.length);
    if (images.length === 0) {
        console.warn('没有找到图片元素');
        return;
    }
    
    // 移除当前活动状态
    if (images[currentCultureImageIndex]) {
        images[currentCultureImageIndex].classList.remove('active');
    }
    
    // 更新索引
    currentCultureImageIndex += direction;
    
    // 循环处理
    if (currentCultureImageIndex >= images.length) {
        currentCultureImageIndex = 0;
    } else if (currentCultureImageIndex < 0) {
        currentCultureImageIndex = images.length - 1;
    }
    
    // 添加新的活动状态
    if (images[currentCultureImageIndex]) {
        images[currentCultureImageIndex].classList.add('active');
        console.log(`切换到第 ${currentCultureImageIndex + 1} 张图片`);
    }
    
    // 重新启动自动播放（重置定时器）
    startCultureAutoPlay();
}

// 初始化图片显示
function initCultureImages() {
    const images = document.querySelectorAll('.culture-image');
    console.log('初始化图片显示，找到图片数量:', images.length);
    
    if (images.length > 0) {
        // 确保第一张图片是活动状态
        images.forEach((img, index) => {
            if (index === 0) {
                img.classList.add('active');
                console.log('设置第一张图片为活动状态');
            } else {
                img.classList.remove('active');
            }
        });
        currentCultureImageIndex = 0;
        console.log('图片初始化完成，当前索引:', currentCultureImageIndex);
    } else {
        console.warn('没有找到任何图片元素进行初始化');
    }
}

// 启动自动播放
function startCultureAutoPlay() {
    stopCultureAutoPlay(); // 清除现有定时器
    const images = document.querySelectorAll('.culture-image');
    if (images.length > 1) {
        cultureAutoPlayInterval = setInterval(() => {
            changeCultureImage(1);
        }, cultureAutoPlayDelay);
        console.log('教育中心图片自动播放已启动');
    }
}

// 停止自动播放
function stopCultureAutoPlay() {
    if (cultureAutoPlayInterval) {
        clearInterval(cultureAutoPlayInterval);
        cultureAutoPlayInterval = null;
        console.log('教育中心图片自动播放已停止');
    }
}

// 确保函数在全局作用域中可用
window.changeCultureImage = changeCultureImage;
window.initCultureImages = initCultureImages;
window.startCultureAutoPlay = startCultureAutoPlay;
window.stopCultureAutoPlay = stopCultureAutoPlay;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，初始化教育中心图片');
    
    // 检查按钮是否存在
    const prevBtn = document.querySelector('.image-btn.prev-btn');
    const nextBtn = document.querySelector('.image-btn.next-btn');
    console.log('找到上一张按钮:', !!prevBtn);
    console.log('找到下一张按钮:', !!nextBtn);
    
    // 检查函数是否在全局作用域
    console.log('changeCultureImage函数类型:', typeof changeCultureImage);
    console.log('window.changeCultureImage函数类型:', typeof window.changeCultureImage);
    
    // 强制重新绑定按钮事件（覆盖HTML中的onclick）
    if (prevBtn) {
        prevBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('JavaScript事件：上一张按钮被点击');
            changeCultureImage(-1);
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('JavaScript事件：下一张按钮被点击');
            changeCultureImage(1);
        });
    }
    
    // 初始化图片显示
    initCultureImages();
    
    // 启动自动播放
    startCultureAutoPlay();
    
    // 添加鼠标悬停暂停自动播放
    const cultureContainer = document.querySelector('.culture-images');
    if (cultureContainer) {
        cultureContainer.addEventListener('mouseenter', stopCultureAutoPlay);
        cultureContainer.addEventListener('mouseleave', startCultureAutoPlay);
    }
    
    // 添加键盘支持
    document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft') {
            changeCultureImage(-1);
        } else if (e.key === 'ArrowRight') {
            changeCultureImage(1);
        }
    });
    
    // 添加触摸滑动支持（移动端）
    let touchStartX = 0;
    let touchEndX = 0;
    
    // 复用之前已声明的cultureContainer变量
    if (cultureContainer) {
        cultureContainer.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        });
        
        cultureContainer.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        });
    }
    
    function handleSwipe() {
        const swipeThreshold = 50; // 最小滑动距离
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // 向左滑动，显示下一张
                changeCultureImage(1);
            } else {
                // 向右滑动，显示上一张
                changeCultureImage(-1);
            }
        }
    }
});