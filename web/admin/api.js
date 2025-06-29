const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const router = express.Router();
const dataDir = path.join(__dirname, '..', 'data');
const registrationsFile = path.join(dataDir, 'registrations.json');

// 确保数据目录存在
async function ensureDataDir() {
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }
}

// 读取报名数据
async function readRegistrations() {
    try {
        await ensureDataDir();
        const data = await fs.readFile(registrationsFile, 'utf8');
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
    await fs.writeFile(registrationsFile, JSON.stringify(data, null, 2), 'utf8');
}

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 获取所有报名记录
router.get('/registrations', async (req, res) => {
    try {
        const registrations = await readRegistrations();
        
        // 添加ID字段（如果不存在）
        const processedRegistrations = registrations.map(reg => ({
            ...reg,
            id: reg.id || reg.timestamp || generateId()
        }));
        
        res.json(processedRegistrations);
    } catch (error) {
        logger.error('获取报名记录失败', error);
        res.status(500).json({ error: '获取数据失败' });
    }
});

// 获取单个报名记录
router.get('/registrations/:id', async (req, res) => {
    try {
        const registrations = await readRegistrations();
        const targetId = isNaN(req.params.id) ? req.params.id : parseInt(req.params.id);
        const registration = registrations.find(reg => {
            const regId = reg.id || reg.timestamp;
            return regId == targetId; // 使用宽松比较以处理字符串和数字
        });
        
        if (!registration) {
            return res.status(404).json({ error: '记录不存在' });
        }
        
        res.json(registration);
    } catch (error) {
        console.error('获取报名记录失败:', error);
        res.status(500).json({ error: '获取数据失败' });
    }
});

// 创建新的报名记录
router.post('/registrations', async (req, res) => {
    try {
        const registrations = await readRegistrations();
        
        const newRegistration = {
            id: generateId(),
            ...req.body,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };
        
        registrations.push(newRegistration);
        await writeRegistrations(registrations);
        
        res.status(201).json(newRegistration);
    } catch (error) {
        logger.error('创建报名记录失败', error);
        res.status(500).json({ error: '创建记录失败' });
    }
});

// 更新报名记录
router.put('/registrations/:id', async (req, res) => {
    try {
        const registrations = await readRegistrations();
        const targetId = isNaN(req.params.id) ? req.params.id : parseInt(req.params.id);
        const index = registrations.findIndex(reg => {
            const regId = reg.id || reg.timestamp;
            return regId == targetId; // 使用宽松比较以处理字符串和数字
        });
        
        if (index === -1) {
            return res.status(404).json({ error: '记录不存在' });
        }
        
        registrations[index] = {
            ...registrations[index],
            ...req.body,
            updatedAt: new Date().toISOString()
        };
        
        await writeRegistrations(registrations);
        res.json(registrations[index]);
    } catch (error) {
        logger.error('更新报名记录失败', error);
        res.status(500).json({ error: '更新记录失败' });
    }
});

// 删除报名记录
router.delete('/registrations/:id', async (req, res) => {
    try {
        logger.info('删除报名记录请求', {
            originalId: req.params.id,
            targetId: req.params.id
        });
        
        const registrations = await readRegistrations();
        const targetId = isNaN(req.params.id) ? req.params.id : parseInt(req.params.id);
        const index = registrations.findIndex(reg => 
            (reg.id || reg.timestamp) === targetId
        );
        
        if (index === -1) {
            return res.status(404).json({ error: '记录不存在' });
        }
        
        const deletedRegistration = registrations.splice(index, 1)[0];
        await writeRegistrations(registrations);
        
        res.json({ message: '删除成功', data: deletedRegistration });
    } catch (error) {
        logger.error('删除报名记录失败', error);
        res.status(500).json({ error: '删除记录失败' });
    }
});

// 批量删除报名记录
router.delete('/registrations', async (req, res) => {
    try {
        const { ids } = req.body;
        
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: '请提供要删除的记录ID' });
        }
        
        const registrations = await readRegistrations();
        const filteredRegistrations = registrations.filter(reg => 
            !ids.includes(reg.id || reg.timestamp)
        );
        
        const deletedCount = registrations.length - filteredRegistrations.length;
        await writeRegistrations(filteredRegistrations);
        
        res.json({ message: `成功删除 ${deletedCount} 条记录` });
    } catch (error) {
        logger.error('批量删除报名记录失败', error);
        res.status(500).json({ error: '批量删除失败' });
    }
});

// 批量删除报名记录 (POST路由)
router.post('/registrations/batch-delete', async (req, res) => {
    try {
        const { ids } = req.body;
        
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: '请提供要删除的记录ID' });
        }
        
        const registrations = await readRegistrations();
        const filteredRegistrations = registrations.filter(reg => 
            !ids.includes(reg.id || reg.timestamp)
        );
        
        const deletedCount = registrations.length - filteredRegistrations.length;
        await writeRegistrations(filteredRegistrations);
        
        res.json({ deleted: deletedCount, message: `成功删除 ${deletedCount} 条记录` });
    } catch (error) {
        logger.error('批量删除报名记录失败', error);
        res.status(500).json({ error: '批量删除失败' });
    }
});

// 批量删除联系记录 (POST路由)
router.post('/contacts/batch-delete', async (req, res) => {
    try {
        const { ids } = req.body;
        
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: '请提供要删除的记录ID' });
        }
        
        const contacts = await readContacts();
        const filteredContacts = contacts.filter(contact => 
            !ids.includes(contact.id || contact.timestamp)
        );
        
        const deletedCount = contacts.length - filteredContacts.length;
        await writeContacts(filteredContacts);
        
        res.json({ deleted: deletedCount, message: `成功删除 ${deletedCount} 条记录` });
    } catch (error) {
        logger.error('批量删除联系记录失败', error);
        res.status(500).json({ error: '批量删除失败' });
    }
});

// 获取统计数据
router.get('/stats', async (req, res) => {
    try {
        const registrations = await readRegistrations();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const stats = {
            total: registrations.length,
            today: registrations.filter(reg => 
                new Date(reg.submitTime || reg.timestamp) >= today
            ).length,
            thisWeek: registrations.filter(reg => 
                new Date(reg.submitTime || reg.timestamp) >= thisWeek
            ).length,
            thisMonth: registrations.filter(reg => 
                new Date(reg.submitTime || reg.timestamp) >= thisMonth
            ).length,
            pending: registrations.filter(reg => 
                reg.status === 'pending' || !reg.status
            ).length,
            completed: registrations.filter(reg => 
                reg.status === 'completed'
            ).length,
            byStatus: {
                pending: registrations.filter(reg => reg.status === 'pending' || !reg.status).length,
                completed: registrations.filter(reg => reg.status === 'completed').length,
                cancelled: registrations.filter(reg => reg.status === 'cancelled').length
            },
            byCourse: {},
            byCountry: {}
        };
        
        // 按课程统计
        registrations.forEach(reg => {
            const course = reg.projects || reg.course || '未选择';
            stats.byCourse[course] = (stats.byCourse[course] || 0) + 1;
        });
        
        // 按国家统计
        registrations.forEach(reg => {
            const country = reg.target_country || reg.projects || '未选择';
            stats.byCountry[country] = (stats.byCountry[country] || 0) + 1;
        });
        
        res.json(stats);
    } catch (error) {
        logger.error('获取统计数据失败', error);
        res.status(500).json({ error: '获取统计数据失败' });
    }
});

// 获取趋势数据
router.get('/trends', async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const registrations = await readRegistrations();
        const trends = [];
        
        for (let i = parseInt(days) - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const count = registrations.filter(reg => {
                const regDate = new Date(reg.submitTime || reg.timestamp).toISOString().split('T')[0];
                return regDate === dateStr;
            }).length;
            
            trends.push({
                date: dateStr,
                count: count,
                label: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
            });
        }
        
        res.json(trends);
    } catch (error) {
        logger.error('获取趋势数据失败', error);
        res.status(500).json({ error: '获取趋势数据失败' });
    }
});

// 导出数据
router.get('/export', async (req, res) => {
    try {
        const { format = 'json', status, course, dateFrom, dateTo } = req.query;
        let registrations = await readRegistrations();
        
        // 应用过滤器
        if (status && status !== 'all') {
            registrations = registrations.filter(reg => 
                (reg.status || 'pending') === status
            );
        }
        
        if (course && course !== 'all') {
            registrations = registrations.filter(reg => reg.course === course);
        }
        
        if (dateFrom) {
            registrations = registrations.filter(reg => 
                new Date(reg.timestamp) >= new Date(dateFrom)
            );
        }
        
        if (dateTo) {
            registrations = registrations.filter(reg => 
                new Date(reg.timestamp) <= new Date(dateTo + ' 23:59:59')
            );
        }
        
        if (format === 'csv') {
            const csvHeaders = ['姓名', '手机号', '课程', '年龄', '性别', '学历', '工作经验', '报名时间', '状态', '备注'];
            const csvRows = [csvHeaders.join(',')];
            
            registrations.forEach(reg => {
                const row = [
                    reg.name || '',
                    reg.phone || '',
                    reg.course || '',
                    reg.age || '',
                    reg.gender || '',
                    reg.education || '',
                    reg.experience || '',
                    new Date(reg.timestamp).toLocaleString('zh-CN'),
                    reg.status === 'completed' ? '已完成' : '待处理',
                    reg.remarks || ''
                ];
                csvRows.push(row.map(field => `"${field}"`).join(','));
            });
            
            const csvContent = '\uFEFF' + csvRows.join('\n');
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="报名数据_${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csvContent);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="报名数据_${new Date().toISOString().split('T')[0]}.json"`);
            res.json(registrations);
        }
    } catch (error) {
        logger.error('导出数据失败', error);
        res.status(500).json({ error: '导出数据失败' });
    }
});

// 搜索报名记录
router.get('/search', async (req, res) => {
    try {
        const { q, status, course, limit = 50, offset = 0 } = req.query;
        let registrations = await readRegistrations();
        
        // 文本搜索
        if (q) {
            const query = q.toLowerCase();
            registrations = registrations.filter(reg => 
                (reg.name && reg.name.toLowerCase().includes(query)) ||
                (reg.phone && reg.phone.includes(query)) ||
                (reg.course && reg.course.toLowerCase().includes(query)) ||
                (reg.remarks && reg.remarks.toLowerCase().includes(query))
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
router.get('/courses', async (req, res) => {
    try {
        const registrations = await readRegistrations();
        const courses = [...new Set(registrations.map(reg => reg.course).filter(Boolean))];
        res.json(courses);
    } catch (error) {
        logger.error('获取课程列表失败', error);
        res.status(500).json({ error: '获取课程列表失败' });
    }
});

// 处理联系表单提交
router.post('/contact', async (req, res) => {
    try {
        const { name, phone, timestamp, type } = req.body;
        
        // 验证必填字段
        if (!name || !phone) {
            return res.status(400).json({ error: '姓名和电话号码为必填项' });
        }
        
        // 读取现有联系数据
        const contactsFile = path.join(dataDir, 'contacts.json');
        let contacts = [];
        
        try {
            const data = await fs.readFile(contactsFile, 'utf8');
            contacts = JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
        
        // 创建新的联系记录
        const newContact = {
            id: generateId(),
            name: name.trim(),
            phone: phone.trim(),
            type: type || 'contact',
            timestamp: timestamp || new Date().toISOString(),
            submitTime: new Date().toISOString()
        };
        
        // 添加到联系数据
        contacts.push(newContact);
        
        // 保存到文件
        await fs.writeFile(contactsFile, JSON.stringify(contacts, null, 2), 'utf8');
        
        res.json({ success: true, message: '联系信息已保存' });
    } catch (error) {
        logger.error('保存联系信息错误', error);
        res.status(500).json({ error: '保存失败，请稍后重试' });
    }
});

// 导入报名数据
router.post('/import-registrations', async (req, res) => {
    try {
        const { data, replace } = req.body;
        
        if (!Array.isArray(data)) {
            return res.status(400).json({ error: '数据格式错误：必须是数组格式' });
        }
        
        let existingRegistrations = [];
        
        if (!replace) {
            // 如果不替换，先读取现有数据
            existingRegistrations = await readRegistrations();
        }
        
        // 处理导入的数据，确保每条记录都有必要的字段
        const processedData = data.map(item => {
            // 确保有ID
            if (!item.id && !item.timestamp) {
                item.id = generateId();
            }
            
            // 确保有时间戳
            if (!item.timestamp && !item.submitTime) {
                item.timestamp = new Date().toISOString();
            }
            
            return item;
        });
        
        // 合并数据
        const finalData = replace ? processedData : [...existingRegistrations, ...processedData];
        
        // 保存数据
        await writeRegistrations(finalData);
        
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
router.post('/import-contacts', async (req, res) => {
    try {
        const { data, replace } = req.body;
        
        if (!Array.isArray(data)) {
            return res.status(400).json({ error: '数据格式错误：必须是数组格式' });
        }
        
        const contactsFile = path.join(dataDir, 'contacts.json');
        let existingContacts = [];
        
        if (!replace) {
            // 如果不替换，先读取现有数据
            try {
                const contactData = await fs.readFile(contactsFile, 'utf8');
                existingContacts = JSON.parse(contactData);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
        }
        
        // 处理导入的数据，确保每条记录都有必要的字段
        const processedData = data.map(item => {
            // 确保有ID
            if (!item.id && !item.timestamp) {
                item.id = generateId();
            }
            
            // 确保有时间戳
            if (!item.timestamp && !item.submitTime) {
                item.timestamp = new Date().toISOString();
            }
            
            // 确保有提交时间
            if (!item.submitTime) {
                item.submitTime = item.timestamp || new Date().toISOString();
            }
            
            // 确保有类型
            if (!item.type) {
                item.type = 'contact';
            }
            
            return item;
        });
        
        // 合并数据
        const finalData = replace ? processedData : [...existingContacts, ...processedData];
        
        // 保存数据
        await fs.writeFile(contactsFile, JSON.stringify(finalData, null, 2), 'utf8');
        
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

// 错误处理中间件
router.use((error, req, res, next) => {
    logger.error('API错误', error);
    res.status(500).json({ 
        error: '服务器内部错误',
        message: process.env.NODE_ENV === 'development' ? error.message : '请稍后重试'
    });
});

module.exports = router;