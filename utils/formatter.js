function formatRp(amount) {
  return `Rp ${Number(amount).toLocaleString('id-ID')}`;
}

// ─── Format order baru ────────────────────────────────────────────────────────
// order = { order_id, phone, price, status }
function formatOrder(order) {
  return (
    `✅ *Nomor Berhasil Dipesan!*\n\n` +
    `📞 Nomor: \`${order.phone}\`\n` +
    `🆔 Order ID: \`${order.order_id}\`\n` +
    `💰 Harga: *${formatRp(order.price)}*\n` +
    `📊 Status: *${order.status}*`
  );
}

// ─── Format OTP masuk ─────────────────────────────────────────────────────────
// result = { order_id, phone, status, otp }
function formatOtp(result) {
  if (result.status !== 'received' || !result.otp) {
    return (
      `⏳ *OTP belum masuk*\n` +
      `🆔 Order: \`${result.order_id}\`\n` +
      `📊 Status: *${result.status}*`
    );
  }
  return (
    `✅ *OTP Masuk!*\n\n` +
    `📞 Nomor: \`${result.phone}\`\n` +
    `🆔 Order: \`${result.order_id}\`\n` +
    `🔑 *Kode OTP: \`${result.otp}\`*`
  );
}

// ─── Format profil user ───────────────────────────────────────────────────────
function formatProfile(user, name) {
  const join = new Date(user.joinDate).toLocaleDateString('id-ID');
  return (
    `👤 *Profil Kamu*\n\n` +
    `📛 Nama: *${name}*\n` +
    `🆔 ID: \`${user.chatId}\`\n` +
    `💰 Saldo: *${formatRp(user.balance || 0)}*\n` +
    `🛒 Total Order: *${user.totalOrder || 0}*\n` +
    `📅 Bergabung: *${join}*`
  );
}

// ─── Format riwayat order lokal ───────────────────────────────────────────────
function formatOrders(orders) {
  if (!orders || orders.length === 0) {
    return '📋 Belum ada riwayat order.';
  }
  const list = orders.map((o, i) =>
    `${i + 1}. \`${o.id}\` — *${o.service || o.product}*\n` +
    `   📞 ${o.phone} — ${formatRp(o.price)}\n` +
    `   📊 ${o.status}`
  ).join('\n\n');
  return `📋 *Riwayat Order Terakhir:*\n\n${list}`;
}

// ─── Format riwayat dari API history ─────────────────────────────────────────
function formatHistoryApi(data) {
  if (!data || data.length === 0) return '📋 Tidak ada riwayat order.';
  const list = data.map((o, i) =>
    `${i + 1}. \`${o.order_id}\`\n` +
    `   📞 ${o.phone}\n` +
    `   📊 ${o.status}${o.otp_code ? ` — 🔑 \`${o.otp_code}\`` : ''}`
  ).join('\n\n');
  return `📋 *Riwayat Order (API):*\n\n${list}`;
}

module.exports = { formatOrder, formatOtp, formatProfile, formatOrders, formatHistoryApi, formatRp };