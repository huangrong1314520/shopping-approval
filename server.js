/**
 * 朋友购物审批站 - 后端服务器
 * 纯 Node.js 实现，无需安装任何依赖
 * 功能：数据持久化 + SSE实时同步 + 注册登录
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const HTML_FILE = path.join(__dirname, '朋友购物审批站.html');

/* ===== 数据存储 ===== */
let data = {
  members: [
    { id: 'm1', name: '桔梗', avatar: '🌸', isApplicant: true, isApprover: true, isAdmin: true, pin: '1234' }
  ],
  requests: []
};

// 加载已保存的数据
try {
  if (fs.existsSync(DATA_FILE)) {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    if (saved && saved.members && saved.requests) {
      data = saved;
    }
  }
} catch (e) {
  console.error('加载数据失败:', e.message);
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('保存数据失败:', e.message);
  }
}

/* ===== SSE 客户端管理 ===== */
const sseClients = [];

function getSafeData() {
  return {
    members: data.members.map(function(m) {
      return {
        id: m.id, name: m.name, avatar: m.avatar,
        isApplicant: m.isApplicant, isApprover: m.isApprover, isAdmin: m.isAdmin
      };
    }),
    requests: data.requests
  };
}

function broadcastUpdate() {
  var safe = getSafeData();
  var msg = 'data: ' + JSON.stringify({ type: 'update', data: safe }) + '\n\n';
  sseClients.forEach(function(res) {
    try { res.write(msg); } catch (e) {}
  });
}

/* ===== POST 请求体解析 ===== */
function parseBody(req) {
  return new Promise(function(resolve, reject) {
    var body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

/* ===== HTTP 服务器 ===== */
const server = http.createServer(async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  var url;
  try { url = new URL(req.url, 'http://localhost'); }
  catch (e) { res.writeHead(400); res.end('Bad request'); return; }

  /* --- 首页：返回 HTML --- */
  if (url.pathname === '/' || url.pathname === '/index.html') {
    try {
      var html = fs.readFileSync(HTML_FILE, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>请先创建 朋友购物审批站.html 文件</h1>');
    }
    return;
  }

  /* --- SSE 实时推送 --- */
  if (url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write('data: ' + JSON.stringify({ type: 'init', data: getSafeData() }) + '\n\n');
    sseClients.push(res);
    // 发送心跳保活
    var heartbeat = setInterval(function() {
      try { res.write(': heartbeat\n\n'); } catch (e) { clearInterval(heartbeat); }
    }, 30000);
    req.on('close', function() {
      clearInterval(heartbeat);
      var idx = sseClients.indexOf(res);
      if (idx >= 0) sseClients.splice(idx, 1);
    });
    return;
  }

  /* --- 注册 --- */
  if (url.pathname === '/api/register' && req.method === 'POST') {
    try {
      var body = await parseBody(req);
      var name = (body.name || '').trim();
      var avatar = body.avatar || '🐱';
      var pin = (body.pin || '').trim();

      if (!name) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: '请输入昵称' })); return; }
      if (name.length > 10) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: '昵称最多10个字' })); return; }
      if (!pin || pin.length !== 4) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'PIN码必须是4位数字' })); return; }
      if (data.members.find(function(m) { return m.name === name; })) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '这个名字已被使用' }));
        return;
      }

      var id = 'm' + Date.now();
      data.members.push({
        id: id, name: name, avatar: avatar,
        isApplicant: true, isApprover: true, isAdmin: false,
        pin: pin
      });
      saveData();
      broadcastUpdate();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ userId: id }));
    } catch (e) {
      res.writeHead(500); res.end('Server error');
    }
    return;
  }

  /* --- 登录 --- */
  if (url.pathname === '/api/login' && req.method === 'POST') {
    try {
      var body = await parseBody(req);
      var name = (body.name || '').trim();
      var pin = (body.pin || '').trim();

      var member = data.members.find(function(m) { return m.name === name; });
      if (!member) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '用户不存在' }));
        return;
      }
      if (member.pin !== pin) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'PIN码不正确' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ userId: member.id }));
    } catch (e) {
      res.writeHead(500); res.end('Server error');
    }
    return;
  }

  /* --- 操作动作 --- */
  if (url.pathname === '/api/action' && req.method === 'POST') {
    try {
      var body = await parseBody(req);
      var type = body.type;
      var userId = body.userId;
      var user = data.members.find(function(m) { return m.id === userId; });

      if (!user) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '用户未登录' }));
        return;
      }

      var error = null;

      switch (type) {
        case 'addRequest':
          if (!user.isApplicant) { error = '你不是申请人，无法发起申请'; break; }
          if (!body.item || !body.item.trim()) { error = '请填写物品名称'; break; }
          if (!body.price || Number(body.price) <= 0) { error = '请填写有效价格'; break; }
          if (!body.reason || !body.reason.trim()) { error = '请填写购买理由'; break; }
          data.requests.unshift({
            id: 'r' + Date.now(),
            applicantId: user.id, applicantName: user.name, applicantAvatar: user.avatar,
            item: body.item.trim(), price: Number(body.price),
            reason: body.reason.trim(), link: body.link || '',
            status: 'pending',
            votes: [],
            approverId: null, approverName: null, approverAvatar: null, comment: null,
            createdAt: Date.now(), decidedAt: null
          });
          break;

        case 'decideRequest':
          {
            var req = data.requests.find(function(r) { return r.id === body.requestId; });
            if (!req || req.status !== 'pending') { error = '该申请已处理，无法重复操作'; break; }
            if (req.applicantId === user.id) { error = '不能审批自己的申请'; break; }
            if (req.votes && req.votes.find(function(v) { return v.userId === user.id; })) {
              error = '你已经投过票了'; break;
            }
            /* 会签模式：首票决定结果 */
            req.votes = req.votes || [];
            req.votes.push({
              userId: user.id, userName: user.name, userAvatar: user.avatar,
              decision: body.decision, comment: body.comment || '',
              votedAt: Date.now()
            });
            req.status = body.decision;
            req.approverId = user.id;
            req.approverName = user.name;
            req.approverAvatar = user.avatar;
            req.comment = body.comment || '';
            req.decidedAt = Date.now();
          }
          break;

        case 'addMember':
          if (!body.name || !body.name.trim()) { error = '请输入昵称'; break; }
          if (data.members.find(function(m) { return m.name === body.name.trim(); })) { error = '名字已存在'; break; }
          data.members.push({
            id: 'm' + Date.now(),
            name: body.name.trim(), avatar: body.avatar || '🐱',
            isApplicant: true,
            isApprover: true,
            isAdmin: false,
            pin: body.pin || '0000'
          });
          break;

        case 'removeMember':
          {
            var member = data.members.find(function(m) { return m.id === body.id; });
            if (member && member.isAdmin) { error = '管理员不可删除'; break; }
            if (data.members.length <= 1) { error = '至少保留一个成员'; break; }
            data.members = data.members.filter(function(m) { return m.id !== body.id; });
          }
          break;

        case 'toggleMemberRole':
          {
            var member = data.members.find(function(m) { return m.id === body.id; });
            if (!member) { error = '成员不存在'; break; }
            if (member.isAdmin && (body.role === 'isApplicant' || body.role === 'isApprover')) {
              member[body.role] = !member[body.role];
              break;
            }
            member[body.role] = !member[body.role];
            if (!member.isApplicant && !member.isApprover) {
              member[body.role] = true;
            }
          }
          break;

        case 'updateMemberName':
          {
            if (!body.name || !body.name.trim()) { error = '名称不能为空'; break; }
            var member = data.members.find(function(m) { return m.id === body.id; });
            if (member) member.name = body.name.trim();
          }
          break;

        case 'deleteRequest':
          if (!user.isAdmin) { error = '仅管理员可删除记录'; break; }
          data.requests = data.requests.filter(function(r) { return r.id !== body.id; });
          break;

        case 'clearAllData':
          if (!user.isAdmin) { error = '仅管理员可清空数据'; break; }
          var admin = data.members.find(function(m) { return m.isAdmin; });
          data.members = admin ? [admin] : [];
          data.requests = [];
          break;

        default:
          error = '未知操作: ' + type;
      }

      if (error) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error }));
        return;
      }

      saveData();
      broadcastUpdate();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (e) {
      console.error('操作错误:', e);
      res.writeHead(500); res.end('Server error');
    }
    return;
  }

  /* --- 404 --- */
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, function() {
  console.log('');
  console.log('🌸 朋友购物审批站 服务已启动');
  console.log('   本地访问: http://localhost:' + PORT);
  console.log('   按 Ctrl+C 停止服务');
  console.log('');
});
