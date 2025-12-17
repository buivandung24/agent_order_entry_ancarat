const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { loadUsers, saveUsers } = require('../middleware/auth');

router.get('/', (req, res) => {
  const data = loadUsers();
  res.render('admin-dashboard', { users: data.users });
});

router.post('/add', (req, res) => {
  const { username, password, fullName, role } = req.body;
  const data = loadUsers();

  if (data.users.some(u => u.username === username)) {
    req.flash('error', 'Tên đăng nhập đã tồn tại');
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
    role: role || 'user'
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

module.exports = router;