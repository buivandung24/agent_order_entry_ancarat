const express = require('express');
const router = express.Router();
const { getAgents, getProducts, appendOrder, config } = require('../googleSheets');
const { sendOrderToDiscord } = require('../utils/discord');

router.get('/', async (req, res) => {
  if (!config.banggia_sheet_id || !config.daily_sheet_id || !config.ketqua_sheet_id || !Object.keys(config.service_account).length) {
    return res.redirect('/config?error=' + encodeURIComponent('Vui lòng cấu hình Google Sheets trước khi sử dụng.'));
  }

  try {
    const [agents, products] = await Promise.all([getAgents(), getProducts()]);
    res.render('index', { 
      agents, 
      products, 
      success: req.query.success,
      error: req.query.error 
    });
  } catch (e) {
    console.error('Lỗi load trang nhập đơn:', e.message);
    res.redirect('/config?error=' + encodeURIComponent('Lỗi kết nối Google Sheets: ' + e.message));
  }
});

router.post('/submit', async (req, res) => {
  try {
    const lines = [];
    const userName = req.session.user?.fullName || 'Unknown';

    const agent = req.body.selected_agent?.trim();
    const agentDiscount = parseFloat(req.body.selected_discount_percent) || 0;

    if (!agent) {
      throw new Error('Chưa chọn đại lý');
    }

    const productKeys = Object.keys(req.body).filter(k => k.startsWith('product_'));

    for (const key of productKeys) {
      const index = key.split('_')[1];
      const product = req.body[`product_${index}`]?.trim();
      const qty = parseInt(req.body[`qty_${index}`]) || 0;
      const priceChot = parseFloat(req.body[`price_${index}`]) || 0;

      if (!product || qty <= 0 || priceChot <= 0) continue;

      lines.push({
        agent,
        product,
        price: priceChot,
        quantity: qty,
        discountPercent: agentDiscount,
        total: priceChot * qty,
        discountAmount: (priceChot * qty) * (agentDiscount / 100),
        finalAmount: (priceChot * qty) * (1 - agentDiscount / 100)
      });
    }

    if (lines.length === 0) {
      throw new Error('Không có sản phẩm hợp lệ');
    }

    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();

    const orderCode = await appendOrder(lines, userName);

    //discord notification
    const vnTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    await sendOrderToDiscord({
      orderCode,
      agent,
      discountPercent: agentDiscount,
      lines: lines.map(l => ({
        product: l.product,
        price: l.price,
        quantity: l.quantity,
        total: l.total,
        discountAmount: l.discountAmount,
        finalAmount: l.finalAmount
      })),
      userName,
      createdAt: vnTime
    });

    res.redirect(`/?success=1&orderCode=${orderCode}`);
  } catch (e) {
    console.error('Lỗi submit:', e.message);
    res.redirect('/?error=' + encodeURIComponent(e.message));
  }
});

module.exports = router;