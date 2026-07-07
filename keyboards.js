const api = require('./api');

// Cache TTL 5 menit
let countriesCache = null;
let countriesCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

const PAGE_SIZE_COUNTRY = 20; // 10 baris × 2 kolom
const PAGE_SIZE_SERVICE = 20; // 10 baris × 2 kolom

// ─── Build keyboard dengan pagination ────────────────────────────────────────
function buildKeyboardPaged(items, prefix, page = 0, pageSize = PAGE_SIZE_COUNTRY, extraRows = []) {
  const totalPages = Math.ceil(items.length / pageSize);
  const start = page * pageSize;
  const slice = items.slice(start, start + pageSize);

  if (slice.length === 0) {
    return {
      inline_keyboard: [[
        { text: '❌ Tidak ada pilihan tersedia', callback_data: 'none' }
      ]]
    };
  }

  const rows = [];
  for (let i = 0; i < slice.length; i += 2) {
    const row = [
      { text: slice[i].label, callback_data: `${prefix}:${slice[i].value}` }
    ];
    if (slice[i + 1]) {
      row.push({
        text: slice[i + 1].label,
        callback_data: `${prefix}:${slice[i + 1].value}`
      });
    }
    rows.push(row);
  }

  // ─── Baris navigasi ───────────────────────────────────────────────────────
  const navRow = [];
  if (page > 0) {
    navRow.push({ text: '⬅️ Back', callback_data: `page_${prefix}:${page - 1}` });
  }
  navRow.push({ text: `📄 ${page + 1}/${totalPages}`, callback_data: 'none' });
  if (page < totalPages - 1) {
    navRow.push({ text: 'Next ➡️', callback_data: `page_${prefix}:${page + 1}` });
  }

  rows.push(navRow);

  // ─── Extra rows (mis. tombol Kembali ke Menu Utama) ───────────────────────
  for (const row of extraRows) rows.push(row);

  return { inline_keyboard: rows };
}

// ─── Keyboard Negara ──────────────────────────────────────────────────────────
async function countryKeyboard(page = 0) {
  try {
    const now = Date.now();
    if (!countriesCache || now - countriesCacheTime > CACHE_TTL) {
      const data = await api.getCountries();
      countriesCache = data
        .filter(c => c.visible === 1)
        .map(c => ({
          label: c.name,
          value: String(c.id)
        }));
      countriesCacheTime = now;
    }

    const extraRows = [
      [{ text: '🏠 Menu Utama', callback_data: 'main_menu' }]
    ];
    return buildKeyboardPaged(countriesCache, 'country', page, PAGE_SIZE_COUNTRY, extraRows);
  } catch {
    return buildKeyboardPaged([
      { label: '🇮🇩 Indonesia', value: '6' }
    ], 'country', 0, PAGE_SIZE_COUNTRY, [
      [{ text: '🏠 Menu Utama', callback_data: 'main_menu' }]
    ]);
  }
}

// ─── Keyboard Layanan per Negara ──────────────────────────────────────────────
async function serviceKeyboard(countryId, page = 0) {
  try {
    const services = await api.getServicesByCountry(countryId);
    if (services.length === 0) {
      return {
        inline_keyboard: [
          [{ text: '❌ Tidak ada service tersedia', callback_data: 'none' }],
          [{ text: '⬅️ Kembali', callback_data: 'restart' },
           { text: '🏠 Menu Utama', callback_data: 'main_menu' }]
        ]
      };
    }

    const items = services
      .sort((a, b) => a.price - b.price)
      .map(s => ({
        label: `${s.name} — Rp ${s.price.toLocaleString('id-ID')} (${s.count})`,
        value: `${s.service}|${countryId}|${page}` // simpan page untuk back
      }));

    const extraRows = [
      [
        { text: '⬅️ Pilih Negara Lain', callback_data: 'restart' },
        { text: '🏠 Menu Utama', callback_data: 'main_menu' }
      ]
    ];
    return buildKeyboardPaged(items, 'service', page, PAGE_SIZE_SERVICE, extraRows);
  } catch {
    return {
      inline_keyboard: [
        [{ text: '❌ Gagal memuat service', callback_data: 'none' }],
        [{ text: '⬅️ Kembali', callback_data: 'restart' },
         { text: '🏠 Menu Utama', callback_data: 'main_menu' }]
      ]
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
      ],
      [
        { text: '🏠 Menu Utama', callback_data: 'main_menu' }
      ]
    ]
  };
}

module.exports = {
  countryKeyboard,
  serviceKeyboard,
  orderButtons,
  countriesCache: () => countriesCache // ekspor getter untuk pagination service
};