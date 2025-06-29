const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const adminAPI = require('./admin/api');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS中间件
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// 中间件配置
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// 文件上传配置
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        fs.mkdir(uploadDir, { recursive: true }).then(() => {
            cb(null, uploadDir);
        }).catch(err => {
            console.error('创建上传目录失败:', err);
            cb(err);
        });
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('只允许上传图片和文档文件'));
        }
    }
});

// 确保数据目录存在
async function ensureDataDir() {
    const dataDir = path.join(__dirname, 'data');
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
        console.log('数据目录已创建:', dataDir);
    }
}

// 读取报名数据
async function readRegistrations() {
    const filePath = path.join(__dirname, 'data', 'registrations.json');
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

// 写入报名数据
async function writeRegistrations(data) {
    await ensureDataDir();
    const filePath = path.join(__dirname, 'data', 'registrations.json');
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// API路由
app.use('/api', adminAPI);

// 处理报名表单提交
app.post('/submit-registration', upload.single('id_photo'), async (req, res) => {
    try {
        const formData = {
            id: Date.now(), // 使用时间戳作为唯一ID
            submitTime: new Date().toISOString(),
            ...req.body
        };
        
        // 如果有上传的照片，保存文件路径
        if (req.file) {
            formData.id_photo_path = req.file.path;
            formData.id_photo_filename = req.file.filename;
        }
        
        const registrations = await readRegistrations();
        registrations.push(formData);
        await writeRegistrations(registrations);
        
        console.log('新的报名申请:', formData.name, '- ID:', formData.id);
        
        res.json({ success: true, message: '报名申请提交成功', id: formData.id });
    } catch (error) {
        console.error('处理报名申请时出错:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 原有的报名表单提交处理（保持兼容性）
app.post('/submit', upload.single('resume'), async (req, res) => {
    try {
        const formData = {
            id: generateId(),
            name: req.body.name,
            phone: req.body.phone,
            course: req.body.course,
            age: req.body.age,
            gender: req.body.gender,
            education: req.body.education,
            experience: req.body.experience,
            remarks: req.body.remarks,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        if (req.file) {
            formData.resume = {
                filename: req.file.filename,
                originalname: req.file.originalname,
                path: req.file.path,
                size: req.file.size
            };
        }

        const registrations = await readRegistrations();
        registrations.push(formData);
        await writeRegistrations(registrations);

        console.log('新的报名提交:', formData);
        res.json({ success: true, message: '报名信息提交成功！' });
    } catch (error) {
        console.error('处理报名提交失败:', error);
        res.status(500).json({ success: false, message: '提交失败，请稍后重试' });
    }
});

// 管理后台主页面
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// 原有的管理页面（保持兼容性）
app.get('/admin-old', async (req, res) => {
    try {
        const registrations = await readRegistrations();
        
        // 计算统计数据
        const today = new Date().toDateString();
        const todayCount = registrations.filter(reg => 
            new Date(reg.timestamp).toDateString() === today
        ).length;
        
        const pendingCount = registrations.filter(reg => 
            reg.status === 'pending' || !reg.status
        ).length;
        
        const completedCount = registrations.filter(reg => 
            reg.status === 'completed'
        ).length;
        
        // 发送简化的管理页面
        res.send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>报名管理系统 - 西安顶峰国际教育中心</title>
    <style>
        body { font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .stats { display: flex; gap: 20px; margin-bottom: 20px; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .table-container { background: white; border-radius: 8px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; font-weight: 600; }
        .btn { padding: 6px 12px; margin: 2px; border: none; border-radius: 4px; cursor: pointer; }
        .btn-danger { background: #dc3545; color: white; }
        .btn-info { background: #17a2b8; color: white; }
    </style>
</head>
<body>
    <div class="header">
        <h1>报名管理系统</h1>
        <p>西安顶峰国际教育中心</p>
    </div>
    
    <div class="stats">
        <div class="stat-card">
            <div style="font-size: 24px; font-weight: bold; color: #667eea;">${registrations.length}</div>
            <div>总报名数</div>
        </div>
        <div class="stat-card">
            <div style="font-size: 24px; font-weight: bold; color: #28a745;">${todayCount}</div>
            <div>今日报名</div>
        </div>
        <div class="stat-card">
            <div style="font-size: 24px; font-weight: bold; color: #ffc107;">${pendingCount}</div>
            <div>待处理</div>
        </div>
        <div class="stat-card">
            <div style="font-size: 24px; font-weight: bold; color: #17a2b8;">${completedCount}</div>
            <div>已完成</div>
        </div>
    </div>
    
    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th>姓名</th>
                    <th>手机号</th>
                    <th>课程</th>
                    <th>报名时间</th>
                    <th>状态</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${registrations.map(reg => `
                    <tr>
                        <td>${reg.name || '未填写'}</td>
                        <td>${reg.phone || '未填写'}</td>
                        <td>${reg.course || '未选择'}</td>
                        <td>${new Date(reg.timestamp).toLocaleString('zh-CN')}</td>
                        <td>${reg.status === 'completed' ? '已完成' : '待处理'}</td>
                        <td>
                            <button class="btn btn-info" onclick="alert('详情功能请使用新版管理后台')">详情</button>
                            <button class="btn btn-danger" onclick="if(confirm('确定删除？')) window.location.href='/api/registrations/${reg.id || reg.timestamp}?_method=DELETE'">删除</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
        <a href="/admin" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">使用新版管理后台</a>
    </div>
</body>
</html>
        `);
    } catch (error) {
        console.error('获取管理页面失败:', error);
        res.status(500).send('服务器错误');
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ success: false, message: '服务器内部错误' });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({ success: false, message: '页面未找到' });
});

// 启动服务器
 app.listen(PORT, async () => {
    console.log(`\n🚀 服务器启动成功!`);
    console.log(`📱 网站地址: http://localhost:${PORT}`);
    console.log(`⚙️  管理后台: http://localhost:${PORT}/admin`);
    console.log(`📁 数据存储: ${path.join(__dirname, 'data')}`);
    console.log(`📂 文件上传: ${path.join(__dirname, 'uploads')}`);
    
    // 确保数据目录存在
    await ensureDataDir();
    console.log('✅ 数据目录检查完成\n');
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n正在关闭服务器...');
    process.exit(0);
});

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('\n正在关闭服务器...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    process.exit(0);
});