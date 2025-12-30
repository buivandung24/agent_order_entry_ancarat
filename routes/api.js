const express = require('express');
const router = express.Router();
const { getProducts } = require('../googleSheets');
const fs = require('fs');
const path = require('path');

const SESSION_CONFIG_PATH = path.join(__dirname, '../config/sessionConfig.json');

function getSessionMinutes() {
  try {
    if (fs.existsSync(SESSION_CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(SESSION_CONFIG_PATH, 'utf8'));
      return data.minutes || 30;
    }
  } catch (e) {
    return 30;
  }
  return 30;
}

// API lấy sản phẩm mới
router.get('/products', async (req, res) => {
  try {
    const products = await getProducts();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API mới: reset phiên và trả về thời gian mới
router.post('/reset-session', (req, res) => {
  const sessionMinutes = getSessionMinutes(); // hàm bạn đã có

  const endTime = new Date(Date.now() + sessionMinutes * 60 * 1000);
  req.session.sessionEndTime = endTime.toISOString();
  req.session.sessionMinutes = sessionMinutes;

  // TRẢ VỀ JSON CHÍNH XÁC
  res.json({
    success: true,
    sessionEndTime: endTime.toISOString(),
    sessionMinutes: sessionMinutes
  });
});

module.exports = router;