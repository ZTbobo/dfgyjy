const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const compression = require('compression');

// 加载环境变量
require('dotenv').config();

// 加载工具模块
const logger = require('./utils/logger');
const backupManager = require('./utils/backup');
const { monitor, performanceMiddleware } = require('./utils/monitor');
const { authManager, requireAuth, requireRole } = require('./utils/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// 启用响应压缩
app.use(compression());

// 性能监控中间件
app.use(performanceMiddleware);

// 安全中间件
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:"],
            fontSrc: ["'self'"]
        }
    }
}));

// 速率限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 1000, // 限制每个IP 1000次请求
    message: { success: false, message: '请求过于频繁，请稍后再试' }
});
app.use(limiter);

// 表单提交限制
const formLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5分钟
    max: 5, // 限制每个IP 5次表单提交
    message: { success: false, message: '提交过于频繁，请稍后再试' }
});

// 中间件配置
app.use(express.static(path.join(__dirname)));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 输入清理函数
function sanitizeInput(data) {
    if (typeof data === 'string') {
        return validator.escape(data.trim());
    } else if (typeof data === 'object' && data !== null) {
        const sanitized = {};
        for (const key in data) {
            sanitized[key] = sanitizeInput(data[key]);
        }
        return sanitized;
    }
    return data;
}

// 验证函数
function validateRegistrationData(data) {
    const errors = [];
    
    if (!data.name || data.name.length < 2) {
        errors.push('姓名至少需要2个字符');
    }
    
    if (!data.phone || !validator.isMobilePhone(data.phone, 'zh-CN')) {
        errors.push('请输入有效的手机号码');
    }
    
    if (data.email && !validator.isEmail(data.email)) {
        errors.push('请输入有效的邮箱地址');
    }
    
    return errors;
}

// 配置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// 确保数据目录存在
const dataDir = './data';
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 处理报名表单提交
app.post('/submit-registration', formLimiter, upload.single('id_photo'), (req, res) => {
    try {
        // 清理输入数据
        const cleanData = sanitizeInput(req.body);
        
        // 验证数据
        const validationErrors = validateRegistrationData(cleanData);
        if (validationErrors.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: '数据验证失败', 
                errors: validationErrors 
            });
        }
        
        const formData = {
            id: Date.now(), // 使用时间戳作为唯一ID
            submitTime: new Date().toISOString(),
            ...cleanData,
            ip: req.ip || req.connection.remoteAddress // 记录IP地址
        };
        
        // 如果有上传的照片，保存文件路径
        if (req.file) {
            // 验证文件类型
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
            if (!allowedTypes.includes(req.file.mimetype)) {
                fs.unlinkSync(req.file.path); // 删除不合法文件
                return res.status(400).json({ 
                    success: false, 
                    message: '只允许上传 JPG、JPEG、PNG 格式的图片' 
                });
            }
            
            formData.id_photo_path = req.file.path;
            formData.id_photo_filename = req.file.filename;
        }
        
        // 保存到JSON文件
        const dataFile = path.join(dataDir, 'registrations.json');
        let registrations = [];
        
        if (fs.existsSync(dataFile)) {
            const existingData = fs.readFileSync(dataFile, 'utf8');
            registrations = JSON.parse(existingData);
        }
        
        registrations.push(formData);
        fs.writeFileSync(dataFile, JSON.stringify(registrations, null, 2));
        
        logger.info('新的报名申请', {
            name: formData.name,
            id: formData.id,
            ip: formData.ip,
            country: formData.country
        });
        
        res.json({ success: true, message: '报名申请提交成功', id: formData.id });
    } catch (error) {
        logger.error('处理报名申请时出错', error);
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 检查系统初始化状态API
app.get('/api/check-initialization', (req, res) => {
    try {
        const initialized = authManager.isInitialized();
        res.json({ 
            success: true, 
            initialized 
        });
    } catch (error) {
        logger.error('检查初始化状态API错误', { error: error.message, ip: req.ip });
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 系统初始化设置API
app.post('/api/setup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // 检查是否已经初始化
        if (authManager.isInitialized()) {
            return res.status(400).json({ 
                success: false, 
                message: '系统已经初始化，无法重复设置' 
            });
        }
        
        if (!username || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: '用户名、邮箱和密码不能为空' 
            });
        }
        
        const result = await authManager.createInitialUser(username, email, password);
        
        if (result.success) {
            logger.info('系统初始化成功', { 
                username, 
                email, 
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            res.json(result);
        } else {
            logger.warn('系统初始化失败', { 
                username, 
                email, 
                ip: req.ip, 
                reason: result.message 
            });
            res.status(400).json(result);
        }
    } catch (error) {
        logger.error('系统初始化API错误', { error: error.message, ip: req.ip });
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 登录API
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, rememberMe } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: '用户名和密码不能为空' 
            });
        }
        
        const result = await authManager.login(username, password, rememberMe);
        
        if (result.success) {
            logger.info('用户登录成功', { username, ip: req.ip });
            res.json(result);
        } else {
            logger.warn('用户登录失败', { username, ip: req.ip, reason: result.message });
            res.status(401).json(result);
        }
    } catch (error) {
        logger.error('登录API错误', { error: error.message, ip: req.ip });
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 验证token API
app.post('/api/verify-token', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: '无效的token格式' });
        }
        
        const token = authHeader.substring(7);
        const result = authManager.verifyToken(token);
        
        res.json(result);
    } catch (error) {
        logger.error('Token验证API错误', { error: error.message, ip: req.ip });
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 登出API
app.post('/api/logout', requireAuth, (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader.substring(7);
        
        const result = authManager.logout(token);
        
        logger.info('用户登出', { username: req.user.username, ip: req.ip });
        res.json(result);
    } catch (error) {
        logger.error('登出API错误', { error: error.message, ip: req.ip });
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 修改密码API
app.post('/api/change-password', requireAuth, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ 
                success: false, 
                message: '原密码和新密码不能为空' 
            });
        }
        
        const result = await authManager.changePassword(req.user.id, oldPassword, newPassword);
        
        if (result.success) {
            logger.info('用户修改密码成功', { username: req.user.username, ip: req.ip });
        } else {
            logger.warn('用户修改密码失败', { username: req.user.username, ip: req.ip, reason: result.message });
        }
        
        res.json(result);
    } catch (error) {
        logger.error('修改密码API错误', { error: error.message, ip: req.ip });
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 管理后台登录页面
// 系统设置页面
app.get('/admin/setup', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'setup.html'));
});

app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

// 管理后台主页面（需要认证）
app.get('/admin', (req, res) => {
    // 检查系统是否已初始化
    if (!authManager.isInitialized()) {
        return res.redirect('/admin/setup');
    }
    
    // 检查认证状态
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.redirect('/admin/login');
    }
    
    const token = authHeader.substring(7);
    const result = authManager.verifyToken(token);
    
    if (!result.success) {
        return res.redirect('/admin/login');
    }
    
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// 管理后台静态文件
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// 重定向未认证的管理后台访问到登录页面
app.get('/admin/*', (req, res, next) => {
    // 检查是否是静态文件请求
    if (req.path.includes('.')) {
        return next();
    }
    
    // 检查认证状态
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.redirect('/admin/login');
    }
    
    const token = authHeader.substring(7);
    const result = authManager.verifyToken(token);
    
    if (!result.success) {
        return res.redirect('/admin/login');
    }
    
    next();
});

// 原始管理页面（保留作为备用）
app.get('/admin/legacy', requireAuth, (req, res) => {
    const adminHTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>报名信息管理 - 西安顶峰国际教育中心</title>
    <style>
        body {
            font-family: 'Microsoft YaHei', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            min-height: 100vh;
        }
        
        .admin-container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .admin-header {
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .admin-header h1 {
            margin: 0;
            font-size: 2.5rem;
            font-weight: 700;
        }
        
        .tabs {
            display: flex;
            background: #f8fafc;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .tab {
            padding: 15px 30px;
            cursor: pointer;
            border-bottom: 3px solid transparent;
            transition: all 0.3s ease;
            font-weight: 500;
        }
        
        .tab.active {
            background: white;
            border-bottom-color: #3b82f6;
            color: #3b82f6;
        }
        
        .tab:hover {
            background: #e5e7eb;
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8fafc;
        }
        
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
        }
        
        .stat-number {
            font-size: 2rem;
            font-weight: 700;
            color: #3b82f6;
            margin-bottom: 5px;
        }
        
        .stat-label {
            color: #6b7280;
            font-weight: 500;
        }
        
        .controls {
            padding: 20px 30px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .search-box {
            padding: 10px 15px;
            border: 2px solid #d1d5db;
            border-radius: 8px;
            font-size: 1rem;
            width: 300px;
            max-width: 100%;
        }
        
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
        }
        
        .btn-primary {
            background: #3b82f6;
            color: white;
        }
        
        .btn-primary:hover {
            background: #2563eb;
            transform: translateY(-2px);
        }
        
        .btn-success {
            background: #10b981;
            color: white;
        }
        
        .btn-success:hover {
            background: #059669;
        }
        
        .table-container {
            overflow-x: auto;
            padding: 0 30px 30px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
        }
        
        th, td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        
        th {
            background: #f8fafc;
            font-weight: 600;
            color: #374151;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        
        tr:hover {
            background: #f8fafc;
        }
        
        .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
        }
        
        .status-new {
            background: #dbeafe;
            color: #1d4ed8;
        }
        
        .action-btn {
            padding: 6px 12px;
            font-size: 0.85rem;
            margin: 0 2px;
        }
        
        .no-data {
            text-align: center;
            padding: 60px 20px;
            color: #6b7280;
            font-size: 1.1rem;
        }
        
        .detail-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
        }
        
        .modal-content {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 15px;
            padding: 30px;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            width: 90%;
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e5e7eb;
        }
        
        .close-btn {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #6b7280;
        }
        
        .detail-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
        }
        
        .detail-item {
            padding: 15px;
            background: #f8fafc;
            border-radius: 8px;
        }
        
        .detail-label {
            font-weight: 600;
            color: #374151;
            margin-bottom: 5px;
        }
        
        .detail-value {
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class="admin-container">
        <div class="admin-header">
            <h1>报名信息管理系统</h1>
            <p>西安顶峰国际教育中心</p>
        </div>
        
        <div class="tabs">
            <div class="tab active" onclick="switchTab('registrations')">报名数据</div>
            <div class="tab" onclick="switchTab('contacts')">联系数据</div>
        </div>
        
        <!-- 报名数据标签页 -->
        <div class="tab-content active" id="registrations-content">
        <div class="stats" id="stats">
            <div class="stat-card">
                <div class="stat-number" id="totalCount">0</div>
                <div class="stat-label">总报名人数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="todayCount">0</div>
                <div class="stat-label">今日新增</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="weekCount">0</div>
                <div class="stat-label">本周新增</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="monthCount">0</div>
                <div class="stat-label">本月新增</div>
            </div>
        </div>
        
        <div class="controls">
            <input type="text" class="search-box" id="searchBox" placeholder="搜索姓名、电话、邮箱...">
            <div>
                <button class="btn btn-success" onclick="exportData()">导出Excel</button>
                <button class="btn btn-primary" onclick="refreshData()">刷新数据</button>
            </div>
        </div>
        
        <div class="table-container">
            <table id="dataTable">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>提交时间</th>
                        <th>姓名</th>
                        <th>性别</th>
                        <th>电话</th>
                        <th>邮箱</th>
                        <th>报名项目</th>
                        <th>就读学校</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody id="tableBody">
                </tbody>
            </table>
        </div>
        </div>
        
        <!-- 联系数据标签页 -->
        <div class="tab-content" id="contacts-content">
        <div class="stats" id="contactStats">
            <div class="stat-card">
                <div class="stat-number" id="totalContactCount">0</div>
                <div class="stat-label">总联系人数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="todayContactCount">0</div>
                <div class="stat-label">今日新增</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="weekContactCount">0</div>
                <div class="stat-label">本周新增</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="monthContactCount">0</div>
                <div class="stat-label">本月新增</div>
            </div>
        </div>
        
        <div class="controls">
            <input type="text" class="search-box" id="contactSearchBox" placeholder="搜索姓名、电话...">
            <div>
                <button class="btn btn-success" onclick="exportContactData()">导出Excel</button>
                <button class="btn btn-primary" onclick="refreshContactData()">刷新数据</button>
            </div>
        </div>
        
        <div class="table-container">
            <table id="contactTable">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>提交时间</th>
                        <th>姓名</th>
                        <th>电话</th>
                        <th>留言</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody id="contactTableBody">
                </tbody>
            </table>
        </div>
        </div>
    </div>
    
    <!-- 详情模态框 -->
    <div class="detail-modal" id="detailModal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>报名详情</h2>
                <button class="close-btn" onclick="closeModal()">&times;</button>
            </div>
            <div id="detailContent"></div>
        </div>
    </div>
    
    <script>
        let allData = [];
        
        // 加载数据
        async function loadData() {
            try {
                console.log('开始加载数据...');
                const response = await fetch('/api/registrations');
                console.log('API响应状态:', response.status);
                allData = await response.json();
                console.log('获取到数据:', allData.length, '条记录');
                updateStats();
                renderTable(allData);
                console.log('数据加载完成');
            } catch (error) {
                console.error('加载数据失败:', error);
            }
        }
        
        // 更新统计信息
        function updateStats() {
            const now = new Date();
            const today = now.toDateString();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            
            console.log('开始更新统计信息，总数据:', allData.length);
            
            const todayCount = allData.filter(item => {
                let itemDate;
                // 处理不同的时间格式
                if (item.submitTime) {
                    // 如果是中文格式的时间字符串，直接解析
                    if (item.submitTime.includes('/') || item.submitTime.includes('-')) {
                        itemDate = new Date(item.submitTime);
                    } else {
                        // 如果是ISO格式，先转换
                        itemDate = new Date(item.submitTime);
                    }
                } else if (item.timestamp) {
                    itemDate = new Date(item.timestamp);
                } else {
                    return false;
                }
                
                const isToday = itemDate.toDateString() === today;
                if (isToday) {
                    console.log('今日记录:', item.name, item.submitTime);
                }
                return isToday;
            }).length;
            
            const weekCount = allData.filter(item => {
                let itemDate;
                if (item.submitTime) {
                    itemDate = new Date(item.submitTime);
                } else if (item.timestamp) {
                    itemDate = new Date(item.timestamp);
                } else {
                    return false;
                }
                return itemDate >= weekAgo;
            }).length;
            
            const monthCount = allData.filter(item => {
                let itemDate;
                if (item.submitTime) {
                    itemDate = new Date(item.submitTime);
                } else if (item.timestamp) {
                    itemDate = new Date(item.timestamp);
                } else {
                    return false;
                }
                return itemDate >= monthAgo;
            }).length;
            
            console.log('统计结果 - 总计:', allData.length, '今日:', todayCount, '本周:', weekCount, '本月:', monthCount);
            
            document.getElementById('totalCount').textContent = allData.length;
            document.getElementById('todayCount').textContent = todayCount;
            document.getElementById('weekCount').textContent = weekCount;
            document.getElementById('monthCount').textContent = monthCount;
        }
        
        // 渲染表格
        function renderTable(data) {
            const tbody = document.getElementById('tableBody');
            
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" class="no-data">暂无报名数据</td></tr>';
                return;
            }
            
            tbody.innerHTML = data.map(item => \`
                <tr>
                    <td>\${item.id}</td>
                    <td>\${new Date(item.submitTime).toLocaleString('zh-CN')}</td>
                    <td>\${item.name || '-'}</td>
                    <td>\${item.gender || '-'}</td>
                    <td>\${item.phone || '-'}</td>
                    <td>\${item.email || '-'}</td>
                    <td>\${item.projects || '-'}</td>
                    <td>\${item.current_school || '-'}</td>
                    <td>
                        <button class="btn btn-primary action-btn" onclick="viewDetail(\${item.id})">查看详情</button>
                        <button class="btn btn-danger action-btn" onclick="deleteRecord(\${item.id})">删除</button>
                    </td>
                </tr>
            \`).join('');
        }
        
        // 搜索功能
        document.getElementById('searchBox').addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const filteredData = allData.filter(item => 
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                (item.phone && item.phone.includes(searchTerm)) ||
                (item.email && item.email.toLowerCase().includes(searchTerm))
            );
            renderTable(filteredData);
        });
        
        // 查看详情
        window.viewDetail = function(id) {
            const item = allData.find(data => data.id === id);
            if (!item) return;
            
            const detailContent = document.getElementById('detailContent');
            detailContent.innerHTML = \`
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">提交时间</div>
                        <div class="detail-value">\${new Date(item.submitTime).toLocaleString('zh-CN')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">报名项目</div>
                        <div class="detail-value">\${item.projects || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">姓名</div>
                        <div class="detail-value">\${item.name || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">性别</div>
                        <div class="detail-value">\${item.gender || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">民族</div>
                        <div class="detail-value">\${item.ethnicity || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">电话</div>
                        <div class="detail-value">\${item.phone || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">邮箱</div>
                        <div class="detail-value">\${item.email || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">身份证号</div>
                        <div class="detail-value">\${item.id_number || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">户籍所在地</div>
                        <div class="detail-value">\${(item.province || '') + ' ' + (item.city || '')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">政治面貌</div>
                        <div class="detail-value">\${item.political_status || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">家庭地址</div>
                        <div class="detail-value">\${item.home_address || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">就读学校</div>
                        <div class="detail-value">\${item.current_school || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">毕业时间</div>
                        <div class="detail-value">\${item.graduation_time || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">学历</div>
                        <div class="detail-value">\${item.education_level || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">是否有毕业证</div>
                        <div class="detail-value">\${item.diploma || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">高考成绩</div>
                        <div class="detail-value">\${item.gaokao_score || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">英语成绩</div>
                        <div class="detail-value">\${item.english_score || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">意向国家</div>
                        <div class="detail-value">\${item.target_country || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">意向专业</div>
                        <div class="detail-value">\${item.target_major || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">父亲姓名</div>
                        <div class="detail-value">\${item.father_name || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">父亲电话</div>
                        <div class="detail-value">\${item.father_phone || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">母亲姓名</div>
                        <div class="detail-value">\${item.mother_name || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">母亲电话</div>
                        <div class="detail-value">\${item.mother_phone || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">其他联系电话</div>
                        <div class="detail-value">\${item.emergency_contact || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">过敏史/病史</div>
                        <div class="detail-value">\${item.medical_history || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">特别声明</div>
                        <div class="detail-value">\${item.special_note || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">申请人签名</div>
                        <div class="detail-value">\${item.applicant_signature || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">申请日期</div>
                        <div class="detail-value">\${item.application_date || '-'}</div>
                    </div>
                </div>
            \`;
            
            document.getElementById('detailModal').style.display = 'block';
        };
        
        // 关闭模态框
        window.closeModal = function() {
            document.getElementById('detailModal').style.display = 'none';
        };
        
        // 删除记录
        window.deleteRecord = async function(id) {
            if (!confirm('确定要删除这条记录吗？此操作不可恢复！')) {
                return;
            }
            
            try {
                const response = await fetch(\`/api/registrations/\${id}\`, {
                    method: 'DELETE'
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('删除成功！');
                    loadData(); // 重新加载数据
                } else {
                    alert('删除失败：' + result.message);
                }
            } catch (error) {
                console.error('删除记录时出错:', error);
                alert('删除失败，请稍后重试');
            }
        };
        
        // 刷新数据
        window.refreshData = function() {
            console.log('刷新数据按钮被点击');
            loadData();
        };
        
        // 导出数据
        window.exportData = function() {
            if (allData.length === 0) {
                alert('暂无数据可导出');
                return;
            }
            
            // 创建CSV内容
            const headers = ['ID', '提交时间', '姓名', '性别', '民族', '电话', '邮箱', '身份证号', '户籍省份', '户籍城市', '政治面貌', '家庭地址', '报名项目', '就读学校', '毕业时间', '学历', '是否有毕业证', '高考成绩', '英语成绩', '意向国家', '意向专业', '父亲姓名', '父亲电话', '母亲姓名', '母亲电话', '其他联系电话', '过敏史/病史', '特别声明', '申请人签名', '申请日期'];
            
            const csvContent = [headers.join(',')];
            
            allData.forEach(item => {
                const row = [
                    item.id || '',
                    new Date(item.submitTime).toLocaleString('zh-CN') || '',
                    item.name || '',
                    item.gender || '',
                    item.ethnicity || '',
                    item.phone || '',
                    item.email || '',
                    item.id_number || '',
                    item.province || '',
                    item.city || '',
                    item.political_status || '',
                    item.home_address || '',
                    item.projects || '',
                    item.current_school || '',
                    item.graduation_time || '',
                    item.education_level || '',
                    item.diploma || '',
                    item.gaokao_score || '',
                    item.english_score || '',
                    item.target_country || '',
                    item.target_major || '',
                    item.father_name || '',
                    item.father_phone || '',
                    item.mother_name || '',
                    item.mother_phone || '',
                    item.emergency_contact || '',
                    item.medical_history || '',
                    item.special_note || '',
                    item.applicant_signature || '',
                    item.application_date || ''
                ].map(field => '\"' + field.toString().replace(/\"/g, '\"\"') + '\"'); // 处理CSV中的引号
                
                csvContent.push(row.join(','));
            });
            
            // 下载文件
            const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', '报名数据_' + new Date().toISOString().split('T')[0] + '.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        
        // 点击模态框外部关闭
        document.getElementById('detailModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
        
        // 标签页切换
        let allContactData = [];
        
        function switchTab(tabName) {
            // 移除所有活动状态
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            // 激活选中的标签页
            event.target.classList.add('active');
            document.getElementById(tabName + '-content').classList.add('active');
            
            // 加载对应数据
            if (tabName === 'contacts') {
                loadContactData();
            } else {
                loadData();
            }
        }
        
        // 加载联系数据
        async function loadContactData() {
            try {
                console.log('开始加载联系数据...');
                const response = await fetch('/api/contacts');
                console.log('联系API响应状态:', response.status);
                allContactData = await response.json();
                console.log('获取到联系数据:', allContactData.length, '条记录');
                updateContactStats();
                renderContactTable(allContactData);
                console.log('联系数据加载完成');
            } catch (error) {
                console.error('加载联系数据失败:', error);
            }
        }
        
        // 更新联系统计信息
        function updateContactStats() {
            const now = new Date();
            const today = now.toDateString();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            
            const todayCount = allContactData.filter(item => 
                new Date(item.submitTime).toDateString() === today
            ).length;
            
            const weekCount = allContactData.filter(item => 
                new Date(item.submitTime) >= weekAgo
            ).length;
            
            const monthCount = allContactData.filter(item => 
                new Date(item.submitTime) >= monthAgo
            ).length;
            
            document.getElementById('totalContactCount').textContent = allContactData.length;
            document.getElementById('todayContactCount').textContent = todayCount;
            document.getElementById('weekContactCount').textContent = weekCount;
            document.getElementById('monthContactCount').textContent = monthCount;
        }
        
        // 渲染联系表格
        function renderContactTable(data) {
            const tbody = document.getElementById('contactTableBody');
            
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="no-data">暂无联系数据</td></tr>';
                return;
            }
            
            tbody.innerHTML = data.map(item => \`
                <tr>
                    <td>\${item.id}</td>
                    <td>\${new Date(item.submitTime).toLocaleString('zh-CN')}</td>
                    <td>\${item.name || '-'}</td>
                    <td>\${item.phone || '-'}</td>
                    <td>\${item.message ? (item.message.length > 20 ? item.message.substring(0, 20) + '...' : item.message) : '-'}</td>
                    <td>
                         <button class="btn btn-primary action-btn" onclick="viewContactDetail(\${item.id})">查看详情</button>
                         <button class="btn btn-danger action-btn" onclick="deleteContactRecord(\${item.id})">删除</button>
                     </td>
                </tr>
            \`).join('');
        }
        
        // 查看联系详情
        window.viewContactDetail = function(id) {
            const item = allContactData.find(data => data.id === id);
            if (!item) return;
            
            const detailContent = document.getElementById('detailContent');
            detailContent.innerHTML = \`
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">提交时间</div>
                        <div class="detail-value">\${new Date(item.submitTime).toLocaleString('zh-CN')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">姓名</div>
                        <div class="detail-value">\${item.name || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">电话</div>
                        <div class="detail-value">\${item.phone || '-'}</div>
                    </div>
                    <div class="detail-item" style="grid-column: 1 / -1;">
                        <div class="detail-label">留言内容</div>
                        <div class="detail-value">\${item.message || '-'}</div>
                    </div>
                </div>
            \`;
            
            document.getElementById('detailModal').style.display = 'block';
        };
        
        // 联系数据搜索功能
        document.getElementById('contactSearchBox').addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const filteredData = allContactData.filter(item => 
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                (item.phone && item.phone.includes(searchTerm))
            );
            renderContactTable(filteredData);
        });
        
        // 删除联系记录
        window.deleteContactRecord = async function(id) {
            if (!confirm('确定要删除这条联系记录吗？此操作不可恢复！')) {
                return;
            }
            
            try {
                const response = await fetch(\`/api/contacts/\${id}\`, {
                    method: 'DELETE'
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('删除成功！');
                    loadContactData(); // 重新加载数据
                } else {
                    alert('删除失败：' + result.message);
                }
            } catch (error) {
                console.error('删除联系记录时出错:', error);
                alert('删除失败，请稍后重试');
            }
        };
        
        // 刷新联系数据
        window.refreshContactData = function() {
            loadContactData();
        };
        
        // 导出联系数据
        window.exportContactData = function() {
            if (allContactData.length === 0) {
                alert('没有数据可导出');
                return;
            }
            
            const csvContent = [];
            csvContent.push('ID,提交时间,姓名,电话,留言内容');
            
            allContactData.forEach(item => {
                const row = [
                    item.id || '',
                    new Date(item.submitTime).toLocaleString('zh-CN'),
                    item.name || '',
                    item.phone || '',
                    item.message || ''
                ].map(field => '"' + field.toString().replace(/"/g, '""') + '"');
                
                csvContent.push(row.join(','));
            });
            
            const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', '联系数据_' + new Date().toISOString().split('T')[0] + '.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        
        // 页面加载时获取数据
        document.addEventListener('DOMContentLoaded', function() {
            loadData();
            
            // 每30秒自动刷新一次数据
            setInterval(loadData, 30000);
        });
    </script>
</body>
</html>
    `;
    
    res.send(adminHTML);
});

// 联系表单验证函数
function validateContactData(data) {
    const errors = [];
    
    if (!data.name || data.name.length < 2) {
        errors.push('姓名至少需要2个字符');
    }
    
    if (!data.phone || !validator.isMobilePhone(data.phone, 'zh-CN')) {
        errors.push('请输入有效的手机号码');
    }
    
    if (data.message && data.message.length > 500) {
        errors.push('留言内容不能超过500个字符');
    }
    
    return errors;
}

// API接口：处理联系表单提交
app.post('/api/contact', formLimiter, (req, res) => {
    try {
        // 清理输入数据
        const cleanData = sanitizeInput(req.body);
        
        // 验证数据
        const validationErrors = validateContactData(cleanData);
        if (validationErrors.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: '数据验证失败', 
                errors: validationErrors 
            });
        }
        
        const contactData = {
            id: Date.now(),
            submitTime: new Date().toISOString(),
            ...cleanData,
            ip: req.ip || req.connection.remoteAddress
        };
        
        // 保存到contacts.json文件
        const contactFile = path.join(dataDir, 'contacts.json');
        let contacts = [];
        
        if (fs.existsSync(contactFile)) {
            const existingData = fs.readFileSync(contactFile, 'utf8');
            contacts = JSON.parse(existingData);
        }
        
        contacts.push(contactData);
        fs.writeFileSync(contactFile, JSON.stringify(contacts, null, 2));
        
        logger.info('新的联系请求', {
            name: contactData.name,
            phone: contactData.phone,
            ip: contactData.ip
        });
        
        res.json({ success: true, message: '提交成功，我们会尽快与您联系' });
    } catch (error) {
        logger.error('处理联系表单时出错', error);
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// API接口：获取所有报名数据
app.get('/api/registrations', requireAuth, (req, res) => {
    try {
        const dataFile = path.join(dataDir, 'registrations.json');
        
        if (!fs.existsSync(dataFile)) {
            return res.json([]);
        }
        
        const data = fs.readFileSync(dataFile, 'utf8');
        let registrations = JSON.parse(data);
        
        // 标准化数据格式
        registrations = registrations.map(registration => {
            const standardized = { ...registration };
            
            // 标准化时间格式
            if (registration.submitTime) {
                // 如果submitTime是ISO格式，转换为本地时间字符串
                if (registration.submitTime.includes('T') && registration.submitTime.includes('Z')) {
                    standardized.submitTime = new Date(registration.submitTime).toLocaleString('zh-CN');
                }
            }
            
            return standardized;
        });
        
        // 按提交时间倒序排列
        registrations.sort((a, b) => new Date(b.submitTime) - new Date(a.submitTime));
        
        res.json(registrations);
    } catch (error) {
        logger.error('获取报名数据时出错', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// API接口：获取所有联系数据
app.get('/api/contacts', requireAuth, (req, res) => {
    try {
        const contactFile = path.join(dataDir, 'contacts.json');
        
        if (!fs.existsSync(contactFile)) {
            return res.json([]);
        }
        
        const data = fs.readFileSync(contactFile, 'utf8');
        let contacts = JSON.parse(data);
        
        // 标准化数据格式
        contacts = contacts.map(contact => {
            // 确保所有必要字段存在
            const standardized = {
                id: contact.id,
                name: contact.name || '',
                phone: contact.phone || '',
                message: contact.message || contact.subject || '无留言内容',
                type: contact.type || 'contact'
            };
            
            // 标准化时间格式
            if (contact.submitTime) {
                // 如果submitTime是ISO格式，转换为本地时间字符串
                if (contact.submitTime.includes('T') && contact.submitTime.includes('Z')) {
                    standardized.submitTime = new Date(contact.submitTime).toLocaleString('zh-CN');
                } else {
                    standardized.submitTime = contact.submitTime;
                }
            } else if (contact.timestamp) {
                standardized.submitTime = new Date(contact.timestamp).toLocaleString('zh-CN');
            } else {
                standardized.submitTime = new Date().toLocaleString('zh-CN');
            }
            
            return standardized;
        });
        
        // 按提交时间倒序排列
        contacts.sort((a, b) => new Date(b.submitTime) - new Date(a.submitTime));
        
        res.json(contacts);
    } catch (error) {
        logger.error('获取联系数据时出错', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// API接口：删除报名数据
app.delete('/api/registrations/:id', requireAuth, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const dataFile = path.join(dataDir, 'registrations.json');
        
        if (!fs.existsSync(dataFile)) {
            return res.status(404).json({ success: false, message: '数据文件不存在' });
        }
        
        const data = fs.readFileSync(dataFile, 'utf8');
        let registrations = JSON.parse(data);
        
        const originalLength = registrations.length;
        registrations = registrations.filter(item => item.id !== id);
        
        if (registrations.length === originalLength) {
            return res.status(404).json({ success: false, message: '未找到要删除的记录' });
        }
        
        fs.writeFileSync(dataFile, JSON.stringify(registrations, null, 2));
        
        logger.info('删除报名记录', { id });
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        logger.error('删除报名数据时出错', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// API接口：删除联系数据
app.delete('/api/contacts/:id', requireAuth, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const contactFile = path.join(dataDir, 'contacts.json');
        
        if (!fs.existsSync(contactFile)) {
            return res.status(404).json({ success: false, message: '数据文件不存在' });
        }
        
        const data = fs.readFileSync(contactFile, 'utf8');
        let contacts = JSON.parse(data);
        
        const originalLength = contacts.length;
        contacts = contacts.filter(item => item.id !== id);
        
        if (contacts.length === originalLength) {
            return res.status(404).json({ success: false, message: '未找到要删除的记录' });
        }
        
        fs.writeFileSync(contactFile, JSON.stringify(contacts, null, 2));
        
        logger.info('删除联系记录', { id });
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        logger.error('删除联系数据时出错', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 启动服务器
// 健康检查接口
app.get('/health', (req, res) => {
    const health = monitor.getHealthStatus();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

// 性能指标接口
app.get('/metrics', requireAuth, (req, res) => {
    const metrics = monitor.getCurrentMetrics();
    res.json(metrics);
});

// 备份管理接口
app.post('/api/backup', requireAuth, (req, res) => {
    try {
        const result = backupManager.createBackup();
        if (result.success) {
            logger.info('手动备份创建成功', result);
            res.json({ success: true, message: '备份创建成功', data: result });
        } else {
            res.status(500).json({ success: false, message: result.error });
        }
    } catch (error) {
        logger.error('创建备份失败', error);
        res.status(500).json({ success: false, message: '备份创建失败' });
    }
});

// 获取备份列表接口
app.get('/api/backups', requireAuth, (req, res) => {
    try {
        const backups = backupManager.getBackupList();
        res.json({ success: true, data: backups });
    } catch (error) {
        logger.error('获取备份列表失败', error);
        res.status(500).json({ success: false, message: '获取备份列表失败' });
    }
});

// 搜索报名数据
app.get('/api/search', requireAuth, async (req, res) => {
    try {
        const { q, status, course, limit = 50, offset = 0 } = req.query;
        
        const dataFile = path.join(dataDir, 'registrations.json');
        let registrations = [];
        
        if (fs.existsSync(dataFile)) {
            const data = fs.readFileSync(dataFile, 'utf8');
            registrations = JSON.parse(data);
        }
        
        // 搜索过滤
        if (q) {
            const searchTerm = q.toLowerCase();
            registrations = registrations.filter(reg => 
                (reg.name && reg.name.toLowerCase().includes(searchTerm)) ||
                (reg.phone && reg.phone.includes(searchTerm)) ||
                (reg.email && reg.email.toLowerCase().includes(searchTerm)) ||
                (reg.course && reg.course.toLowerCase().includes(searchTerm))
            );
        }
        
        // 状态过滤
        if (status && status !== 'all') {
            registrations = registrations.filter(reg => 
                (reg.status || 'pending') === status
            );
        }
        
        // 课程过滤
        if (course && course !== 'all') {
            registrations = registrations.filter(reg => reg.course === course);
        }
        
        // 分页
        const total = registrations.length;
        const paginatedResults = registrations
            .slice(parseInt(offset), parseInt(offset) + parseInt(limit));
        
        res.json({
            data: paginatedResults,
            total: total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        logger.error('搜索失败', error);
        res.status(500).json({ error: '搜索失败' });
    }
});

// 获取课程列表
app.get('/api/courses', requireAuth, async (req, res) => {
    try {
        const dataFile = path.join(dataDir, 'registrations.json');
        let registrations = [];
        
        if (fs.existsSync(dataFile)) {
            const data = fs.readFileSync(dataFile, 'utf8');
            registrations = JSON.parse(data);
        }
        
        const courses = [...new Set(registrations.map(reg => reg.course).filter(Boolean))];
        res.json(courses);
    } catch (error) {
        logger.error('获取课程列表失败', error);
        res.status(500).json({ error: '获取课程列表失败' });
    }
});

// 导入报名数据
app.post('/api/import-registrations', requireAuth, async (req, res) => {
    try {
        const { data, replace } = req.body;
        
        if (!Array.isArray(data)) {
            return res.status(400).json({ error: '数据格式错误：必须是数组格式' });
        }
        
        const dataFile = path.join(dataDir, 'registrations.json');
        let existingRegistrations = [];
        
        if (!replace && fs.existsSync(dataFile)) {
            const existingData = fs.readFileSync(dataFile, 'utf8');
            existingRegistrations = JSON.parse(existingData);
        }
        
        // 处理导入的数据
        const processedData = data.map(item => {
            if (!item.id && !item.timestamp) {
                item.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
            }
            if (!item.timestamp && !item.submitTime) {
                item.timestamp = new Date().toISOString();
            }
            return item;
        });
        
        // 合并数据
        const finalData = replace ? processedData : [...existingRegistrations, ...processedData];
        
        // 保存数据
        fs.writeFileSync(dataFile, JSON.stringify(finalData, null, 2));
        
        logger.info(`导入报名数据成功，共 ${processedData.length} 条记录`);
        
        res.json({ 
            success: true, 
            imported: processedData.length,
            total: finalData.length,
            message: `成功导入 ${processedData.length} 条报名数据` 
        });
        
    } catch (error) {
        logger.error('导入报名数据错误', error);
        res.status(500).json({ error: '导入失败：' + error.message });
    }
});

// 导入联系信息
app.post('/api/import-contacts', requireAuth, async (req, res) => {
    try {
        const { data, replace } = req.body;
        
        if (!Array.isArray(data)) {
            return res.status(400).json({ error: '数据格式错误：必须是数组格式' });
        }
        
        const contactsFile = path.join(dataDir, 'contacts.json');
        let existingContacts = [];
        
        if (!replace && fs.existsSync(contactsFile)) {
            const contactData = fs.readFileSync(contactsFile, 'utf8');
            existingContacts = JSON.parse(contactData);
        }
        
        // 处理导入的数据
        const processedData = data.map(item => {
            if (!item.id && !item.timestamp) {
                item.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
            }
            if (!item.timestamp && !item.submitTime) {
                item.timestamp = new Date().toISOString();
            }
            if (!item.submitTime) {
                item.submitTime = item.timestamp || new Date().toISOString();
            }
            if (!item.type) {
                item.type = 'contact';
            }
            return item;
        });
        
        // 合并数据
        const finalData = replace ? processedData : [...existingContacts, ...processedData];
        
        // 保存数据
        fs.writeFileSync(contactsFile, JSON.stringify(finalData, null, 2));
        
        logger.info(`导入联系信息成功，共 ${processedData.length} 条记录`);
        
        res.json({ 
            success: true, 
            imported: processedData.length,
            total: finalData.length,
            message: `成功导入 ${processedData.length} 条联系信息` 
        });
        
    } catch (error) {
        logger.error('导入联系信息错误', error);
        res.status(500).json({ error: '导入失败：' + error.message });
    }
});

app.listen(PORT, () => {
    logger.info('服务器启动成功', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        website: `http://localhost:${PORT}`,
        admin: `http://localhost:${PORT}/admin`,
        health: `http://localhost:${PORT}/health`,
        dataPath: './data/',
        uploadsPath: './uploads/'
    });
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n👋 服务器已关闭');
    process.exit(0);
});