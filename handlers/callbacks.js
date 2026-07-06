const api = require('../api');
const { getState, setState, clearState } = require('../utils/state');
const { serviceKeyboard, orderButtons, countryKeyboard } = require('../keyboards');
const { formatOrder, formatOtp } = require('../utils/formatter');
const { saveOrder, updateUser, getUser } = require('../utils/db');
const { startWatch } = require('../utils/autocheck');

module.exports = (bot) => {
  const send = (chatId, text, opts = {}) =>
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...opts });

  const edit = (chatId, msgId, text, opts = {}) =>
    bot.editMessageText(text, {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: 'Markdown',
      ...opts
    });

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;
    const [action, value] = query.data.split(':');

    await bot.answerCallbackQuery(query.id);

    // ── Pilih Negara ─────────────────────────────────────────────────────────
    if (action === 'country') {
      // value = countryId (numerik string, misal "6")
      setState(chatId, { countryId: value });
      await edit(chatId, msgId, `⏳ Memuat layanan...`);

      const keyboard = await serviceKeyboard(value);
      edit(chatId, msgId,
        `🌍 ID Negara: *${value}*\n\n📦 *Pilih Service:*`,
        { reply_markup: keyboard }
      );
    }

    // ── Pilih Service → Buat Order ───────────────────────────────────────────
    else if (action === 'service') {
      // value = "serviceCode|countryId"  (dikirim dari serviceKeyboard)
      const [serviceCode, countryId] = value.split('|');
      const state = getState(chatId);

      if (!countryId) {
        edit(chatId, msgId, '❌ Sesi habis. Gunakan /order lagi.');
        return;
      }

      edit(chatId, msgId, `⏳ Memesan *${serviceCode}* di negara *${countryId}*...`);

      try {
        const order = await api.buyNumber(serviceCode, countryId);
        clearState(chatId);

        // Simpan ke DB lokal
        saveOrder(chatId, {
          id: order.order_id,
          phone: order.phone,
          service: serviceCode,
          price: order.price,
          status: order.status
        });
        const user = getUser(chatId);
        updateUser(chatId, { totalOrder: (user.totalOrder || 0) + 1 });

        edit(chatId, msgId,
          formatOrder(order) +
          `\n\n🔔 _OTP akan masuk otomatis, tunggu notifikasi..._`,
          { reply_markup: orderButtons(order.order_id) }
        );

        startWatch(bot, chatId, order.order_id, order.phone);

      } catch (err) {
        edit(chatId, msgId,
          `❌ *Gagal memesan!*\n\n` +
          `Service *${serviceCode}* tidak tersedia saat ini.\n` +
          `_${err.message}_`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Pilih Negara Lain', callback_data: 'restart' }],
                [{ text: '🔄 Coba Negara Sama', callback_data: `country:${countryId}` }]
              ]
            }
          }
        );
      }
    }

    // ── Cek OTP ──────────────────────────────────────────────────────────────
    else if (action === 'check') {
      try {
        const result = await api.checkOrder(value);
        send(chatId, formatOtp(result), { reply_markup: orderButtons(value) });
      } catch (err) {
        send(chatId, `❌ Gagal cek OTP: _${err.message}_`);
      }
    }

    // ── Kirim Ulang SMS ──────────────────────────────────────────────────────
    else if (action === 'resend') {
      try {
        await api.resendSms(value);
        send(chatId,
          `🔁 *Permintaan SMS ulang dikirim!*\n🆔 Order: \`${value}\``,
          { reply_markup: orderButtons(value) }
        );
      } catch (err) {
        send(chatId, `❌ Gagal kirim ulang SMS: _${err.message}_`);
      }
    }

    // ── Batalkan Order ───────────────────────────────────────────────────────
    else if (action === 'cancel') {
      try {
        const result = await api.cancelOrder(value);
        send(chatId,
          `✅ *Order Dibatalkan!*\n` +
          `🆔 Order: \`${value}\`\n` +
          `💰 Refund: *Rp ${Number(result.refunded).toLocaleString('id-ID')}*`
        );
      } catch (err) {
        if (err.error_code === 'CANCEL_TOO_EARLY') {
          const menit = Math.ceil(err.wait_seconds / 60);
          send(chatId,
            `⏳ *Belum bisa dibatalkan!*\n` +
            `Tunggu sekitar *${menit} menit* lagi.\n` +
            `_(Min. 2 menit setelah order)_`,
            { reply_markup: orderButtons(value) }
          );
        } else {
          send(chatId, `❌ Gagal membatalkan: _${err.message}_`);
        }
      }
    }

    // ── Restart Pilih Negara ─────────────────────────────────────────────────
    else if (action === 'restart') {
      setState(chatId, {});
      const keyboard = await countryKeyboard();
      edit(chatId, msgId, '🌍 *Pilih Negara:*', { reply_markup: keyboard });
    }

    // ── Tombol Kosong ────────────────────────────────────────────────────────
    else if (action === 'none') {
      await bot.answerCallbackQuery(query.id, {
        text: '❌ Tidak ada pilihan tersedia.',
        show_alert: true
      });
    }
  });
};