const fs = require('fs');
const path = require('path');

// 确保日志目录存在
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

class Logger {
    constructor() {
        this.logFile = path.join(logDir, 'app.log');
        this.errorFile = path.join(logDir, 'error.log');
        this.accessFile = path.join(logDir, 'access.log');
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
    }

    writeToFile(filename, content) {
        try {
            fs.appendFileSync(filename, content);
        } catch (error) {
            console.error('写入日志文件失败:', error);
        }
    }

    info(message, meta = {}) {
        const logMessage = this.formatMessage('info', message, meta);
        console.log(`\x1b[36m${logMessage.trim()}\x1b[0m`);
        this.writeToFile(this.logFile, logMessage);
    }

    warn(message, meta = {}) {
        const logMessage = this.formatMessage('warn', message, meta);
        console.warn(`\x1b[33m${logMessage.trim()}\x1b[0m`);
        this.writeToFile(this.logFile, logMessage);
    }

    error(message, error = null, meta = {}) {
        const errorMeta = error ? {
            ...meta,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            }
        } : meta;
        
        const logMessage = this.formatMessage('error', message, errorMeta);
        console.error(`\x1b[31m${logMessage.trim()}\x1b[0m`);
        this.writeToFile(this.logFile, logMessage);
        this.writeToFile(this.errorFile, logMessage);
    }

    access(req, res, responseTime) {
        const logMessage = this.formatMessage('access', 'HTTP Request', {
            method: req.method,
            url: req.url,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            contentLength: res.get('Content-Length') || 0
        });
        
        this.writeToFile(this.accessFile, logMessage);
    }

    // 清理旧日志文件（保留最近30天）
    cleanOldLogs() {
        const files = [this.logFile, this.errorFile, this.accessFile];
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

        files.forEach(file => {
            if (fs.existsSync(file)) {
                const stats = fs.statSync(file);
                if (stats.mtime.getTime() < thirtyDaysAgo) {
                    try {
                        fs.unlinkSync(file);
                        this.info(`清理旧日志文件: ${file}`);
                    } catch (error) {
                        this.error('清理日志文件失败', error, { file });
                    }
                }
            }
        });
    }
}

// 创建全局日志实例
const logger = new Logger();

// 定期清理日志（每天执行一次）
setInterval(() => {
    logger.cleanOldLogs();
}, 24 * 60 * 60 * 1000);

module.exports = logger;