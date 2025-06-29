// 认证和用户管理模块
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class AuthManager {
    constructor() {
        this.JWT_SECRET = process.env.JWT_SECRET || 'dingfeng-education-secret-2024';
        this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
        this.usersFile = path.join(__dirname, '../data/users.json');
        this.sessionsFile = path.join(__dirname, '../data/sessions.json');
        
        this.initializeUsers();
        this.cleanupExpiredSessions();
        
        // 定期清理过期会话（每小时执行一次）
        setInterval(() => {
            this.cleanupExpiredSessions();
        }, 60 * 60 * 1000);
    }
    
    // 初始化用户系统
    async initializeUsers() {
        try {
            // 确保数据目录存在
            const dataDir = path.dirname(this.usersFile);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            // 检查用户文件是否存在，如果不存在则创建空文件
            if (!fs.existsSync(this.usersFile)) {
                fs.writeFileSync(this.usersFile, JSON.stringify([], null, 2));
                logger.info('用户数据文件已创建');
            }
            
            // 初始化会话文件
            if (!fs.existsSync(this.sessionsFile)) {
                fs.writeFileSync(this.sessionsFile, JSON.stringify([], null, 2));
            }
        } catch (error) {
            logger.error('初始化用户系统失败', { error: error.message });
        }
    }
    
    // 用户登录
    async login(username, password, rememberMe = false) {
        try {
            const users = this.getUsers();
            const user = users.find(u => u.username === username && u.isActive);
            
            if (!user) {
                logger.warn('登录失败：用户不存在', { username });
                return { success: false, message: '用户名或密码错误' };
            }
            
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                logger.warn('登录失败：密码错误', { username });
                return { success: false, message: '用户名或密码错误' };
            }
            
            // 生成JWT token
            const tokenPayload = {
                userId: user.id,
                username: user.username,
                role: user.role
            };
            
            const expiresIn = rememberMe ? '7d' : this.JWT_EXPIRES_IN;
            const token = jwt.sign(tokenPayload, this.JWT_SECRET, { expiresIn });
            
            // 更新用户最后登录时间
            user.lastLogin = new Date().toISOString();
            this.saveUsers(users);
            
            // 清除该用户的所有旧会话，避免重复会话
            this.clearUserSessions(user.id);
            
            // 保存新会话信息
            this.saveSession({
                token,
                userId: user.id,
                username: user.username,
                loginTime: new Date().toISOString(),
                expiresAt: new Date(Date.now() + (rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString(),
                rememberMe
            });
            
            logger.info('用户登录成功', { 
                username, 
                rememberMe,
                loginTime: user.lastLogin 
            });
            
            return {
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    email: user.email,
                    lastLogin: user.lastLogin
                }
            };
        } catch (error) {
            logger.error('登录处理失败', { username, error: error.message });
            return { success: false, message: '登录失败，请重试' };
        }
    }
    
    // 验证token
    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.JWT_SECRET);
            
            // 检查会话是否存在且未过期
            const sessions = this.getSessions();
            const session = sessions.find(s => s.token === token);
            
            if (!session) {
                return { success: false, message: '会话不存在' };
            }
            
            if (new Date() > new Date(session.expiresAt)) {
                this.removeSession(token);
                return { success: false, message: '会话已过期' };
            }
            
            // 检查用户是否仍然活跃
            const users = this.getUsers();
            const user = users.find(u => u.id === decoded.userId && u.isActive);
            
            if (!user) {
                this.removeSession(token);
                return { success: false, message: '用户不存在或已被禁用' };
            }
            
            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    email: user.email
                }
            };
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                this.removeSession(token);
                return { success: false, message: 'Token已过期' };
            } else if (error.name === 'JsonWebTokenError') {
                return { success: false, message: 'Token无效' };
            }
            
            logger.error('Token验证失败', { error: error.message });
            return { success: false, message: 'Token验证失败' };
        }
    }
    
    // 用户登出
    logout(token) {
        try {
            this.removeSession(token);
            logger.info('用户登出成功', { token: token.substring(0, 10) + '...' });
            return { success: true, message: '登出成功' };
        } catch (error) {
            logger.error('登出失败', { error: error.message });
            return { success: false, message: '登出失败' };
        }
    }
    
    // 修改密码
    async changePassword(userId, oldPassword, newPassword) {
        try {
            const users = this.getUsers();
            const user = users.find(u => u.id === userId);
            
            if (!user) {
                return { success: false, message: '用户不存在' };
            }
            
            const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
            if (!isOldPasswordValid) {
                return { success: false, message: '原密码错误' };
            }
            
            // 验证新密码强度
            if (newPassword.length < 6) {
                return { success: false, message: '新密码至少需要6个字符' };
            }
            
            user.password = await bcrypt.hash(newPassword, 10);
            this.saveUsers(users);
            
            // 清除该用户的所有会话，强制重新登录
            this.clearUserSessions(userId);
            
            logger.info('用户密码修改成功', { userId, username: user.username });
            return { success: true, message: '密码修改成功，请重新登录' };
        } catch (error) {
            logger.error('密码修改失败', { userId, error: error.message });
            return { success: false, message: '密码修改失败' };
        }
    }
    
    // 获取用户列表
    getUsers() {
        try {
            if (fs.existsSync(this.usersFile)) {
                const data = fs.readFileSync(this.usersFile, 'utf8');
                return JSON.parse(data);
            }
            return [];
        } catch (error) {
            logger.error('读取用户文件失败', { error: error.message });
            return [];
        }
    }
    
    // 保存用户列表
    saveUsers(users) {
        try {
            fs.writeFileSync(this.usersFile, JSON.stringify(users, null, 2));
        } catch (error) {
            logger.error('保存用户文件失败', { error: error.message });
        }
    }
    
    // 获取会话列表
    getSessions() {
        try {
            if (fs.existsSync(this.sessionsFile)) {
                const data = fs.readFileSync(this.sessionsFile, 'utf8');
                return JSON.parse(data);
            }
            return [];
        } catch (error) {
            logger.error('读取会话文件失败', { error: error.message });
            return [];
        }
    }
    
    // 保存会话
    saveSession(session) {
        try {
            const sessions = this.getSessions();
            sessions.push(session);
            fs.writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2));
        } catch (error) {
            logger.error('保存会话失败', { error: error.message });
        }
    }
    
    // 移除会话
    removeSession(token) {
        try {
            const sessions = this.getSessions();
            const filteredSessions = sessions.filter(s => s.token !== token);
            fs.writeFileSync(this.sessionsFile, JSON.stringify(filteredSessions, null, 2));
        } catch (error) {
            logger.error('移除会话失败', { error: error.message });
        }
    }
    
    // 清除用户的所有会话
    clearUserSessions(userId) {
        try {
            const sessions = this.getSessions();
            const filteredSessions = sessions.filter(s => s.userId !== userId);
            fs.writeFileSync(this.sessionsFile, JSON.stringify(filteredSessions, null, 2));
        } catch (error) {
            logger.error('清除用户会话失败', { userId, error: error.message });
        }
    }
    
    // 清理过期会话
    cleanupExpiredSessions() {
        try {
            const sessions = this.getSessions();
            const now = new Date();
            const activeSessions = sessions.filter(s => new Date(s.expiresAt) > now);
            
            if (activeSessions.length !== sessions.length) {
                fs.writeFileSync(this.sessionsFile, JSON.stringify(activeSessions, null, 2));
                logger.info('清理过期会话', { 
                    total: sessions.length, 
                    active: activeSessions.length,
                    removed: sessions.length - activeSessions.length
                });
            }
        } catch (error) {
            logger.error('清理过期会话失败', { error: error.message });
        }
    }
    
    // 获取活跃会话统计
    getSessionStats() {
        try {
            const sessions = this.getSessions();
            const now = new Date();
            const activeSessions = sessions.filter(s => new Date(s.expiresAt) > now);
            
            return {
                total: sessions.length,
                active: activeSessions.length,
                expired: sessions.length - activeSessions.length
            };
        } catch (error) {
            logger.error('获取会话统计失败', { error: error.message });
            return { total: 0, active: 0, expired: 0 };
        }
    }
    
    // 检查系统是否已初始化
    isInitialized() {
        try {
            const users = this.getUsers();
            return users.length > 0;
        } catch (error) {
            logger.error('检查初始化状态失败', { error: error.message });
            return false;
        }
    }
    
    // 创建初始管理员用户
    async createInitialUser(username, email, password) {
        try {
            // 检查是否已经初始化
            if (this.isInitialized()) {
                return { success: false, message: '系统已经初始化，无法重复设置' };
            }
            
            // 验证输入
            if (!username || !email || !password) {
                return { success: false, message: '用户名、邮箱和密码不能为空' };
            }
            
            // 验证用户名格式
            if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
                return { success: false, message: '用户名格式不正确' };
            }
            
            // 验证邮箱格式
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return { success: false, message: '邮箱格式不正确' };
            }
            
            // 验证密码强度
            if (password.length < 8) {
                return { success: false, message: '密码长度至少为8个字符' };
            }
            
            const passwordRequirements = [
                /[A-Z]/.test(password), // 大写字母
                /[a-z]/.test(password), // 小写字母
                /[0-9]/.test(password), // 数字
                /[!@#$%^&*(),.?":{}|<>]/.test(password) // 特殊字符
            ];
            
            if (passwordRequirements.filter(req => req).length < 3) {
                return { success: false, message: '密码强度不够，请包含大写字母、小写字母、数字和特殊字符中的至少3种' };
            }
            
            // 创建用户
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = {
                id: 1,
                username,
                password: hashedPassword,
                role: 'admin',
                email,
                createdAt: new Date().toISOString(),
                lastLogin: null,
                isActive: true
            };
            
            // 保存用户
            const users = [newUser];
            this.saveUsers(users);
            
            logger.info('初始管理员用户创建成功', { 
                username, 
                email,
                createdAt: newUser.createdAt 
            });
            
            return { 
                success: true, 
                message: '管理员账号创建成功',
                user: {
                    id: newUser.id,
                    username: newUser.username,
                    email: newUser.email,
                    role: newUser.role,
                    createdAt: newUser.createdAt
                }
            };
        } catch (error) {
            logger.error('创建初始用户失败', { 
                username, 
                email, 
                error: error.message 
            });
            return { success: false, message: '创建用户失败，请重试' };
        }
    }
}

// 创建认证管理器实例
const authManager = new AuthManager();

// 认证中间件
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: '需要身份验证' });
    }
    
    const token = authHeader.substring(7); // 移除 'Bearer ' 前缀
    const result = authManager.verifyToken(token);
    
    if (!result.success) {
        return res.status(401).json({ success: false, message: result.message });
    }
    
    req.user = result.user;
    next();
}

// 角色权限中间件
function requireRole(role) {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({ success: false, message: '权限不足' });
        }
        next();
    };
}

module.exports = {
    authManager,
    requireAuth,
    requireRole
};