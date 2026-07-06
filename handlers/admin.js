const { getAllUsers, topUpUser, getUserCount } = require('../utils/db');
const { ADMIN_IDS } = require('../config');

module.exports = (bot) => {
  const send = (chatId, text, opts = {}) =>
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...opts });

  const isAdmin = (chatId) => ADMIN_IDS.includes(chatId);

  const formatRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

  // ── 🤖 Admin Panel ────────────────────────────────────────────────────────
  bot.onText(/🤖 Admin/, (msg) => {
    if (!isAdmin(msg.chat.id)) return send(msg.chat.id, '❌ Akses ditolak.');
    send(msg.chat.id,
      `👑 *Admin Panel*\n\n` +
      `/users — Daftar semua user\n` +
      `/topup [userId] [nominal] — Top up saldo user (Rupiah)\n` +
      `/broadcast [pesan] — Kirim ke semua user\n` +
      `/stats — Statistik bot`
    );
  });

  // ── /stats ────────────────────────────────────────────────────────────────
  bot.onText(/\/stats/, (msg) => {
    if (!isAdmin(msg.chat.id)) return send(msg.chat.id, '❌ Akses ditolak.');
    const count = getUserCount();
    send(msg.chat.id,
      `📊 *Statistik Bot*\n\n` +
      `👥 Total User: *${count}*`
    );
  });

  // ── /users ────────────────────────────────────────────────────────────────
  bot.onText(/\/users/, (msg) => {
    if (!isAdmin(msg.chat.id)) return send(msg.chat.id, '❌ Akses ditolak.');
    const users = getAllUsers();
    const list = Object.values(users)
      .map(u =>
        `👤 \`${u.chatId}\`\n` +
        `   💰 ${formatRp(u.balance || 0)} | 🛒 ${u.totalOrder || 0} order`
      )
      .join('\n\n');
    send(msg.chat.id,
      `👥 *Daftar User (${Object.keys(users).length}):*\n\n${list || 'Belum ada user.'}`
    );
  });

  // ── /topup [userId] [nominal] ─────────────────────────────────────────────
  // Nominal dalam Rupiah (integer), contoh: /topup 123456789 50000
  bot.onText(/\/topup (\d+) (\d+)/, async (msg, match) => {
    if (!isAdmin(msg.chat.id)) return send(msg.chat.id, '❌ Akses ditolak.');
    const userId = match[1];
    const amount = parseInt(match[2]);

    try {
      const newBalance = topUpUser(userId, amount);
      send(msg.chat.id,
        `✅ *Top Up Berhasil!*\n\n` +
        `👤 User: \`${userId}\`\n` +
        `💰 Ditambahkan: *${formatRp(amount)}*\n` +
        `💳 Saldo Baru: *${formatRp(newBalance)}*`
      );
      send(parseInt(userId),
        `💳 *Top Up Berhasil!*\n\n` +
        `Saldo ditambahkan: *${formatRp(amount)}*\n` +
        `Saldo sekarang: *${formatRp(newBalance)}*\n\n` +
        `Terima kasih! 🙏`
      );
    } catch {
      send(msg.chat.id, '❌ Gagal top up.');
    }
  });

  // ── /broadcast [pesan] ────────────────────────────────────────────────────
  bot.onText(/\/broadcast (.+)/, (msg, match) => {
    if (!isAdmin(msg.chat.id)) return send(msg.chat.id, '❌ Akses ditolak.');
    const users = getAllUsers();
    const message = match[1];
    let success = 0;
    let failed = 0;

    Object.keys(users).forEach(chatId => {
      try {
        bot.sendMessage(parseInt(chatId),
          `📢 *Pesan dari Admin:*\n\n${message}`,
          { parse_mode: 'Markdown' }
        );
        success++;
      } catch {
        failed++;
      }
    });

    send(msg.chat.id,
      `✅ *Broadcast Selesai*\n\n` +
      `✅ Berhasil: ${success}\n` +
      `❌ Gagal: ${failed}`
    );
  });
};