const api = require('../api');
const { formatOtp } = require('./formatter');
const { orderButtons } = require('../keyboards');

const watchList = {};

// Polling setiap 10 detik, max 24x (= 4 menit)
function startWatch(bot, chatId, orderId, phone) {
  if (watchList[orderId]) return;

  let attempts = 0;
  const MAX_ATTEMPTS = 24;

  const interval = setInterval(async () => {
    attempts++;
    try {
      const result = await api.checkOrder(orderId);

      if (result.status === 'received' && result.otp) {
        clearInterval(interval);
        delete watchList[orderId];

        bot.sendMessage(chatId,
          `🔔 *OTP Masuk Otomatis!*\n` +
          `📞 Nomor: \`${phone}\`\n\n` +
          formatOtp(result),
          {
            parse_mode: 'Markdown',
            reply_markup: orderButtons(orderId)
          }
        );

      } else if (result.status === 'cancelled') {
        clearInterval(interval);
        delete watchList[orderId];
        bot.sendMessage(chatId,
          `🚫 Order \`${orderId}\` dibatalkan.`,
          { parse_mode: 'Markdown' }
        );

      } else if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        delete watchList[orderId];

        bot.sendMessage(chatId,
          `⏰ *Waktu Habis!*\n\n` +
          `OTP tidak masuk untuk order \`${orderId}\`\n` +
          `Gunakan tombol di bawah untuk batalkan (min. 2 menit setelah order).`,
          {
            parse_mode: 'Markdown',
            reply_markup: orderButtons(orderId)
          }
        );
      }

    } catch {
      // Abaikan error sementara, lanjut polling
    }
  }, 10000);

  watchList[orderId] = { chatId, interval };
}

function stopWatch(orderId) {
  if (watchList[orderId]) {
    clearInterval(watchList[orderId].interval);
    delete watchList[orderId];
  }
}

module.exports = { startWatch, stopWatch };