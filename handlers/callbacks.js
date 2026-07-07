const api = require('../api');
const { getState, setState, clearState } = require('../utils/state');
const { serviceKeyboard, orderButtons, countryKeyboard } = require('../keyboards');
const { formatOrder, formatOtp } = require('../utils/formatter');
const { saveOrder, updateUser, getUser } = require('../utils/db');
const { startWatch } = require('../utils/autocheck');
const { MAIN_MENU } = require('../utils/menu');

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

  // ─── Helper parse callback_data ───────────────────────────────────────────
  // Format: "action:value"  — value bisa mengandung ':' (misal orderId berbentuk angka saja)
  function parseQuery(data) {
    const idx = data.indexOf(':');
    if (idx === -1) return { action: data, value: '' };
    return { action: data.slice(0, idx), value: data.slice(idx + 1) };
  }

  // ─── Callback Query Handler ───────────────────────────────────────────────
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const msgId  = query.message.message_id;
    const { action, value } = parseQuery(query.data);

    await bot.answerCallbackQuery(query.id);

    // ── Pagination Negara: "pg_country:{page}_"
    if (action === 'pg_country') {
      const [pageStr] = value.split('_');
      const page = parseInt(pageStr) || 0;
      const keyboard = await countryKeyboard(page);
      edit(chatId, msgId, '🌍 *Pilih Negara:*', { reply_markup: keyboard });
    }

    // ── Pagination Service: "pg_service:{page}_{countryId}"
    else if (action === 'pg_service') {
      // value = "page_countryId"  (underscore sebagai separator)
      const underIdx = value.indexOf('_');
      const page      = parseInt(value.slice(0, underIdx)) || 0;
      const countryId = value.slice(underIdx + 1);

      if (!countryId) {
        edit(chatId, msgId, '❌ Sesi habis, silakan pilih negara lagi.', {
          reply_markup: { inline_keyboard: [[{ text: '🔄 Pilih Negara', callback_data: 'restart' }]] }
        });
        return;
      }

      await edit(chatId, msgId, '⏳ Memuat halaman...');
      const keyboard = await serviceKeyboard(countryId, page);
      edit(chatId, msgId,
        `🌍 Negara ID: *${countryId}*\n\n📦 *Pilih Service:*`,
        { reply_markup: keyboard }
      );
    }

    // ── Menu Utama
    else if (action === 'main_menu') {
      clearState(chatId);
      try { await bot.deleteMessage(chatId, msgId); } catch {}
      send(chatId, '🏠 *Menu Utama*\nPilih menu di bawah ini:', { reply_markup: MAIN_MENU });
    }

    // ── Mulai pencarian negara
    else if (action === 'search_country') {
      setState(chatId, { mode: 'searching_country', searchMsgId: msgId });
      send(chatId,
        '🔍 *Cari Negara*\n\nKetik nama negara yang ingin dicari:\n_(contoh: indonesia, india, japan)_',
        {
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Batal', callback_data: 'cancel_search' }]]
          }
        }
      );
    }

    // ── Mulai pencarian service: "search_service:{countryId}"
    else if (action === 'search_service') {
      const countryId = value;
      setState(chatId, { mode: 'searching_service', countryId, searchMsgId: msgId });
      send(chatId,
        '🔍 *Cari Service*\n\nKetik nama service yang ingin dicari:\n_(contoh: whatsapp, telegram, google)_',
        {
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Batal', callback_data: `cancel_service_search:${countryId}` }]]
          }
        }
      );
    }

    // ── Batal cari service: "cancel_service_search:{countryId}"
    else if (action === 'cancel_service_search') {
      const countryId = value;
      clearState(chatId);
      await edit(chatId, msgId, '⏳ Kembali ke daftar service...');
      const keyboard = await serviceKeyboard(countryId, 0);
      edit(chatId, msgId,
        `🌍 Negara ID: *${countryId}*\n\n📦 *Pilih Service:*`,
        { reply_markup: keyboard }
      );
    }

    // ── Batal cari negara
    else if (action === 'cancel_search') {
      clearState(chatId);
      await edit(chatId, msgId, '⏳ Kembali ke daftar negara...');
      const keyboard = await countryKeyboard(0);
      edit(chatId, msgId, '🌍 *Pilih Negara:*', { reply_markup: keyboard });
    }

    // ── Pilih Negara: "country:{countryId}"
    else if (action === 'country') {
      const countryId = value;  // value = countryId murni (string angka)
      setState(chatId, { countryId, mode: null });
      await edit(chatId, msgId, '⏳ Memuat layanan...');
      const keyboard = await serviceKeyboard(countryId, 0);
      edit(chatId, msgId,
        `🌍 Negara ID: *${countryId}*\n\n📦 *Pilih Service:*`,
        { reply_markup: keyboard }
      );
    }

    // ── Pilih Service → Buat Order: "service:{serviceCode}|{countryId}"
    else if (action === 'service') {
      // value = "serviceCode|countryId"
      const pipeIdx   = value.indexOf('|');
      const serviceCode = value.slice(0, pipeIdx);
      const countryId   = value.slice(pipeIdx + 1);

      if (!serviceCode || !countryId) {
        edit(chatId, msgId, '❌ Sesi habis. Gunakan /order lagi.');
        return;
      }

      edit(chatId, msgId, `⏳ Memesan *${serviceCode}* di negara *${countryId}*...`);

      try {
        const order = await api.buyNumber(serviceCode, countryId);
        clearState(chatId);

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
          formatOrder(order) + `\n\n🔔 _OTP akan masuk otomatis, tunggu notifikasi..._`,
          { reply_markup: orderButtons(order.order_id) }
        );

        startWatch(bot, chatId, order.order_id, order.phone);

      } catch (err) {
        edit(chatId, msgId,
          `❌ *Gagal memesan!*\n\nService *${serviceCode}* tidak tersedia saat ini.\n_${err.message}_`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🔄 Coba Lagi', callback_data: `country:${countryId}` },
                  { text: '🔄 Negara Lain', callback_data: 'restart' }
                ],
                [{ text: '🏠 Menu Utama', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      }
    }

    // ── Cek OTP
    else if (action === 'check') {
      try {
        const result = await api.checkOrder(value);
        send(chatId, formatOtp(result), { reply_markup: orderButtons(value) });
      } catch (err) {
        send(chatId, `❌ Gagal cek OTP: _${err.message}_`);
      }
    }

    // ── Kirim Ulang SMS
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

    // ── Batalkan Order
    else if (action === 'cancel') {
      try {
        const result = await api.cancelOrder(value);
        send(chatId,
          `✅ *Order Dibatalkan!*\n🆔 Order: \`${value}\`\n💰 Refund: *Rp ${Number(result.refunded).toLocaleString('id-ID')}*`,
          { reply_markup: { inline_keyboard: [[{ text: '🏠 Menu Utama', callback_data: 'main_menu' }]] } }
        );
      } catch (err) {
        if (err.error_code === 'CANCEL_TOO_EARLY') {
          const menit = Math.ceil(err.wait_seconds / 60);
          send(chatId,
            `⏳ *Belum bisa dibatalkan!*\nTunggu sekitar *${menit} menit* lagi.\n_(Min. 2 menit setelah order)_`,
            { reply_markup: orderButtons(value) }
          );
        } else {
          send(chatId, `❌ Gagal membatalkan: _${err.message}_`);
        }
      }
    }

    // ── Restart ke Pilih Negara
    else if (action === 'restart') {
      setState(chatId, { mode: null });
      const keyboard = await countryKeyboard(0);
      edit(chatId, msgId, '🌍 *Pilih Negara:*', { reply_markup: keyboard });
    }

    // ── Tombol kosong
    else if (action === 'none') {
      await bot.answerCallbackQuery(query.id, {
        text: 'ℹ️ Ini adalah info halaman.',
        show_alert: false
      });
    }
  });

  // ─── Text Handler untuk Search ────────────────────────────────────────────
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    const state  = getState(chatId);

    // Mode cari negara
    if (state.mode === 'searching_country') {
      const query = msg.text.trim();
      clearState(chatId);

      const keyboard = await countryKeyboard(0, query);
      bot.sendMessage(chatId,
        `🔍 Hasil pencarian: *"${query}"*\n\n🌍 Pilih negara:`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    }

    // Mode cari service
    else if (state.mode === 'searching_service') {
      const query     = msg.text.trim();
      const countryId = state.countryId;
      clearState(chatId);

      try {
        const keyboard = await serviceKeyboard(countryId, 0, query);
        bot.sendMessage(chatId,
          `🔍 Hasil pencarian: *"${query}"*\n🌍 Negara ID: *${countryId}*\n\n📦 Pilih service:`,
          { parse_mode: 'Markdown', reply_markup: keyboard }
        );
      } catch {
        bot.sendMessage(chatId, '❌ Gagal mencari service.');
      }
    }
  });
};