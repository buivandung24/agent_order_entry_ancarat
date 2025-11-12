const express = require('express');
const router = express.Router();
const { getAgents, getProducts, appendOrder } = require('../googleSheets');

router.get('/', async (req, res) => {
  const [agents, products] = await Promise.all([getAgents(), getProducts()]);
  res.render('index', { agents, products, success: req.query.success });
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

      // Tìm giá sản phẩm
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