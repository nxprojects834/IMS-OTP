const api = require('../api');
const { setState } = require('../utils/state');
const { countryKeyboard, orderButtons } = require('../keyboards');
const { formatOtp, formatProfile, formatOrders, formatHistoryApi, formatRp } = require('../utils/formatter');
const { MAIN_MENU } = require('../utils/menu');
const { getUser, getOrders, updateUser } = require('../utils/db');

module.exports = (bot) => {
  const send = (chatId, text, opts = {}) =>
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...opts });

  // ── /start ────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    getUser(chatId);
    const name = msg.chat.first_name || 'User';
    send(chatId,
      `🤖 *Bot Order OTP*\n\n` +
      `Halo, *${name}!* Selamat datang.\n` +
      `Pilih menu di bawah untuk mulai:`,
      { reply_markup: MAIN_MENU }
    );
  });

  // ── 🛒 Order OTP ──────────────────────────────────────────────────────────
  bot.onText(/🛒 Order OTP/, async (msg) => {
    const chatId = msg.chat.id;
    setState(chatId, {});
    const loadMsg = await send(chatId, '⏳ Memuat daftar negara...');
    const keyboard = await countryKeyboard();
    bot.editMessageText('🌍 *Pilih Negara:*', {
      chat_id: chatId,
      message_id: loadMsg.message_id,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  });

  // ── 💰 Cek Saldo ──────────────────────────────────────────────────────────
  bot.onText(/💰 Cek Saldo/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const { balance, balance_formatted } = await api.getBalance();
      const user = getUser(chatId);
      send(chatId,
        `💰 *Info Saldo*\n\n` +
        `👤 Saldo Kamu: *${formatRp(user.balance || 0)}*\n` +
        `🌐 Saldo OTP Instan: *${balance_formatted}* (Rp ${Number(balance).toLocaleString('id-ID')})`
      );
    } catch {
      send(chatId, '❌ Gagal mengambil saldo.');
    }
  });

  // ── 👤 Profil ─────────────────────────────────────────────────────────────
  bot.onText(/👤 Profil/, (msg) => {
    const chatId = msg.chat.id;
    const user = getUser(chatId);
    const name = msg.chat.first_name || 'User';
    send(chatId, formatProfile(user, name));
  });

  // ── 📋 Riwayat Order ──────────────────────────────────────────────────────
  bot.onText(/📋 Riwayat Order/, (msg) => {
    const chatId = msg.chat.id;
    const orders = getOrders(chatId);
    send(chatId, formatOrders(orders));
  });

  // ── 💳 Top Up ─────────────────────────────────────────────────────────────
  bot.onText(/💳 Top Up/, (msg) => {
    const chatId = msg.chat.id;
    const user = getUser(chatId);
    send(chatId,
      `💳 *Top Up Saldo*\n\n` +
      `🆔 ID Kamu: \`${chatId}\`\n` +
      `💰 Saldo Sekarang: *${formatRp(user.balance || 0)}*\n\n` +
      `📱 *Metode Pembayaran:*\n` +
      `• DANA: \`0851233340326\`\n` +
      `• GoPay: \`0851233340326\`\n` +
      `Setelah transfer, hubungi admin:\n` +
      `Format: \`TOPUP [nominal] [ID kamu]\`\n\n` +
      `_Minimal top up: Rp 10.000_`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '📞 Hubungi Admin', url: 'https://t.me/david_dev77' }
          ]]
        }
      }
    );
  });

  // ── ❓ Bantuan ────────────────────────────────────────────────────────────
  bot.onText(/❓ Bantuan/, (msg) => {
    send(msg.chat.id,
      `❓ *Bantuan & Panduan*\n\n` +
      `*🛒 Cara Order OTP:*\n` +
      `1. Tekan 🛒 Order OTP\n` +
      `2. Pilih negara\n` +
      `3. Pilih service\n` +
      `4. Nomor otomatis dipesan\n` +
      `5. OTP masuk otomatis (notif)\n\n` +
      `*💳 Cara Top Up:*\n` +
      `1. Tekan 💳 Top Up\n` +
      `2. Transfer ke rekening admin\n` +
      `3. Hubungi admin dengan format:\n` +
      `   \`TOPUP [nominal] [ID kamu]\`\n` +
      `4. Saldo ditambahkan oleh admin\n\n` +
      `*📋 Perintah Manual:*\n` +
      `/order — Pesan nomor OTP\n` +
      `/balance — Cek saldo akun OTP Instan\n` +
      `/check [order_id] — Cek OTP masuk\n` +
      `/cancel [order_id] — Batalkan order\n` +
      `/resend [order_id] — Minta SMS ulang\n` +
      `/history — Riwayat order dari API\n\n` +
      `_Powered by @nxprojects_`
    );
  });

  // ── /order ────────────────────────────────────────────────────────────────
  bot.onText(/\/order/, async (msg) => {
    const chatId = msg.chat.id;
    setState(chatId, {});
    const loadMsg = await send(chatId, '⏳ Memuat daftar negara...');
    const keyboard = await countryKeyboard();
    bot.editMessageText('🌍 *Pilih Negara:*', {
      chat_id: chatId,
      message_id: loadMsg.message_id,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  });

  // ── /balance ──────────────────────────────────────────────────────────────
  bot.onText(/\/balance/, async (msg) => {
    try {
      const { balance_formatted } = await api.getBalance();
      send(msg.chat.id, `💰 *Saldo OTP Instan:* *${balance_formatted}*`);
    } catch {
      send(msg.chat.id, '❌ Gagal mengambil saldo.');
    }
  });

  // ── /check [order_id] ─────────────────────────────────────────────────────
  bot.onText(/\/check (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const orderId = match[1].trim();
    try {
      const result = await api.checkOrder(orderId);
      send(chatId, formatOtp(result), { reply_markup: orderButtons(orderId) });
    } catch (err) {
      send(chatId, `❌ Gagal cek order: _${err.message}_`);
    }
  });

  // ── /cancel [order_id] ────────────────────────────────────────────────────
  bot.onText(/\/cancel (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const orderId = match[1].trim();
    try {
      const result = await api.cancelOrder(orderId);
      send(chatId,
        `✅ *Order Dibatalkan!*\n` +
        `🆔 Order: \`${orderId}\`\n` +
        `💰 Refund: *Rp ${Number(result.refunded).toLocaleString('id-ID')}*`
      );
    } catch (err) {
      if (err.error_code === 'CANCEL_TOO_EARLY') {
        const menit = Math.ceil((err.wait_seconds || 120) / 60);
        send(chatId,
          `⏳ *Belum bisa dibatalkan!*\n` +
          `Tunggu sekitar *${menit} menit* lagi.\n` +
          `_(Min. 2 menit setelah order)_`
        );
      } else {
        send(chatId, `❌ Gagal membatalkan: _${err.message}_`);
      }
    }
  });

  // ── /resend [order_id] ────────────────────────────────────────────────────
  bot.onText(/\/resend (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const orderId = match[1].trim();
    try {
      await api.resendSms(orderId);
      send(chatId,
        `🔁 *Permintaan SMS ulang dikirim!*\n🆔 Order: \`${orderId}\``
      );
    } catch (err) {
      send(chatId, `❌ Gagal kirim ulang SMS: _${err.message}_`);
    }
  });

  // ── /history ──────────────────────────────────────────────────────────────
  bot.onText(/\/history/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const result = await api.getHistory({ limit: 10 });
      send(chatId,
        formatHistoryApi(result.data) +
        `\n\n_Total: ${result.total} order_`
      );
    } catch (err) {
      send(chatId, `❌ Gagal ambil riwayat: _${err.message}_`);
    }
  });
};