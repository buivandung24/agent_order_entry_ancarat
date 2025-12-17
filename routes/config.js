const express = require('express');
const router = express.Router();
const { setConfig, config } = require('../googleSheets');
const fs = require('fs');
const path = require('path');

router.get('/', (req, res) => {
  res.render('config', { config });
});

router.post('/', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.redirect('/config?error=' + encodeURIComponent(
      'Không thể lưu cấu hình trên production. Vui lòng cấu hình qua biến môi trường.'
    ));
  }
  
  try {
    const { banggia_sheet_id, daily_sheet_id, ketqua_sheet_id } = req.body;
    let service_account = config.service_account;

    if (req.files && req.files.service_account_json) {
      const file = req.files.service_account_json;
      const content = file.data.toString('utf8');
      service_account = JSON.parse(content);
    }

    const newConfig = {
      banggia_sheet_id: banggia_sheet_id.trim(),
      daily_sheet_id: daily_sheet_id.trim(),
      ketqua_sheet_id: ketqua_sheet_id.trim(),
      service_account
    };

    setConfig(newConfig);
    res.redirect('/config?success=1');
  } catch (e) {
    res.redirect('/config?error=' + encodeURIComponent(e.message));
  }
});

module.exports = router;