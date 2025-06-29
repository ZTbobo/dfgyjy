// 安全配置文件
module.exports = {
  // Helmet 安全头配置
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: []
      },
      reportOnly: false
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: "no-referrer" },
    xssFilter: true
  },

  // 速率限制配置
  rateLimit: {
    global: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // 每个IP最多1000次请求
      message: {
        success: false,
        message: '请求过于频繁，请稍后再试',
        retryAfter: '请在 {{retryAfter}} 秒后重试'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req) => {
        return req.ip + ':' + (req.headers['user-agent'] || 'unknown');
      }
    },
    form: {
      windowMs: parseInt(process.env.FORM_LIMIT_WINDOW_MS) || 5 * 60 * 1000, // 5分钟
      max: parseInt(process.env.FORM_LIMIT_MAX_REQUESTS) || 5, // 每个IP最多5次表单提交
      message: {
        success: false,
        message: '表单提交过于频繁，请稍后再试',
        retryAfter: '请在 {{retryAfter}} 秒后重试'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: true
    },
    // 新增：API接口限制
    api: {
      windowMs: 1 * 60 * 1000, // 1分钟
      max: 60, // 每分钟最多60次API请求
      message: {
        success: false,
        message: 'API请求过于频繁，请稍后再试'
      },
      standardHeaders: true,
      legacyHeaders: false
    },
    // 新增：登录尝试限制
    login: {
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 5, // 每15分钟最多5次登录尝试
      message: {
        success: false,
        message: '登录尝试过于频繁，请稍后再试'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true
    }
  },

  // 文件上传安全配置
  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 5 * 1024 * 1024, // 5MB
    maxFiles: parseInt(process.env.UPLOAD_MAX_FILES) || 10, // 最多10个文件
    allowedTypes: (process.env.UPLOAD_ALLOWED_TYPES || 'jpeg,jpg,png,gif,pdf,doc,docx').split(','),
    destination: './uploads/',
    // 文件名安全处理
    filename: function(req, file, cb) {
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const ext = file.originalname.split('.').pop().toLowerCase();
      const safeName = `${timestamp}_${randomString}.${ext}`;
      cb(null, safeName);
    },
    fileFilter: function(req, file, cb) {
      const allowedMimes = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
      };
      
      // 检查MIME类型
      if (!allowedMimes[file.mimetype]) {
        return cb(new Error('不支持的文件类型'), false);
      }
      
      // 检查文件扩展名
      const ext = file.originalname.split('.').pop().toLowerCase();
      if (!this.allowedTypes.includes(ext)) {
        return cb(new Error('不支持的文件扩展名'), false);
      }
      
      // 检查文件名安全性
      const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
      if (dangerousChars.test(file.originalname)) {
        return cb(new Error('文件名包含非法字符'), false);
      }
      
      cb(null, true);
    },
    // 文件大小限制（按类型）
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
      files: 10, // 最多10个文件
      fields: 20, // 最多20个字段
      fieldNameSize: 100, // 字段名最大长度
      fieldSize: 1024 * 1024 // 字段值最大1MB
    }
  },

  // 输入验证规则
  validation: {
    name: {
      minLength: 2,
      maxLength: 50,
      pattern: /^[\u4e00-\u9fa5a-zA-Z\s·]+$/,
      sanitize: true, // 启用HTML转义
      trim: true // 自动去除首尾空格
    },
    phone: {
      pattern: /^1[3-9]\d{9}$/,
      sanitize: true,
      trim: true
    },
    email: {
      pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      maxLength: 254, // RFC 5321标准
      sanitize: true,
      trim: true,
      toLowerCase: true
    },
    message: {
      maxLength: 500,
      minLength: 1,
      sanitize: true,
      trim: true,
      // 禁止的内容模式
      forbiddenPatterns: [
        /<script[^>]*>.*?<\/script>/gi, // 脚本标签
        /javascript:/gi, // JavaScript协议
        /on\w+\s*=/gi, // 事件处理器
        /data:text\/html/gi // HTML数据URI
      ]
    },
    // 新增：身份证号验证
    idCard: {
      pattern: /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/,
      sanitize: true,
      trim: true
    },
    // 新增：学校名称验证
    school: {
      minLength: 2,
      maxLength: 100,
      pattern: /^[\u4e00-\u9fa5a-zA-Z0-9\s·（）()]+$/,
      sanitize: true,
      trim: true
    },
    // 新增：地址验证
    address: {
      minLength: 5,
      maxLength: 200,
      pattern: /^[\u4e00-\u9fa5a-zA-Z0-9\s·，,。.（）()#-]+$/,
      sanitize: true,
      trim: true
    },
    // 通用文本验证
    text: {
      maxLength: 100,
      sanitize: true,
      trim: true,
      forbiddenPatterns: [
        /<[^>]*>/g, // HTML标签
        /javascript:/gi,
        /vbscript:/gi,
        /on\w+\s*=/gi
      ]
    }
  },

  // CORS 配置
  cors: {
    origin: function(origin, callback) {
      const allowedOrigins = process.env.NODE_ENV === 'production'
        ? (process.env.ALLOWED_ORIGINS || 'https://yourdomain.com').split(',')
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
      
      // 允许无origin的请求（如移动应用）
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('不允许的CORS请求'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400 // 24小时
  },

  // 管理员认证配置
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'dingfeng2024',
    realm: 'Admin Area',
    // 会话配置
    session: {
      secret: process.env.SESSION_SECRET || 'your-secret-key-here',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production', // 生产环境使用HTTPS
        httpOnly: true, // 防止XSS
        maxAge: 24 * 60 * 60 * 1000, // 24小时
        sameSite: 'strict' // CSRF保护
      }
    },
    // JWT配置
    jwt: {
      secret: process.env.JWT_SECRET || 'your-jwt-secret-here',
      expiresIn: '24h',
      algorithm: 'HS256'
    },
    // 密码策略
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
      maxAge: 90 * 24 * 60 * 60 * 1000, // 90天
      preventReuse: 5 // 防止重复使用最近5个密码
    }
  },

  // 新增：安全监控配置
  monitoring: {
    // 异常行为检测
    anomalyDetection: {
      enabled: true,
      maxFailedAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15分钟
      trackingWindow: 60 * 60 * 1000 // 1小时
    },
    // 日志记录
    logging: {
      enabled: true,
      level: process.env.LOG_LEVEL || 'info',
      includeUserAgent: true,
      includeIP: true,
      sensitiveFields: ['password', 'token', 'secret'] // 敏感字段不记录
    }
  },

  // 新增：数据保护配置
  dataProtection: {
    // 数据加密
    encryption: {
      algorithm: 'aes-256-gcm',
      keyDerivation: 'pbkdf2',
      iterations: 100000
    },
    // 数据备份
    backup: {
      enabled: true,
      interval: 24 * 60 * 60 * 1000, // 24小时
      retention: 30, // 保留30天
      compression: true
    },
    // 隐私保护
    privacy: {
      anonymizeIP: true, // IP地址匿名化
      dataRetention: 365 * 24 * 60 * 60 * 1000, // 数据保留1年
      rightToErasure: true // 支持数据删除权
    }
  }
};