#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import http.server
import socketserver
import json
import os
import urllib.parse
import datetime
import csv
import io
from pathlib import Path

PORT = 8000
DATA_DIR = "data"
UPLOADS_DIR = "uploads"
REGISTRATIONS_FILE = os.path.join(DATA_DIR, "registrations.json")
CONTACTS_FILE = os.path.join(DATA_DIR, "contacts.json")

# 确保目录存在
Path(DATA_DIR).mkdir(exist_ok=True)
Path(UPLOADS_DIR).mkdir(exist_ok=True)

class RegistrationHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        # 处理CORS预检请求
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_POST(self):
        if self.path == '/submit-registration':
            self.handle_registration()
        elif self.path == '/api/contact':
            self.handle_contact()
        else:
            self.send_error(404)
    
    def do_DELETE(self):
        # 处理删除请求
        if self.path.startswith('/api/contacts/'):
            self.handle_delete_contact()
        else:
            self.send_error(404)
    
    def do_GET(self):
        if self.path == '/admin':
            # 重定向到新的顶峰教育管理系统
            self.send_response(301)
            self.send_header('Location', '/admin/index.html')
            self.end_headers()
        elif self.path == '/admin/':
            # 重定向到新的顶峰教育管理系统
            self.send_response(301)
            self.send_header('Location', '/admin/index.html')
            self.end_headers()
        elif self.path.startswith('/admin/') and self.path != '/admin':
            # 处理admin目录下的静态文件
            super().do_GET()
        elif self.path == '/api/registrations':
            self.serve_registrations_api()
        elif self.path == '/api/contacts':
            self.serve_contacts_api()
        elif self.path == '/api/stats':
            self.serve_stats_api()
        elif self.path.startswith('/api/trends'):
            self.serve_trends_api()
        else:
            # 默认处理静态文件
            super().do_GET()
    
    def handle_registration(self):
        try:
            # 获取POST数据
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            # 解析表单数据
            form_data = urllib.parse.parse_qs(post_data.decode('utf-8'))
            
            # 处理表单数据
            registration = {
                'id': int(datetime.datetime.now().timestamp() * 1000),
                'submitTime': datetime.datetime.now().isoformat(),
            }
            
            # 添加所有表单字段
            for key, value in form_data.items():
                registration[key] = value[0] if len(value) == 1 else value
            
            # 读取现有数据
            registrations = []
            if os.path.exists(REGISTRATIONS_FILE):
                with open(REGISTRATIONS_FILE, 'r', encoding='utf-8') as f:
                    registrations = json.load(f)
            
            # 添加新数据
            registrations.append(registration)
            
            # 保存数据
            with open(REGISTRATIONS_FILE, 'w', encoding='utf-8') as f:
                json.dump(registrations, f, ensure_ascii=False, indent=2)
            
            print(f"新的报名申请: {registration.get('name', '未知')} - ID: {registration['id']}")
            
            # 返回成功响应
            response = json.dumps({
                'success': True, 
                'message': '报名申请提交成功', 
                'id': registration['id']
            }, ensure_ascii=False)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response.encode('utf-8'))
            
        except Exception as e:
            print(f"处理报名申请时出错: {e}")
            error_response = json.dumps({
                'success': False, 
                'message': '服务器错误'
            }, ensure_ascii=False)
            
            self.send_response(500)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(error_response.encode('utf-8'))
    
    def serve_registrations_api(self):
        try:
            registrations = []
            if os.path.exists(REGISTRATIONS_FILE):
                with open(REGISTRATIONS_FILE, 'r', encoding='utf-8') as f:
                    registrations = json.load(f)
            
            # 按提交时间倒序排列
            registrations.sort(key=lambda x: x.get('submitTime', ''), reverse=True)
            
            response = json.dumps(registrations, ensure_ascii=False)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response.encode('utf-8'))
            
        except Exception as e:
            print(f"获取报名数据时出错: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write('{"error": "服务器错误"}'.encode('utf-8'))
    
    def handle_delete_contact(self):
        try:
            # 从URL中提取联系信息ID
            contact_id = self.path.split('/')[-1]
            
            # 读取现有联系数据
            contacts = []
            if os.path.exists(CONTACTS_FILE):
                with open(CONTACTS_FILE, 'r', encoding='utf-8') as f:
                    contacts = json.load(f)
            
            # 查找要删除的联系信息
            original_count = len(contacts)
            contacts = [c for c in contacts if str(c.get('id', c.get('timestamp', ''))) != contact_id]
            
            if len(contacts) == original_count:
                # 没有找到要删除的记录
                self.send_response(404)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write('{"error": "联系记录不存在"}'.encode('utf-8'))
                return
            
            # 保存更新后的数据
            with open(CONTACTS_FILE, 'w', encoding='utf-8') as f:
                json.dump(contacts, f, ensure_ascii=False, indent=2)
            
            print(f"删除联系记录: ID {contact_id}")
            
            # 返回成功响应
            response = json.dumps({"message": "联系记录删除成功"}, ensure_ascii=False)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response.encode('utf-8'))
            
        except Exception as e:
            print(f"删除联系记录时出错: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write('{"error": "删除失败"}'.encode('utf-8'))
    
    def handle_contact(self):
        try:
            # 获取POST数据
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            # 解析JSON数据
            contact_data = json.loads(post_data.decode('utf-8'))
            
            # 处理联系信息
            contact = {
                'id': int(datetime.datetime.now().timestamp() * 1000),
                'name': contact_data.get('name', ''),
                'phone': contact_data.get('phone', ''),
                'timestamp': contact_data.get('timestamp', datetime.datetime.now().isoformat()),
                'type': contact_data.get('type', 'contact'),
                'submitTime': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            
            # 保存到文件
            contacts = []
            if os.path.exists(CONTACTS_FILE):
                with open(CONTACTS_FILE, 'r', encoding='utf-8') as f:
                    contacts = json.load(f)
            
            contacts.append(contact)
            
            with open(CONTACTS_FILE, 'w', encoding='utf-8') as f:
                json.dump(contacts, f, ensure_ascii=False, indent=2)
            
            # 返回成功响应
            response = json.dumps({
                'success': True,
                'message': '联系信息提交成功',
                'id': contact['id']
            }, ensure_ascii=False)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response.encode('utf-8'))
            
        except Exception as e:
            print(f"处理联系信息时出错: {e}")
            error_response = json.dumps({
                'success': False,
                'message': '服务器错误'
            }, ensure_ascii=False)
            
            self.send_response(500)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(error_response.encode('utf-8'))
    
    def serve_contacts_api(self):
        try:
            contacts = []
            if os.path.exists(CONTACTS_FILE):
                with open(CONTACTS_FILE, 'r', encoding='utf-8') as f:
                    contacts = json.load(f)
            
            # 按提交时间倒序排列
            contacts.sort(key=lambda x: x.get('submitTime', ''), reverse=True)
            
            response = json.dumps(contacts, ensure_ascii=False)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response.encode('utf-8'))
            
        except Exception as e:
            print(f"获取联系数据时出错: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write('{"error": "服务器错误"}'.encode('utf-8'))
    
    def serve_stats_api(self):
        try:
            # 读取报名数据
            registrations = []
            if os.path.exists(REGISTRATIONS_FILE):
                with open(REGISTRATIONS_FILE, 'r', encoding='utf-8') as f:
                    registrations = json.load(f)
            
            # 读取联系数据
            contacts = []
            if os.path.exists(CONTACTS_FILE):
                with open(CONTACTS_FILE, 'r', encoding='utf-8') as f:
                    contacts = json.load(f)
            
            # 计算统计数据
            now = datetime.datetime.now()
            today = now.date()
            week_start = today - datetime.timedelta(days=today.weekday())
            month_start = today.replace(day=1)
            
            # 报名统计
            reg_today = 0
            reg_week = 0
            reg_month = 0
            course_stats = {}
            country_stats = {}
            
            for reg in registrations:
                submit_time = reg.get('submitTime', '')
                if submit_time:
                    try:
                        submit_date = datetime.datetime.fromisoformat(submit_time.replace('Z', '+00:00')).date()
                        if submit_date == today:
                            reg_today += 1
                        if submit_date >= week_start:
                            reg_week += 1
                        if submit_date >= month_start:
                            reg_month += 1
                    except:
                        pass
                
                # 统计课程
                course = reg.get('course', '其他')
                course_stats[course] = course_stats.get(course, 0) + 1
                
                # 统计国家分布
                country = reg.get('target_country', reg.get('projects', '其他'))
                if country:
                    # 处理多个项目的情况
                    if ',' in str(country):
                        countries = [c.strip() for c in str(country).split(',')]
                        for c in countries:
                            country_stats[c] = country_stats.get(c, 0) + 1
                    else:
                        country_stats[country] = country_stats.get(country, 0) + 1
                else:
                    country_stats['其他'] = country_stats.get('其他', 0) + 1
            
            # 联系统计
            contact_today = 0
            contact_week = 0
            contact_month = 0
            
            for contact in contacts:
                submit_time = contact.get('submitTime', '')
                if submit_time:
                    try:
                        submit_date = datetime.datetime.strptime(submit_time, '%Y-%m-%d %H:%M:%S').date()
                        if submit_date == today:
                            contact_today += 1
                        if submit_date >= week_start:
                            contact_week += 1
                        if submit_date >= month_start:
                            contact_month += 1
                    except:
                        pass
            
            stats = {
                'total': len(registrations),
                'today': reg_today,
                'thisWeek': reg_week,
                'thisMonth': reg_month,
                'byCourse': course_stats,
                'byCountry': country_stats,
                'contacts': {
                    'total': len(contacts),
                    'today': contact_today,
                    'thisWeek': contact_week,
                    'thisMonth': contact_month
                }
            }
            
            response = json.dumps(stats, ensure_ascii=False)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response.encode('utf-8'))
            
        except Exception as e:
            print(f"获取统计数据时出错: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write('{"error": "服务器错误"}'.encode('utf-8'))
    
    def serve_trends_api(self):
        try:
            # 解析查询参数
            from urllib.parse import urlparse, parse_qs
            parsed_url = urlparse(self.path)
            query_params = parse_qs(parsed_url.query)
            days = int(query_params.get('days', [7])[0])
            
            # 读取报名数据
            registrations = []
            if os.path.exists(REGISTRATIONS_FILE):
                with open(REGISTRATIONS_FILE, 'r', encoding='utf-8') as f:
                    registrations = json.load(f)
            
            # 计算趋势数据
            today = datetime.datetime.now().date()
            trends = []
            
            for i in range(days):
                date = today - datetime.timedelta(days=i)
                count = 0
                
                for reg in registrations:
                    submit_time = reg.get('submitTime', '')
                    if submit_time:
                        try:
                            submit_date = datetime.datetime.fromisoformat(submit_time.replace('Z', '+00:00')).date()
                            if submit_date == date:
                                count += 1
                        except:
                            pass
                
                trends.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'label': date.strftime('%m/%d'),
                    'count': count
                })
            
            # 反转数组，使最早的日期在前
            trends.reverse()
            
            response = json.dumps(trends, ensure_ascii=False)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(response.encode('utf-8'))
            
        except Exception as e:
            print(f"获取趋势数据时出错: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write('{"error": "服务器错误"}'.encode('utf-8'))
    
    def serve_admin_page(self):
        admin_html = '''
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
            font-weight: 600;
        }
        
        .tab.active {
            background: white;
            border-bottom-color: #3b82f6;
            color: #3b82f6;
        }
        
        .tab:hover {
            background: #f1f5f9;
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
            <h1>信息管理系统</h1>
            <p>西安顶峰国际教育中心</p>
        </div>
        
        <div class="tabs">
            <div class="tab active" onclick="switchTab('registrations')">报名信息</div>
            <div class="tab" onclick="switchTab('contacts')">联系信息</div>
        </div>
        
        <!-- 报名信息标签页 -->
        <div id="registrations" class="tab-content active">
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
        
        <!-- 联系信息标签页 -->
        <div id="contacts" class="tab-content">
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number" id="contactTotalCount">0</div>
                <div class="stat-label">总联系数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="contactTodayCount">0</div>
                <div class="stat-label">今日新增</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="contactWeekCount">0</div>
                <div class="stat-label">本周新增</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="contactMonthCount">0</div>
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
            <table id="contactDataTable">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>提交时间</th>
                        <th>姓名</th>
                        <th>电话</th>
                        <th>类型</th>
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
                const response = await fetch('/api/registrations');
                allData = await response.json();
                updateStats();
                renderTable(allData);
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
            
            const todayCount = allData.filter(item => 
                new Date(item.submitTime).toDateString() === today
            ).length;
            
            const weekCount = allData.filter(item => 
                new Date(item.submitTime) >= weekAgo
            ).length;
            
            const monthCount = allData.filter(item => 
                new Date(item.submitTime) >= monthAgo
            ).length;
            
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
            
            tbody.innerHTML = data.map(item => `
                <tr>
                    <td>${item.id}</td>
                    <td>${new Date(item.submitTime).toLocaleString('zh-CN')}</td>
                    <td>${item.name || '-'}</td>
                    <td>${item.gender || '-'}</td>
                    <td>${item.phone || '-'}</td>
                    <td>${item.email || '-'}</td>
                    <td>${item.projects || '-'}</td>
                    <td>${item.current_school || '-'}</td>
                    <td>
                        <button class="btn btn-primary action-btn" onclick="viewDetail(${item.id})">查看详情</button>
                    </td>
                </tr>
            `).join('');
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
        function viewDetail(id) {
            const item = allData.find(data => data.id === id);
            if (!item) return;
            
            const detailContent = document.getElementById('detailContent');
            detailContent.innerHTML = `
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">提交时间</div>
                        <div class="detail-value">${new Date(item.submitTime).toLocaleString('zh-CN')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">报名项目</div>
                        <div class="detail-value">${item.projects || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">姓名</div>
                        <div class="detail-value">${item.name || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">性别</div>
                        <div class="detail-value">${item.gender || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">民族</div>
                        <div class="detail-value">${item.ethnicity || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">电话</div>
                        <div class="detail-value">${item.phone || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">邮箱</div>
                        <div class="detail-value">${item.email || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">身份证号</div>
                        <div class="detail-value">${item.id_number || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">户籍所在地</div>
                        <div class="detail-value">${(item.province || '') + ' ' + (item.city || '')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">政治面貌</div>
                        <div class="detail-value">${item.political_status || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">家庭地址</div>
                        <div class="detail-value">${item.home_address || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">就读学校</div>
                        <div class="detail-value">${item.current_school || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">毕业时间</div>
                        <div class="detail-value">${item.graduation_time || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">学历</div>
                        <div class="detail-value">${item.education_level || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">是否有毕业证</div>
                        <div class="detail-value">${item.diploma || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">高考成绩</div>
                        <div class="detail-value">${item.gaokao_score || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">英语成绩</div>
                        <div class="detail-value">${item.english_score || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">意向国家</div>
                        <div class="detail-value">${item.target_country || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">意向专业</div>
                        <div class="detail-value">${item.target_major || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">父亲姓名</div>
                        <div class="detail-value">${item.father_name || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">父亲电话</div>
                        <div class="detail-value">${item.father_phone || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">母亲姓名</div>
                        <div class="detail-value">${item.mother_name || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">母亲电话</div>
                        <div class="detail-value">${item.mother_phone || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">其他联系电话</div>
                        <div class="detail-value">${item.emergency_contact || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">过敏史/病史</div>
                        <div class="detail-value">${item.medical_history || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">特别声明</div>
                        <div class="detail-value">${item.special_note || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">申请人签名</div>
                        <div class="detail-value">${item.applicant_signature || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">申请日期</div>
                        <div class="detail-value">${item.application_date || '-'}</div>
                    </div>
                </div>
            `;
            
            document.getElementById('detailModal').style.display = 'block';
        }
        
        // 关闭模态框
        function closeModal() {
            document.getElementById('detailModal').style.display = 'none';
        }
        
        // 刷新数据
        function refreshData() {
            loadData();
        }
        
        // 导出数据
        function exportData() {
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
                ].map(field => `"${field.toString().replace(/"/g, '""')}"`); // 处理CSV中的引号
                
                csvContent.push(row.join(','));
            });
            
            // 下载文件
            const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `报名数据_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        // 点击模态框外部关闭
        document.getElementById('detailModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
        
        // 标签页切换功能
        function switchTab(tabName) {
            // 隐藏所有标签内容
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // 移除所有标签的激活状态
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // 显示选中的标签内容
            document.getElementById(tabName).classList.add('active');
            
            // 激活选中的标签
            document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
            
            // 根据标签页加载对应数据
            if (tabName === 'registrations') {
                loadData();
            } else if (tabName === 'contacts') {
                loadContactData();
            }
        }
        
        // 联系信息相关变量和函数
        let allContactData = [];
        
        // 加载联系数据
        async function loadContactData() {
            try {
                const response = await fetch('/api/contacts');
                allContactData = await response.json();
                updateContactStats();
                renderContactTable(allContactData);
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
            
            document.getElementById('contactTotalCount').textContent = allContactData.length;
            document.getElementById('contactTodayCount').textContent = todayCount;
            document.getElementById('contactWeekCount').textContent = weekCount;
            document.getElementById('contactMonthCount').textContent = monthCount;
        }
        
        // 渲染联系表格
        function renderContactTable(data) {
            const tbody = document.getElementById('contactTableBody');
            tbody.innerHTML = '';
            
            data.forEach((item, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.id || index + 1}</td>
                    <td>${new Date(item.submitTime).toLocaleString('zh-CN')}</td>
                    <td>${item.name || '-'}</td>
                    <td>${item.phone || '-'}</td>
                    <td>预约探校</td>
                    <td>
                        <button class="btn btn-primary" onclick="viewContactDetail(${index})">查看详情</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
        
        // 查看联系详情
        function viewContactDetail(index) {
            const item = allContactData[index];
            document.getElementById('detailContent').innerHTML = `
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">提交时间</div>
                        <div class="detail-value">${new Date(item.submitTime).toLocaleString('zh-CN')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">姓名</div>
                        <div class="detail-value">${item.name || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">电话</div>
                        <div class="detail-value">${item.phone || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">类型</div>
                        <div class="detail-value">预约探校</div>
                    </div>
                </div>
            `;
            
            document.getElementById('detailModal').style.display = 'block';
        }
        
        // 刷新联系数据
        function refreshContactData() {
            loadContactData();
        }
        
        // 导出联系数据
        function exportContactData() {
            if (allContactData.length === 0) {
                alert('暂无数据可导出');
                return;
            }
            
            const headers = ['ID', '提交时间', '姓名', '电话', '类型'];
            const csvContent = [headers.join(',')];
            
            allContactData.forEach((item, index) => {
                const row = [
                    item.id || index + 1,
                    new Date(item.submitTime).toLocaleString('zh-CN'),
                    item.name || '',
                    item.phone || '',
                    '预约探校'
                ];
                csvContent.push(row.join(','));
            });
            
            const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `联系数据_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        // 联系信息搜索功能
        document.getElementById('contactSearchBox').addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const filteredData = allContactData.filter(item => 
                (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                (item.phone && item.phone.includes(searchTerm))
            );
            renderContactTable(filteredData);
        });
        
        // 页面加载时获取数据
        loadData();
        
        // 每30秒自动刷新一次数据
        setInterval(() => {
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab && activeTab.id === 'registrations') {
                loadData();
            } else if (activeTab && activeTab.id === 'contacts') {
                loadContactData();
            }
        }, 30000);
    </script>
</body>
</html>
        '''
        
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(admin_html.encode('utf-8'))

def main():
    try:
        with socketserver.TCPServer(("", PORT), RegistrationHandler) as httpd:
            print(f"\n🚀 服务器已启动！")
            print(f"📱 网站地址: http://localhost:{PORT}")
            print(f"📊 管理后台: http://localhost:{PORT}/admin")
            print(f"\n📋 使用说明:")
            print(f"   1. 访问 http://localhost:{PORT} 查看网站")
            print(f"   2. 点击\"点我报名\"按钮填写报名表单")
            print(f"   3. 访问 http://localhost:{PORT}/admin 查看所有报名信息")
            print(f"   4. 在管理后台可以搜索、查看详情、导出Excel")
            print(f"\n💾 数据存储位置: ./data/registrations.json")
            print(f"📁 上传文件位置: ./uploads/")
            print(f"\n按 Ctrl+C 停止服务器\n")
            
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 服务器已关闭")
    except Exception as e:
        print(f"启动服务器时出错: {e}")

if __name__ == "__main__":
    main()