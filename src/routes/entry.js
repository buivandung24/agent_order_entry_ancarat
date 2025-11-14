// src/routes/entry.js
const express = require('express');
const router = express.Router();
const { getAgents, getProducts, appendOrder, config } = require('../googleSheets');

router.get('/', async (req, res) => {
  // KIỂM TRA CẤU HÌNH
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
    const userName = req.body.user_name || 'Kế toán';

    const agentKeys = Object.keys(req.body).filter(k => k.startsWith('agent_'));
    
    for (const key of agentKeys) {
      const index = key.split('_')[1];
      const agent = req.body[`agent_${index}`];
      const product = req.body[`product_${index}`];
      const qty = parseInt(req.body[`qty_${index}`]) || 0;

      if (!agent || !product || qty <= 0) continue;

      const products = await getProducts();
      const productData = products.find(p => p.name === product);
      if (!productData) continue;

      lines.push({
        agent,
        product,
        price: productData.price,
        quantity: qty
      });
    }

    if (lines.length === 0) {
      throw new Error('Không có dữ liệu hợp lệ');
    }

    await appendOrder(lines, userName);
    res.redirect('/?success=1');
  } catch (e) {
    console.error('Lỗi submit:', e.message);
    res.redirect('/?error=' + encodeURIComponent(e.message));
  }
});

module.exports = router;