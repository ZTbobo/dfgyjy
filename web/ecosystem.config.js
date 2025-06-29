// PM2 生产环境配置文件
module.exports = {
  apps: [{
    name: 'dingfeng-education',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 80
    },
    // 日志配置
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // 监控配置
    monitoring: false,
    
    // 重启配置
    max_restarts: 10,
    min_uptime: '10s',
    
    // 内存限制
    max_memory_restart: '500M',
    
    // 自动重启
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'data'],
    
    // 优雅关闭
    kill_timeout: 5000,
    
    // 环境变量
    env_file: '.env'
  }]
};