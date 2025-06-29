const os = require('os');
const logger = require('./logger');

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            requests: {
                total: 0,
                success: 0,
                error: 0,
                avgResponseTime: 0
            },
            system: {
                cpuUsage: 0,
                memoryUsage: 0,
                uptime: 0
            },
            responseTimes: []
        };
        
        this.startTime = Date.now();
        this.maxResponseTimes = 1000; // 保留最近1000次请求的响应时间
        
        // 每分钟记录系统指标
        setInterval(() => {
            this.recordSystemMetrics();
        }, 60000);
        
        // 每小时输出性能报告
        setInterval(() => {
            this.generatePerformanceReport();
        }, 3600000);
    }

    // 记录请求指标
    recordRequest(req, res, responseTime) {
        this.metrics.requests.total++;
        
        if (res.statusCode >= 200 && res.statusCode < 400) {
            this.metrics.requests.success++;
        } else {
            this.metrics.requests.error++;
        }
        
        // 记录响应时间
        this.metrics.responseTimes.push(responseTime);
        
        // 保持响应时间数组大小
        if (this.metrics.responseTimes.length > this.maxResponseTimes) {
            this.metrics.responseTimes.shift();
        }
        
        // 计算平均响应时间
        this.metrics.requests.avgResponseTime = 
            this.metrics.responseTimes.reduce((sum, time) => sum + time, 0) / 
            this.metrics.responseTimes.length;
        
        // 记录慢请求（超过1秒）
        if (responseTime > 1000) {
            logger.warn('慢请求检测', {
                method: req.method,
                url: req.url,
                responseTime: `${responseTime}ms`,
                statusCode: res.statusCode,
                ip: req.ip || req.connection.remoteAddress
            });
        }
    }

    // 记录系统指标
    recordSystemMetrics() {
        // CPU使用率
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;
        
        cpus.forEach(cpu => {
            for (let type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        
        this.metrics.system.cpuUsage = 100 - (totalIdle / totalTick * 100);
        
        // 内存使用率
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        this.metrics.system.memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
        
        // 运行时间
        this.metrics.system.uptime = (Date.now() - this.startTime) / 1000;
        
        // 检查资源使用警告
        if (this.metrics.system.cpuUsage > 80) {
            logger.warn('CPU使用率过高', { cpuUsage: `${this.metrics.system.cpuUsage.toFixed(2)}%` });
        }
        
        if (this.metrics.system.memoryUsage > 80) {
            logger.warn('内存使用率过高', { memoryUsage: `${this.metrics.system.memoryUsage.toFixed(2)}%` });
        }
    }

    // 生成性能报告
    generatePerformanceReport() {
        const report = {
            timestamp: new Date().toISOString(),
            requests: {
                total: this.metrics.requests.total,
                success: this.metrics.requests.success,
                error: this.metrics.requests.error,
                successRate: this.metrics.requests.total > 0 ? 
                    (this.metrics.requests.success / this.metrics.requests.total * 100).toFixed(2) + '%' : '0%',
                avgResponseTime: `${this.metrics.requests.avgResponseTime.toFixed(2)}ms`
            },
            system: {
                cpuUsage: `${this.metrics.system.cpuUsage.toFixed(2)}%`,
                memoryUsage: `${this.metrics.system.memoryUsage.toFixed(2)}%`,
                uptime: this.formatUptime(this.metrics.system.uptime),
                platform: os.platform(),
                nodeVersion: process.version
            },
            responseTimes: this.getResponseTimeStats()
        };
        
        logger.info('性能报告', report);
        return report;
    }

    // 获取响应时间统计
    getResponseTimeStats() {
        if (this.metrics.responseTimes.length === 0) {
            return { min: 0, max: 0, median: 0, p95: 0, p99: 0 };
        }
        
        const sorted = [...this.metrics.responseTimes].sort((a, b) => a - b);
        const len = sorted.length;
        
        return {
            min: `${sorted[0]}ms`,
            max: `${sorted[len - 1]}ms`,
            median: `${sorted[Math.floor(len / 2)]}ms`,
            p95: `${sorted[Math.floor(len * 0.95)]}ms`,
            p99: `${sorted[Math.floor(len * 0.99)]}ms`
        };
    }

    // 格式化运行时间
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${days}天 ${hours}小时 ${minutes}分钟 ${secs}秒`;
    }

    // 获取当前指标
    getCurrentMetrics() {
        return {
            ...this.metrics,
            system: {
                ...this.metrics.system,
                cpuUsage: `${this.metrics.system.cpuUsage.toFixed(2)}%`,
                memoryUsage: `${this.metrics.system.memoryUsage.toFixed(2)}%`,
                uptime: this.formatUptime(this.metrics.system.uptime)
            },
            responseTimes: this.getResponseTimeStats()
        };
    }

    // 重置指标
    resetMetrics() {
        this.metrics.requests = {
            total: 0,
            success: 0,
            error: 0,
            avgResponseTime: 0
        };
        this.metrics.responseTimes = [];
        logger.info('性能指标已重置');
    }

    // 健康检查
    getHealthStatus() {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: this.formatUptime(this.metrics.system.uptime),
            checks: {
                cpu: this.metrics.system.cpuUsage < 80,
                memory: this.metrics.system.memoryUsage < 80,
                responseTime: this.metrics.requests.avgResponseTime < 1000,
                errorRate: this.metrics.requests.total > 0 ? 
                    (this.metrics.requests.error / this.metrics.requests.total) < 0.05 : true
            }
        };
        
        // 检查是否有任何检查失败
        const failedChecks = Object.values(health.checks).some(check => !check);
        if (failedChecks) {
            health.status = 'unhealthy';
        }
        
        return health;
    }
}

// 创建性能监控实例
const monitor = new PerformanceMonitor();

// 中间件函数
function performanceMiddleware(req, res, next) {
    const startTime = Date.now();
    
    // 监听响应结束事件
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        monitor.recordRequest(req, res, responseTime);
    });
    
    next();
}

module.exports = {
    monitor,
    performanceMiddleware
};