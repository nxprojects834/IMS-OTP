const api = require('./api');

// Cache TTL 5 menit
let countriesCache = null;
let countriesCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

function buildKeyboard(items, prefix) {
  if (items.length === 0) {
    return {
      inline_keyboard: [[
        { text: '❌ Tidak ada pilihan tersedia', callback_data: 'none' }
      ]]
    };
  }
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    const row = [
      { text: items[i].label, callback_data: `${prefix}:${items[i].value}` }
    ];
    if (items[i + 1]) {
      row.push({
        text: items[i + 1].label,
        callback_data: `${prefix}:${items[i + 1].value}`
      });
    }
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

// ─── Keyboard Negara ──────────────────────────────────────────────────────────
async function countryKeyboard() {
  try {
    const now = Date.now();
    if (!countriesCache || now - countriesCacheTime > CACHE_TTL) {
      const data = await api.getCountries();
      countriesCache = data
        .filter(c => c.visible === 1)
        .slice(0, 30)
        .map(c => ({
          label: c.name,
          value: String(c.id)   // value = ID numerik negara
        }));
      countriesCacheTime = now;
    }
    return buildKeyboard(countriesCache, 'country');
  } catch {
    // Fallback ke Indonesia saja
    return buildKeyboard([
      { label: '🇮🇩 Indonesia', value: '6' }
    ], 'country');
  }
}

// ─── Keyboard Layanan per Negara ──────────────────────────────────────────────
async function serviceKeyboard(countryId) {
  try {
    const services = await api.getServicesByCountry(countryId);
    if (services.length === 0) {
      return {
        inline_keyboard: [[
          { text: '❌ Tidak ada service tersedia', callback_data: 'none' }
        ]]
      };
    }

    const items = services
      .sort((a, b) => a.price - b.price)
      .slice(0, 24)
      .map(s => ({
        label: `${s.name} — Rp ${s.price.toLocaleString('id-ID')} (${s.count})`,
        // value menyimpan: serviceCode|countryId  agar callback tahu keduanya
        value: `${s.service}|${countryId}`
      }));

    return buildKeyboard(items, 'service');
  } catch {
    return {
      inline_keyboard: [[
        { text: '❌ Gagal memuat service', callback_data: 'none' }
      ]]
    };
  }
}

// ─── Tombol Aksi Order ────────────────────────────────────────────────────────
function orderButtons(orderId) {
  return {
    inline_keyboard: [
      [
        { text: '📨 Cek OTP', callback_data: `check:${orderId}` },
        { text: '🔁 SMS Ulang', callback_data: `resend:${orderId}` }
      ],
      [
        { text: '❌ Batalkan', callback_data: `cancel:${orderId}` }
      ]
    ]
  };
}

module.exports = {
  countryKeyboard,
  serviceKeyboard,
  orderButtons
};