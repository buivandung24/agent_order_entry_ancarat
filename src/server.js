require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

app.use('/', require('./routes/entry'));
app.use('/config', require('./routes/config'));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`→ Nhập đơn: http://localhost:${PORT}`);
  console.log(`→ Cấu hình: http://localhost:${PORT}/config`);
});

