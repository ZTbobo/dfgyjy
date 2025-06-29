// 企业文化板块交互功能
class CorporateCulture {
    constructor() {
        this.currentIndex = 0;
        this.features = [
            {
                title: '多元兼容',
                items: [
                    '欣赏个体多样性，聚焦人才优势特质',
                    '全球视野，理解不同文化，观点和共识',
                    '善意包容，默认开放信任，有效合作'
                ]
            },
            {
                title: '创新进取',
                items: [
                    '勇于探索新的教育模式和方法',
                    '持续改进教学质量和服务水平',
                    '积极拥抱变化，适应时代发展'
                ]
            },
            {
                title: '专业卓越',
                items: [
                    '深耕国际教育领域，专业能力突出',
                    '严格把控教学质量，追求卓越标准',
                    '持续学习提升，保持行业领先地位'
                ]
            }
        ];
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.updateContent();
    }
    
    bindEvents() {
        const prevBtn = document.querySelector('.corporate-culture-section .prev-btn');
        const nextBtn = document.querySelector('.corporate-culture-section .next-btn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.previousFeature());
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextFeature());
        }
        
        // 键盘支持
        document.addEventListener('keydown', (e) => {
            if (this.isInViewport()) {
                if (e.key === 'ArrowLeft') {
                    this.previousFeature();
                } else if (e.key === 'ArrowRight') {
                    this.nextFeature();
                }
            }
        });
        
        // 自动轮播（可选）
        this.startAutoPlay();
    }
    
    previousFeature() {
        this.currentIndex = (this.currentIndex - 1 + this.features.length) % this.features.length;
        this.updateContent();
    }
    
    nextFeature() {
        this.currentIndex = (this.currentIndex + 1) % this.features.length;
        this.updateContent();
    }
    
    updateContent() {
        const titleElement = document.querySelector('.feature-title');
        const featuresList = document.querySelector('.features-list');
        
        if (!titleElement || !featuresList) return;
        
        const currentFeature = this.features[this.currentIndex];
        
        // 添加淡出效果
        titleElement.style.opacity = '0';
        featuresList.style.opacity = '0';
        
        setTimeout(() => {
            // 更新标题
            titleElement.textContent = currentFeature.title;
            
            // 更新特点列表
            featuresList.innerHTML = currentFeature.items.map(item => `
                <div class="feature-item">
                    <span class="feature-bullet">•</span>
                    <span class="feature-text">${item}</span>
                </div>
            `).join('');
            
            // 添加淡入效果
            titleElement.style.opacity = '1';
            featuresList.style.opacity = '1';
        }, 150);
    }
    
    isInViewport() {
        const section = document.querySelector('.corporate-culture-section');
        if (!section) return false;
        
        const rect = section.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
    }
    
    startAutoPlay() {
        // 每8秒自动切换（可选功能）
        setInterval(() => {
            if (this.isInViewport()) {
                this.nextFeature();
            }
        }, 8000);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new CorporateCulture();
});

// 导出类以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CorporateCulture;
}