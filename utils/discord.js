// utils/discord.js
const axios = require('axios');

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.warn('⚠️ DISCORD_WEBHOOK_URL chưa được cấu hình trong .env');
}

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' ₫';
}

function safeText(text, fallback = 'Không có') {
  return text ? String(text).trim() : fallback;
}

function buildItemsTable(items) {
  if (items.length === 0) return 'Không có sản phẩm';

  const header = 'Sản phẩm                          | Giá chốt     | SL   | Thành tiền';
  const line = '────────────────────────────────────────────────────────────';

  const rows = items.map(i => {
    const name = (i.product || '').padEnd(32).slice(0, 32);
    const price = formatVND(i.price).padStart(12);
    const qty = String(i.quantity || 0).padStart(4);
    const final = formatVND(i.finalAmount).padStart(14);
    return `${name} | ${price} | ${qty} | ${final}`;
  });

  const maxRows = 10;
  const finalRows = rows.length > maxRows
    ? rows.slice(0, maxRows).concat(['... và ' + (rows.length - maxRows) + ' sản phẩm khác'])
    : rows;

  return '```' + '\n' + [header, line, ...finalRows].join('\n') + '\n```';
}

async function sendOrderToDiscord(orderData) {
  if (!WEBHOOK_URL) return;

  const { orderCode, agent, discountPercent, lines, userName, createdAt } = orderData;

  const sumTotal = lines.reduce((sum, l) => sum + l.total, 0);
  const sumDiscount = lines.reduce((sum, l) => sum + l.discountAmount, 0);
  const grandFinal = lines.reduce((sum, l) => sum + l.finalAmount, 0);

  const payload = {
    username: "Order Bot",
    avatar_url: "https://cdn-icons-png.flaticon.com/512/3081/3081559.png",
    embeds: [
      {
        title: "🛒 Đơn hàng mới từ đại lý",
        description: `**${safeText(agent)}** vừa đặt đơn hàng`,
        color: 0x00ff99,
        fields: [
          {
            name: "🆔 Mã đơn hàng",
            value: orderCode,
            inline: true
          },
          {
            name: "⏰ Thời gian",
            value: createdAt,
            inline: true
          },
          {
            name: "👤 Nhân viên nhập",
            value: safeText(userName),
            inline: true
          },
          {
            name: "🏪 Đại lý",
            value: safeText(agent),
            inline: true
          },
          {
            name: "💸 Chiết khấu đại lý",
            value: `${discountPercent || 0}%`,
            inline: true
          },
          {
            name: "📦 Chi tiết sản phẩm",
            value: buildItemsTable(lines),
            inline: false
          },
          {
            name: "📊 Tổng hợp thanh toán",
            value: 
              `**Tạm tính:** ${formatVND(sumTotal)}\n` +
              `**Chiết khấu:** ${formatVND(sumDiscount)}\n` +
              `**Thành tiền:** **${formatVND(grandFinal)}**`,
            inline: false
          }
        ],
        footer: {
          text: "Hệ thống nhập đơn đại lý • Ancarat"
        },
        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    await axios.post(WEBHOOK_URL, payload);
    console.log('✅ Đã gửi thông báo đơn hàng đến Discord:', orderCode);
  } catch (err) {
    console.error('❌ Lỗi gửi Discord webhook:', err.response?.data || err.message);
  }
}

module.exports = { sendOrderToDiscord };