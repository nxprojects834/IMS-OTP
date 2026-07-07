const api = require('./api');

// ─── Cache ────────────────────────────────────────────────────────────────────
let countriesCache = null;
let countriesCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

// Simpan daftar service per negara sementara (untuk pagination & search)
const servicesCache = {};

const PAGE_SIZE = 20; // 10 baris × 2 kolom

// ─── Build keyboard paged ─────────────────────────────────────────────────────
// navData: string tambahan yang disertakan di callback Next/Back (misal countryId)
function buildKeyboardPaged(items, prefix, page, navData, extraRows = []) {
  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
  const start = clampedPage * PAGE_SIZE;
  const slice = items.slice(start, start + PAGE_SIZE);

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

  // Navigasi — format: "pg_{prefix}:{page}_{navData}"
  const navRow = [];
  if (clampedPage > 0) {
    navRow.push({
      text: '⬅️ Back',
      callback_data: `pg_${prefix}:${clampedPage - 1}_${navData}`
    });
  }
  navRow.push({ text: `📄 ${clampedPage + 1}/${totalPages}`, callback_data: 'none' });
  if (clampedPage < totalPages - 1) {
    navRow.push({
      text: 'Next ➡️',
      callback_data: `pg_${prefix}:${clampedPage + 1}_${navData}`
    });
  }
  rows.push(navRow);

  for (const row of extraRows) rows.push(row);

  return { inline_keyboard: rows };
}

// ─── Keyboard Negara ──────────────────────────────────────────────────────────
async function countryKeyboard(page = 0, filter = '') {
  const now = Date.now();
  if (!countriesCache || now - countriesCacheTime > CACHE_TTL) {
    const data = await api.getCountries();
    countriesCache = data
      .filter(c => c.visible === 1)
      .map(c => ({ label: c.name, value: String(c.id), name: c.name.toLowerCase() }));
    countriesCacheTime = now;
  }

  const list = filter
    ? countriesCache.filter(c => c.name.includes(filter.toLowerCase()))
    : countriesCache;

  if (list.length === 0) {
    return {
      inline_keyboard: [
        [{ text: `❌ Negara "${filter}" tidak ditemukan`, callback_data: 'none' }],
        [{ text: '🔍 Cari Lagi', callback_data: 'search_country' },
         { text: '🏠 Menu Utama', callback_data: 'main_menu' }]
      ]
    };
  }

  const items = list.map(c => ({ label: c.label, value: c.value }));
  const extraRows = [
    [{ text: '🔍 Cari Negara', callback_data: 'search_country' },
     { text: '🏠 Menu Utama', callback_data: 'main_menu' }]
  ];
  // navData = '' (tidak perlu data ekstra untuk negara)
  return buildKeyboardPaged(items, 'country', page, '', extraRows);
}

// ─── Keyboard Layanan ─────────────────────────────────────────────────────────
async function serviceKeyboard(countryId, page = 0, filter = '') {
  // Fetch & cache per countryId
  if (!servicesCache[countryId]) {
    const services = await api.getServicesByCountry(countryId);
    servicesCache[countryId] = services
      .sort((a, b) => a.price - b.price)
      .map(s => ({
        label: `${s.name} — Rp ${s.price.toLocaleString('id-ID')} (${s.count})`,
        value: `${s.service}|${countryId}`,   // ← hanya serviceCode|countryId, TANPA page
        name: s.name.toLowerCase()
      }));
    // expire cache service setelah 3 menit
    setTimeout(() => { delete servicesCache[countryId]; }, 3 * 60 * 1000);
  }

  const list = filter
    ? servicesCache[countryId].filter(s => s.name.includes(filter.toLowerCase()))
    : servicesCache[countryId];

  if (list.length === 0) {
    return {
      inline_keyboard: [
        [{ text: `❌ Service "${filter}" tidak ditemukan`, callback_data: 'none' }],
        [{ text: '🔍 Cari Lagi', callback_data: `search_service:${countryId}` },
         { text: '⬅️ Negara Lain', callback_data: 'restart' }],
        [{ text: '🏠 Menu Utama', callback_data: 'main_menu' }]
      ]
    };
  }

  const items = list.map(s => ({ label: s.label, value: s.value }));
  const extraRows = [
    [{ text: '🔍 Cari Service', callback_data: `search_service:${countryId}` },
     { text: '⬅️ Negara Lain', callback_data: 'restart' }],
    [{ text: '🏠 Menu Utama', callback_data: 'main_menu' }]
  ];
  // navData = countryId agar Next/Back tahu harus ke negara mana
  return buildKeyboardPaged(items, 'service', page, countryId, extraRows);
}

// ─── Tombol Aksi Order ────────────────────────────────────────────────────────
function orderButtons(orderId) {
  return {
    inline_keyboard: [
      [
        { text: '📨 Cek OTP', callback_data: `check:${orderId}` },
        { text: '🔁 SMS Ulang', callback_data: `resend:${orderId}` }
      ],
      [{ text: '❌ Batalkan', callback_data: `cancel:${orderId}` }],
      [{ text: '🏠 Menu Utama', callback_data: 'main_menu' }]
    ]
  };
}

module.exports = { countryKeyboard, serviceKeyboard, orderButtons };