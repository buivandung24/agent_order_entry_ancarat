require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');

// === TỰ ĐỘNG TẠO TÀI KHOẢN ADMIN MẶC ĐỊNH ===
const { loadUsers, saveUsers } = require('./middleware/auth');
const bcrypt = require('bcrypt');

(function createDefaultAdmin() {
  const data = loadUsers();
  const adminExists = data.users.some(u => u.username === 'ancarat_manager_2025');

  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('Anc@rat!_Secure#2025', 10);
    const adminUser = {
      id: data.users.length > 0 ? Math.max(...data.users.map(u => u.id)) + 1 : 1,
      username: 'ancarat_manager_2025',
      password: hashedPassword,
      fullName: 'admin',
      role: 'admin'
    };

    data.users.push(adminUser);
    saveUsers(data);
    console.log('Đã tự động tạo tài khoản admin mặc định (username: ancarat_manager_2025, password: Anc@rat!_Secure#2025)');
  } else {
    console.log('Tài khoản admin đã tồn tại');
  }
})();

const { requireLogin, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecretkey123',
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success');
  res.locals.error_msg = req.flash('error');
  res.locals.user = req.session.user || null;
  next();
});


app.use('/', require('./routes/auth'));  
app.use('/', requireLogin, require('./routes/entry'));
app.use('/admin', requireLogin, requireAdmin, require('./routes/admin'));
app.use('/config', requireLogin, requireAdmin, require('./routes/config'));
app.use('/api', require('./routes/api'));
app.use('/mua-lai', requireLogin, require('./routes/muaLai'));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`→ Nhập đơn: http://localhost:${PORT}`);
  console.log(`→ Cấu hình: http://localhost:${PORT}/config`);
});

