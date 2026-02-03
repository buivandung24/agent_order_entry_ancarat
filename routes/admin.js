const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { loadUsers, saveUsers } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const SESSION_CONFIG_PATH = path.join(__dirname, '../config/sessionConfig.json');

function loadSessionConfig() {
  try {
    if (fs.existsSync(SESSION_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(SESSION_CONFIG_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Lỗi đọc session config:', err.message);
  }
  return { minutes: 30 }; // mặc định
}

function saveSessionConfig(config) {
  try {
    const configDir = path.dirname(SESSION_CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(SESSION_CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Lỗi lưu session config:', err.message);
  }
}

router.get('/', (req, res) => {
  const data = loadUsers();
  const sessionConfig = loadSessionConfig();
  res.render('admin-dashboard', { 
    users: data.users,
    sessionConfig
  });
});

router.post('/add', (req, res) => {
  const { username, password, fullName } = req.body;
  const data = loadUsers();

  if (data.users.some(u => u.fullName === fullName)) {
    req.flash('error', 'Tên hiển thị đã tồn tại');
    return res.redirect('/admin');
  }

  const hashed = bcrypt.hashSync(password, 10);

  // Tính id mới: lấy max id hiện có + 1, nếu rỗng thì bắt đầu từ 1
  const maxId = data.users.length > 0 ? Math.max(...data.users.map(u => u.id)) : 0;
  const newId = maxId + 1;

  const newUser = {
    id: newId,
    username,
    password: hashed,
    fullName,
    role: 'user'
  };

  data.users.push(newUser);
  saveUsers(data);
  req.flash('success', 'Thêm user thành công');
  res.redirect('/admin');
});

router.post('/delete/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const data = loadUsers();
  data.users = data.users.filter(u => u.id !== id);
  saveUsers(data);
  req.flash('success', 'Xóa user thành công');
  res.redirect('/admin');
});

router.post('/set-session-time', (req, res) => {
  const minutes = parseInt(req.body.sessionMinutes);
  const isActive = parseInt(req.body.isActive);
  if (isNaN(minutes) || minutes < 1 || minutes > 120) {
    req.flash('error', 'Thời gian phải từ 1 đến 120 phút');
    return res.redirect('/admin');
  }
  saveSessionConfig({ minutes, isActive });
  req.flash('success', `Đã cập nhật thời gian phiên: ${minutes} phút`);
  req.flash('success', `Đã cập nhật trạng thái tạm ngưng: ${isActive ? 'Có' : 'Không'}`);
  res.redirect('/admin');
});

module.exports = router;