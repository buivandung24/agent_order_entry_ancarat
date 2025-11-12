const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../config/settings.json');
let config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

const auth = new google.auth.GoogleAuth({
    credentials: config.service_account,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Đọc lại config khi cần
function reloadConfig() {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

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
    const today = new Date().toLocaleDateString('vi-VN').replace(/\//g, '_'); // 11_11_25
    const title = `Ket_Qua_${today}`;
    const titles = await getSheetTitles(config.ketqua_sheet_id);

    if (!titles.includes(title)) {
        await sheets.spreadsheets.batchUpdate({
        spreadsheetId: config.ketqua_sheet_id,
        requestBody: {
            requests: [{
            addSheet: { properties: { title } }
            }]
        }
        });

        // Ghi header
        await sheets.spreadsheets.values.update({
        spreadsheetId: config.ketqua_sheet_id,
        range: `${title}!A1:F1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Tên đại lý', 'Tên sản phẩm', 'Giá', 'Số lượng', 'Tổng tiền', 'Người nhập']] }
        });
    }
    return title;
}

// Lấy danh sách đại lý
async function getAgents() {
    try {
        const res = await sheets.spreadsheets.values.get({
        spreadsheetId: config.daily_sheet_id,
        range: 'Dai_Ly!A2:A',
        });
        return (res.data.values || []).flat().map(name => name.trim()).filter(Boolean);
    } catch (e) {
        console.error('Lỗi lấy đại lý:', e.message);
        return [];
    }
}

// Lấy danh sách sản phẩm
async function getProducts() {
    try {
        const res = await sheets.spreadsheets.values.get({
        spreadsheetId: config.banggia_sheet_id,
        range: 'San_Pham!A2:B',
        });
        const rows = res.data.values || [];
        return rows.map(row => {
        const name = row[0]?.trim();
        let price = parseFloat(row[1]?.replace(/,/g, '')) || 0;
        return { name, price };
        }).filter(p => p.name);
    } catch (e) {
        console.error('Lỗi lấy sản phẩm:', e.message);
        return [];
    }
}

// Ghi đơn hàng
async function appendOrder(lines, userName) {
    await ensureTodaySheet();
    const today = new Date().toLocaleDateString('vi-VN').replace(/\//g, '_');
    const sheetName = `Ket_Qua_${today}`;

    const values = lines.map(line => [
        line.agent,
        line.product,
        line.price,
        line.quantity,
        line.price * line.quantity,
        userName
    ]);

    await sheets.spreadsheets.values.append({
        spreadsheetId: config.ketqua_sheet_id,
        range: `${sheetName}!A:F`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values }
    });
}

module.exports = {
    getAgents,
    getProducts,
    appendOrder,
    reloadConfig,
    get config() { return config; },
    setConfig: (newConfig) => {
        config = newConfig;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    }
};