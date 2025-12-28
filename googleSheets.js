const dayjs = require('dayjs');
require('dayjs/plugin/timezone');
require('dayjs/plugin/utc');
dayjs.extend(require('dayjs/plugin/timezone'));
dayjs.extend(require('dayjs/plugin/utc'));
require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const CONFIG_PATH = path.join(__dirname, '../config/settings.json');
let config = {
    banggia_sheet_id: process.env.BANGGIA_SHEET_ID || '',
    daily_sheet_id: process.env.DAILY_SHEET_ID || '',
    ketqua_sheet_id: process.env.KETQUA_SHEET_ID || '',
    product_api_url: process.env.PRODUCT_API_URL || '',
    service_account: process.env.SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.SERVICE_ACCOUNT_JSON) : {}
};

// Nếu không có .env → đọc file (cho local)
if (!process.env.BANGGIA_SHEET_ID && fs.existsSync(CONFIG_PATH)) {
    config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
}

// Hàm lưu config (chỉ hoạt động trên local)
function setConfig(newConfig) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Không thể lưu cấu hình trên production. Hãy dùng biến môi trường.');
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
    config = newConfig;
}

const auth = new google.auth.GoogleAuth({
    credentials: config.service_account,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Lấy danh sách sheet
async function getSheetTitles(spreadsheetId) {
    const res = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.title',
    });
    return res.data.sheets.map(s => s.properties.title);
}

// Tạo sheet mới nếu chưa có
async function ensureTodaySheet() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  const todayStr = `${day}_${month}_${year}`;
  const title = `Ket_Qua_${todayStr}`;

  const titles = await getSheetTitles(config.ketqua_sheet_id);

  let nextOrderNum = 1; // mặc định nếu chưa có đơn nào trong ngày

  if (titles.includes(title)) {
    // Đọc cột A từ dòng 2 trở đi (bỏ header)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.ketqua_sheet_id,
      range: `${title}!A2:A`
    });

    const values = res.data.values;

    if (values && values.length > 0) {
      const orderNumbers = values
        .flat()
        .filter(code => typeof code === 'string')
        .map(code => {
          // Cắt bỏ 8 ký tự cuối (DDMMYYYY) để lấy số thứ tự
          const numStr = code.slice(0, -8);
          const num = parseInt(numStr, 10);
          return isNaN(num) ? 0 : num;
        })
        .filter(num => num > 0);

      if (orderNumbers.length > 0) {
        const maxNum = Math.max(...orderNumbers);
        nextOrderNum = maxNum + 1;
      }
    }
  } else {
    // Tạo sheet mới + header
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.ketqua_sheet_id,
      requestBody: {
        requests: [{
          addSheet: { properties: { title } }
        }]
      }
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.ketqua_sheet_id,
      range: `${title}!A1:O1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          'Mã đơn hàng',
          'Tên đại lý',
          'Chiết khấu (%)',
          'Tên sản phẩm',
          'Giá chốt',
          'Giá hiện tại',
          'Số lượng',
          'Tổng tiền (Giá chốt)',
          'Tiền CK (Giá chốt)',
          'Thành tiền (Giá chốt)',
          'Tổng tiền (Giá hiện tại)',
          'Tiền CK (Giá hiện tại)',
          'Thành tiền (Giá hiện tại)',
          'Người nhập',
          'Thời gian'
        ]]
      }
    });
  }

  return { title, nextOrderNum };
}

async function fetchCurrentPrices(productNames) {
    if (!config.product_api_url) {
        throw new Error('Chưa cấu hình PRODUCT_API_URL');
    }

    try {
        const response = await fetch(config.product_api_url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json(); // [[name, sell_price, buy_price], ...]

        const priceMap = new Map();
        data.forEach(row => {
            if (Array.isArray(row) && row.length >= 2) {
                const name = (row[0] || '').toString().trim();
                const sellPriceStr = (row[1] || '0').toString().replace(/,/g, '');
                const price = parseFloat(sellPriceStr) || 0;
                if (name) {
                    priceMap.set(name.toLowerCase(), price);
                }
            }
        });

        // Trả về giá hiện tại cho từng sản phẩm yêu cầu
        const result = {};
        productNames.forEach(name => {
            result[name.toLowerCase()] = priceMap.get(name.toLowerCase()) || null;
        });
        return result;
    } catch (e) {
        console.error('Lỗi gọi API giá hiện tại:', e.message);
        throw new Error('Không thể lấy giá hiện tại từ API');
    }
}

// Lấy danh sách đại lý
async function getAgents() {
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: config.daily_sheet_id,
            range: 'Dai_Ly!A2:B',
        });
        const rows = res.data.values || [];
        return rows.map(row => {
            const name = (row[0] || '').toString().trim();
            let discountStr = (row[1] || '0').toString().trim();
            
            discountStr = discountStr.replace(/,/g, '.');
            
            const discount = parseFloat(discountStr) || 0;
            return { name, discount };
        }).filter(a => a.name);
    } catch (e) {
        console.error('Lỗi lấy đại lý và chiết khấu:', e.message);
        return [];
    }
}

// Lấy danh sách sản phẩm
async function getProducts() {
    if (!config.product_api_url) {
        throw new Error('Chưa cấu hình URL API sản phẩm');
    }

    try {
        const response = await fetch(config.product_api_url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();

        const products = [];
        for (const row of data) {
            if (Array.isArray(row) && row[1] !== "" && row.length >= 3) {
                const name = (row[0] || '').toString().trim();
                const priceSellStr = (row[1] || '0').toString().replace(/,/g, '').trim();
                const price = parseFloat(priceSellStr) || 0;
                if (name) {
                    products.push({ name, price });
                }
            }
        }
        return products;
    } catch (e) {
        console.error('Lỗi lấy sản phẩm từ API:', e.message);
        throw new Error('Không thể lấy danh sách sản phẩm từ API: ' + e.message);
    }
}

// Ghi đơn hàng
async function appendOrder(lines, userName) {
  const { title, nextOrderNum } = await ensureTodaySheet();

  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();

  const orderCode = `${nextOrderNum}${day}${month}${year}`;

  const uniqueProductNames = [...new Set(lines.map(line => line.product.trim()))];
  const currentPrices = await fetchCurrentPrices(uniqueProductNames);

  const vnTime = dayjs().tz('Asia/Ho_Chi_Minh');
  const timeStr = vnTime.format('HH:mm');

  const values = lines.map(line => {
    const productLower = line.product.trim().toLowerCase();
    const currentPrice = currentPrices[productLower] || 0;

    const totalOld = line.price * line.quantity;
    const discountAmountOld = totalOld * (line.discountPercent / 100);
    const finalOld = totalOld - discountAmountOld;

    const totalNew = currentPrice * line.quantity;
    const discountAmountNew = totalNew * (line.discountPercent / 100);
    const finalNew = totalNew - discountAmountNew;

    return [
      orderCode,
      line.agent.trim(),
      line.discountPercent || 0,
      line.product.trim(),
      line.price,
      currentPrice || '',
      line.quantity,
      totalOld,
      discountAmountOld,
      finalOld,
      totalNew,
      discountAmountNew,
      finalNew,
      userName,
      timeStr
    ];
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.ketqua_sheet_id,
    range: `${title}!A:O`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values }
  });

  return orderCode;
}

module.exports = {
  getAgents,
  getProducts,
  appendOrder,
  get config() { return config; },
  setConfig
};