const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { loadUsers } = require('../middleware/auth');
const flash = require('connect-flash');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login');
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const data = loadUsers();
  const user = data.users.find(u => u.username === username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    req.flash('error', 'Tên đăng nhập hoặc mật khẩu sai');
    return res.redirect('/login');
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role
  };

  req.flash('success', `Chào mừng ${user.fullName}`);
  res.redirect('/');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;