const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class BackupManager {
    constructor() {
        this.dataDir = path.join(__dirname, '../data');
        this.backupDir = path.join(__dirname, '../backups');
        this.maxBackups = 30; // 保留最近30个备份
        
        // 确保备份目录存在
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    // 创建备份
    createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupSubDir = path.join(this.backupDir, timestamp);
            
            // 创建时间戳目录
            fs.mkdirSync(backupSubDir, { recursive: true });
            
            // 备份所有JSON文件
            const files = ['registrations.json', 'contacts.json'];
            let backedUpFiles = 0;
            
            files.forEach(filename => {
                const sourcePath = path.join(this.dataDir, filename);
                const backupPath = path.join(backupSubDir, filename);
                
                if (fs.existsSync(sourcePath)) {
                    fs.copyFileSync(sourcePath, backupPath);
                    backedUpFiles++;
                    logger.info(`备份文件: ${filename}`, { 
                        source: sourcePath, 
                        backup: backupPath 
                    });
                }
            });
            
            // 备份上传的文件
            const uploadsDir = path.join(__dirname, '../uploads');
            const backupUploadsDir = path.join(backupSubDir, 'uploads');
            
            if (fs.existsSync(uploadsDir)) {
                this.copyDirectory(uploadsDir, backupUploadsDir);
                logger.info('备份上传文件目录', { 
                    source: uploadsDir, 
                    backup: backupUploadsDir 
                });
            }
            
            logger.info(`备份完成`, { 
                timestamp, 
                filesBackedUp: backedUpFiles,
                backupLocation: backupSubDir 
            });
            
            // 清理旧备份
            this.cleanOldBackups();
            
            return { success: true, backupPath: backupSubDir, filesCount: backedUpFiles };
            
        } catch (error) {
            logger.error('创建备份失败', error);
            return { success: false, error: error.message };
        }
    }

    // 递归复制目录
    copyDirectory(source, destination) {
        if (!fs.existsSync(destination)) {
            fs.mkdirSync(destination, { recursive: true });
        }
        
        const files = fs.readdirSync(source);
        
        files.forEach(file => {
            const sourcePath = path.join(source, file);
            const destPath = path.join(destination, file);
            
            if (fs.statSync(sourcePath).isDirectory()) {
                this.copyDirectory(sourcePath, destPath);
            } else {
                fs.copyFileSync(sourcePath, destPath);
            }
        });
    }

    // 清理旧备份
    cleanOldBackups() {
        try {
            const backups = fs.readdirSync(this.backupDir)
                .filter(name => fs.statSync(path.join(this.backupDir, name)).isDirectory())
                .map(name => ({
                    name,
                    path: path.join(this.backupDir, name),
                    time: fs.statSync(path.join(this.backupDir, name)).mtime
                }))
                .sort((a, b) => b.time - a.time); // 按时间倒序排列
            
            // 删除超出数量限制的备份
            if (backups.length > this.maxBackups) {
                const toDelete = backups.slice(this.maxBackups);
                
                toDelete.forEach(backup => {
                    this.deleteDirectory(backup.path);
                    logger.info(`删除旧备份: ${backup.name}`);
                });
            }
            
        } catch (error) {
            logger.error('清理旧备份失败', error);
        }
    }

    // 递归删除目录
    deleteDirectory(dirPath) {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach(file => {
                const filePath = path.join(dirPath, file);
                if (fs.statSync(filePath).isDirectory()) {
                    this.deleteDirectory(filePath);
                } else {
                    fs.unlinkSync(filePath);
                }
            });
            fs.rmdirSync(dirPath);
        }
    }

    // 恢复备份
    restoreBackup(backupTimestamp) {
        try {
            const backupPath = path.join(this.backupDir, backupTimestamp);
            
            if (!fs.existsSync(backupPath)) {
                throw new Error(`备份不存在: ${backupTimestamp}`);
            }
            
            // 恢复JSON文件
            const files = ['registrations.json', 'contacts.json'];
            let restoredFiles = 0;
            
            files.forEach(filename => {
                const backupFilePath = path.join(backupPath, filename);
                const targetPath = path.join(this.dataDir, filename);
                
                if (fs.existsSync(backupFilePath)) {
                    fs.copyFileSync(backupFilePath, targetPath);
                    restoredFiles++;
                    logger.info(`恢复文件: ${filename}`, { 
                        backup: backupFilePath, 
                        target: targetPath 
                    });
                }
            });
            
            // 恢复上传文件
            const backupUploadsDir = path.join(backupPath, 'uploads');
            const uploadsDir = path.join(__dirname, '../uploads');
            
            if (fs.existsSync(backupUploadsDir)) {
                if (fs.existsSync(uploadsDir)) {
                    this.deleteDirectory(uploadsDir);
                }
                this.copyDirectory(backupUploadsDir, uploadsDir);
                logger.info('恢复上传文件目录');
            }
            
            logger.info(`备份恢复完成`, { 
                backupTimestamp, 
                filesRestored: restoredFiles 
            });
            
            return { success: true, filesCount: restoredFiles };
            
        } catch (error) {
            logger.error('恢复备份失败', error, { backupTimestamp });
            return { success: false, error: error.message };
        }
    }

    // 获取备份列表
    getBackupList() {
        try {
            const backups = fs.readdirSync(this.backupDir)
                .filter(name => fs.statSync(path.join(this.backupDir, name)).isDirectory())
                .map(name => {
                    const backupPath = path.join(this.backupDir, name);
                    const stats = fs.statSync(backupPath);
                    
                    // 计算备份大小
                    let size = 0;
                    const calculateSize = (dirPath) => {
                        const files = fs.readdirSync(dirPath);
                        files.forEach(file => {
                            const filePath = path.join(dirPath, file);
                            const fileStats = fs.statSync(filePath);
                            if (fileStats.isDirectory()) {
                                calculateSize(filePath);
                            } else {
                                size += fileStats.size;
                            }
                        });
                    };
                    calculateSize(backupPath);
                    
                    return {
                        timestamp: name,
                        date: stats.mtime,
                        size: this.formatBytes(size),
                        path: backupPath
                    };
                })
                .sort((a, b) => b.date - a.date);
            
            return backups;
            
        } catch (error) {
            logger.error('获取备份列表失败', error);
            return [];
        }
    }

    // 格式化字节大小
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 创建备份管理器实例
const backupManager = new BackupManager();

// 自动备份（每天凌晨2点）
const scheduleBackup = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0); // 设置为明天凌晨2点
    
    const timeUntilBackup = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
        backupManager.createBackup();
        // 设置每24小时执行一次
        setInterval(() => {
            backupManager.createBackup();
        }, 24 * 60 * 60 * 1000);
    }, timeUntilBackup);
    
    logger.info(`自动备份已安排，下次备份时间: ${tomorrow.toLocaleString()}`);
};

// 启动自动备份
scheduleBackup();

module.exports = backupManager;