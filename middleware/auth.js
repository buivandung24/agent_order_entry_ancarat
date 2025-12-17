const fs = require('fs');
const path = require('path');
const usersData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/users.json')));

function loadUsers() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../data/users.json')));
}

function saveUsers(data) {
  fs.writeFileSync(path.join(__dirname, '../data/users.json'), JSON.stringify(data, null, 2));
}

module.exports = {
  requireLogin: (req, res, next) => {
    if (req.path === '/login' || req.path.startsWith('/login?')) {
      return next();
    }
    if (!req.session.user) {
      return res.redirect('/login');
    }
    next();
  },

  requireAdmin: (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
      req.flash('error', 'Bạn không có quyền truy cập trang này');
      return res.redirect('/');
    }
    next();
  },

  getCurrentUser: (req) => {
    return req.session.user || null;
  },

  loadUsers,
  saveUsers
};