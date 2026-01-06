const express = require('express');
const router = express.Router();
const { getAgents, getProducts, appendOrderMuaLai, config } = require('../googleSheets');
const { sendOrderToDiscord } = require('../utils/discord');
const path = require('path');
const fs = require('fs');
const SESSION_CONFIG_PATH = path.join(__dirname, '../config/sessionConfig.json');

function getSessionMinutes() {
  try {
    if (fs.existsSync(SESSION_CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(SESSION_CONFIG_PATH, 'utf8'));
      return data.minutes || 5;
    }
  } catch (e) {
    console.error('Lỗi đọc session config:', e.message);
  }
  return 5;
}

router.get('/', async (req, res) => {
  if (!config.banggia_sheet_id || !config.daily_sheet_id || !config.ketqua_sheet_id || !Object.keys(config.service_account).length) {
    return res.redirect('/config?error=' + encodeURIComponent('Vui lòng cấu hình Google Sheets trước khi sử dụng.'));
  }

  const sessionMinutes = getSessionMinutes();

  const endTime = new Date(Date.now() + sessionMinutes * 60 * 1000);
  req.session.sessionEndTime = endTime.toISOString();
  req.session.sessionMinutes = sessionMinutes;

  try {
    const products = await getProducts();
    res.render('mua-lai', { 
      products, 
      success: req.query.success,
      error: req.query.error,
      sessionMinutes: req.session.sessionMinutes || sessionMinutes,
      sessionEndTime: req.session.sessionEndTime
    });
  } catch (e) {
    console.error('Lỗi load trang mua lại:', e.message);
    res.redirect('/config?error=' + encodeURIComponent('Lỗi kết nối Google Sheets: ' + e.message));
  }
});

router.post('/submit', async (req, res) => {
  try {
    const lines = [];
    const userName = req.session.user?.fullName || 'Unknown';

    const customer = req.body.selected_agent?.trim(); // Thay agent thành customer
    const customerDiscount = 0.5; // Mặc định 0.5%

    if (!customer) {
      throw new Error('Chưa nhập tên khách hàng');
    }

    const productKeys = Object.keys(req.body).filter(k => k.startsWith('product_'));

    for (const key of productKeys) {
      const index = key.split('_')[1];
      const product = req.body[`product_${index}`]?.trim();
      const qty = parseInt(req.body[`qty_${index}`]) || 0;
      const priceChot = parseFloat(req.body[`price_${index}`]) || 0;
      const note = req.body[`note_${index}`]?.trim() || '';

      if (!product || qty <= 0 || priceChot <= 0) continue;

      lines.push({
        agent: customer, // Sử dụng customer thay agent
        product,
        price: priceChot,
        quantity: qty,
        discountPercent: customerDiscount,
        total: priceChot * qty,
        discountAmount: (priceChot * qty) * (customerDiscount / 100),
        finalAmount: (priceChot * qty) * (1 - customerDiscount / 100),
        note
      });
    }

    if (lines.length === 0) {
      throw new Error('Không có sản phẩm hợp lệ');
    }

    const orderCode = await appendOrderMuaLai(lines, userName); // Gọi hàm mới cho mua lại

    // Discord notification (giữ nguyên, nhưng có thể chỉnh title nếu cần)
    const vnTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    await sendOrderToDiscord({
      orderCode,
      agent: customer,
      discountPercent: customerDiscount,
      lines: lines.map(l => ({
        product: l.product,
        price: l.price,
        quantity: l.quantity,
        total: l.total,
        discountAmount: l.discountAmount,
        finalAmount: l.finalAmount,
        note: l.note || ''
      })),
      userName,
      createdAt: vnTime,
      orderType: 'mua'
    });

    res.redirect(`/mua-lai?success=1&orderCode=${orderCode}`);
  } catch (e) {
    console.error('Lỗi submit mua lại:', e.message);
    res.redirect('/mua-lai?error=' + encodeURIComponent(e.message));
  }
});

module.exports = router;