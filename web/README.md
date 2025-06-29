# 西安顶峰国际教育中心官网

一个现代化的教育机构官网，提供留学咨询、课程介绍和在线报名功能。

## 🚀 功能特性

### 前端功能
- 📱 响应式设计，支持移动端和桌面端
- 🎨 现代化UI界面，流畅的动画效果
- 📋 智能表单验证，实时错误提示
- 🔍 课程搜索和筛选功能
- 📊 数据可视化展示
- 🌐 多语言支持准备

### 后端功能
- 🛡️ 完整的安全防护（Helmet、速率限制、输入验证）
- 📝 报名信息管理系统
- 💬 联系表单处理
- 📁 文件上传功能
- 📊 数据统计和分析
- 🔐 管理员认证系统
- 📈 性能监控
- 💾 自动数据备份
- 📋 结构化日志记录

## 🛠️ 技术栈

### 前端
- HTML5 + CSS3 + JavaScript (ES6+)
- 响应式设计 (Flexbox + Grid)
- Chart.js (数据可视化)
- 原生JavaScript (无框架依赖)

### 后端
- Node.js + Express.js
- 文件系统数据存储 (JSON)
- Multer (文件上传)
- 安全中间件套件

### 安全特性
- Helmet (安全头设置)
- Express Rate Limit (速率限制)
- Validator (输入验证)
- CORS (跨域资源共享)
- 文件类型验证

### 运维工具
- PM2 (进程管理)
- 结构化日志系统
- 自动备份机制
- 性能监控
- 健康检查接口

## 📦 安装和运行

### 环境要求
- Node.js >= 14.0.0
- npm >= 6.0.0

### 快速开始

1. **克隆项目**
```bash
git clone <repository-url>
cd 西安顶峰国际教育中心/web
```

2. **安装依赖**
```bash
npm install
```

3. **环境配置**
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env
```

4. **启动开发服务器**
```bash
npm start
```

5. **访问应用**
- 网站首页: http://localhost:3000
- 管理后台: http://localhost:3000/admin
- 健康检查: http://localhost:3000/health

### 生产环境部署

1. **安装PM2**
```bash
npm install -g pm2
```

2. **启动生产服务**
```bash
pm2 start ecosystem.config.js --env production
```

3. **查看服务状态**
```bash
pm2 status
pm2 logs dingfeng-education
pm2 monit
```

## 📁 项目结构

```
web/
├── admin/                  # 管理后台
│   ├── api.js             # 后台API路由
│   ├── index.html         # 管理界面
│   ├── css/               # 后台样式
│   └── js/                # 后台脚本
├── config/                # 配置文件
│   └── security.js        # 安全配置
├── css/                   # 前端样式
├── data/                  # 数据存储
│   ├── registrations.json # 报名数据
│   └── contacts.json      # 联系数据
├── js/                    # 前端脚本
├── uploads/               # 上传文件
├── utils/                 # 工具模块
│   ├── logger.js          # 日志系统
│   ├── backup.js          # 备份管理
│   └── monitor.js         # 性能监控
├── logs/                  # 日志文件
├── backups/               # 备份文件
├── server.js              # 主服务器
├── ecosystem.config.js    # PM2配置
├── package.json           # 项目配置
└── .env.example           # 环境变量模板
```

## 🔧 配置说明

### 环境变量

```env
# 服务器配置
PORT=3000
NODE_ENV=production

# 管理员认证
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password

# 安全配置
SESSION_SECRET=your_session_secret
JWT_SECRET=your_jwt_secret

# 速率限制
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
FORM_RATE_LIMIT_WINDOW_MS=300000
FORM_RATE_LIMIT_MAX_REQUESTS=5

# 文件上传
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf
```

### PM2 配置

`ecosystem.config.js` 文件包含了生产环境的完整配置：
- 集群模式运行
- 自动重启策略
- 日志管理
- 内存限制
- 环境变量加载

## 📊 API 接口

### 公开接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/register` | 提交报名申请 |
| POST | `/api/contact` | 提交联系表单 |
| GET | `/health` | 健康检查 |

### 管理接口 (需要认证)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/registrations` | 获取报名列表 |
| DELETE | `/api/registrations/:id` | 删除报名记录 |
| GET | `/api/contacts` | 获取联系列表 |
| DELETE | `/api/contacts/:id` | 删除联系记录 |
| GET | `/api/stats` | 获取统计数据 |
| GET | `/api/export` | 导出数据 |
| GET | `/metrics` | 性能指标 |
| POST | `/api/backup` | 创建备份 |
| GET | `/api/backups` | 获取备份列表 |

## 🔒 安全特性

### 输入验证
- 所有表单输入都经过严格验证
- 防止XSS和SQL注入攻击
- 文件上传类型和大小限制

### 速率限制
- 全局请求限制：15分钟内100次
- 表单提交限制：5分钟内5次
- 可通过环境变量调整

### 安全头设置
- Content Security Policy
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options
- X-Content-Type-Options

## 📈 监控和日志

### 日志系统
- 结构化JSON日志
- 按级别分类 (info, warn, error, access)
- 自动日志轮转和清理
- 日志文件位置：`./logs/`

### 性能监控
- 请求响应时间统计
- 系统资源使用监控
- 错误率统计
- 健康检查接口

### 备份系统
- 每日自动备份
- 保留最近30个备份
- 支持手动备份
- 备份文件位置：`./backups/`

## 🚀 性能优化

### 前端优化
- 响应压缩 (gzip)
- 静态资源缓存
- 图片懒加载
- 防抖处理

### 后端优化
- 请求缓存
- 数据库查询优化
- 内存使用监控
- 进程集群模式

## 🐛 故障排除

### 常见问题

1. **端口被占用**
```bash
# 查找占用端口的进程
netstat -ano | findstr :3000
# 杀死进程
taskkill /PID <PID> /F
```

2. **权限问题**
```bash
# 确保有写入权限
chmod 755 data/ uploads/ logs/ backups/
```

3. **依赖安装失败**
```bash
# 清理缓存重新安装
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### 日志查看

```bash
# 查看应用日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log

# 查看访问日志
tail -f logs/access.log

# PM2 日志
pm2 logs dingfeng-education
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系方式

- 项目维护者：西安顶峰国际教育中心
- 邮箱：contact@dingfeng-edu.com
- 网站：https://www.dingfeng-edu.com

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户。

---

**注意**: 在生产环境中部署前，请确保：
1. 修改默认的管理员密码
2. 设置强密码的会话密钥
3. 配置适当的防火墙规则
4. 启用HTTPS
5. 定期更新依赖包

## 项目简介

这是西安顶峰国际教育中心的官方网站，专注于提供新加坡和马来西亚的留学服务。网站采用响应式设计，支持PC端和移动端访问。

## 项目结构

```
web/
├── index.html              # 首页
├── singapore.html          # 新加坡留学页面
├── malaysia.html           # 马来西亚留学页面
├── css/
│   ├── style.css          # 主要样式文件
│   └── country-page.css   # 国家页面专用样式
├── js/
│   ├── carousel.js        # 轮播图功能
│   └── tabs.js           # 标签页切换功能
├── components/
│   └── navigation/
│       ├── nav.css       # 导航组件样式
│       └── nav.js        # 导航组件脚本
├── images/               # 图片文件夹（需要添加图片）
└── README.md            # 项目说明文档
```

## 功能特性

### 首页功能
- 响应式轮播图展示
- 服务项目介绍
- 热门留学目的地展示
- 联系信息展示

### 国家页面功能
- 留学概况介绍
- 热门院校推荐
- 申请要求（本科/研究生切换）
- 费用信息
- 马来西亚页面包含双联课程介绍

### 通用功能
- 可复用的导航组件
- 平滑滚动效果
- 移动端适配
- 返回顶部按钮
- 滚动动画效果

## 需要添加的图片

请将以下图片添加到 `images/` 文件夹中：

### 轮播图图片（首页）
- `slide1.jpg` - 西安顶峰国际教育中心校园环境或办公环境
- `slide2.jpg` - 学生咨询服务场景或一对一咨询照片
- `slide3.jpg` - 成功案例展示或学生毕业照片

### 国家/地区图片
- `singapore.jpg` - 新加坡城市风光或标志性建筑
- `malaysia.jpg` - 马来西亚城市风光或标志性建筑
- `singapore-header.jpg` - 新加坡页面头部背景图
- `malaysia-header.jpg` - 马来西亚页面头部背景图

### 大学Logo图片
#### 新加坡大学
- `psb-logo.jpg` - 新加坡PSB学院Logo
- `curtin-singapore-logo.jpg` - 新加坡科廷大学Logo
- `jcu-singapore-logo.jpg` - 新加坡詹姆斯库克大学Logo
- `sim-logo.jpg` - 新加坡管理学院Logo

#### 马来西亚大学
- `upsi-logo.jpg` - 马来西亚国立师范大学Logo
- `utm-logo.jpg` - 马来西亚理工大学Logo
- `ukm-logo.jpg` - 马来西亚国立大学Logo
- `upm-logo.jpg` - 马来西亚博特拉大学Logo
- `apu-logo.jpg` - 马来西亚亚太科技大学Logo
- `taylor-logo.jpg` - 马来西亚泰来大学Logo
- `inti-logo.jpg` - 马来西亚英迪大学Logo

### 可选图片
- `logo.png` - 西安顶峰国际教育中心Logo（用于导航栏）

## 图片规格建议

- **轮播图片**: 1920x600px，JPG格式，文件大小控制在500KB以内
- **国家页面头部图片**: 1920x400px，JPG格式
- **目的地卡片图片**: 800x300px，JPG格式
- **大学Logo**: 300x150px，JPG或PNG格式
- **网站Logo**: 200x60px，PNG格式（透明背景）

## 使用说明

1. 将所需图片按照上述命名规则放入 `images/` 文件夹
2. 直接在浏览器中打开 `index.html` 即可查看网站
3. 所有页面都会自动加载导航组件，实现页面间的无缝切换

## 技术特点

- **纯前端实现**: 使用HTML5、CSS3、JavaScript
- **响应式设计**: 适配各种屏幕尺寸
- **组件化开发**: 导航栏组件可复用
- **现代化UI**: 渐变色彩、阴影效果、动画过渡
- **用户体验优化**: 平滑滚动、加载动画、交互反馈

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- 移动端浏览器

## 后续扩展建议

1. 添加更多留学目的地页面
2. 集成在线咨询功能
3. 添加学生案例展示页面
4. 集成表单提交功能
5. 添加多语言支持
6. 集成SEO优化

---

**联系方式**
- 电话：029-8888-8888
- 邮箱：info@xadingfeng.com
- 地址：西安市雁塔区高新路XX号