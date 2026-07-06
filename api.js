const axios = require('axios');
const { OTP_API_KEY } = require('./config');

const BASE_URL = 'https://otpinstan.com/api/reseller';
const headers = {
  'X-Api-Key': OTP_API_KEY,
  'Accept': 'application/json'
};

// ─── Cek Saldo ────────────────────────────────────────────────────────────────
async function getBalance() {
  const res = await axios.get(`${BASE_URL}/balance.php`, { headers });
  if (!res.data.success) throw new Error('Gagal ambil saldo');
  return res.data; // { balance, balance_formatted }
}

// ─── Daftar Negara ────────────────────────────────────────────────────────────
async function getCountries() {
  const res = await axios.get(`${BASE_URL}/countries.php`, { headers });
  if (!res.data.success) throw new Error('Gagal ambil negara');
  return res.data.data; // Array: [{ id, name, visible }]
}

// ─── Layanan + Harga + Stok ───────────────────────────────────────────────────
async function getServices() {
  const res = await axios.get(`${BASE_URL}/services.php`, { headers });
  if (!res.data.success) throw new Error('Gagal ambil layanan');
  return res.data.data; // Array: [{ country, service, name, price, count }]
}

// ─── Layanan per Negara (filter dari services) ────────────────────────────────
async function getServicesByCountry(countryId) {
  const all = await getServices();
  return all.filter(s => s.country === parseInt(countryId) && s.count > 0);
}

// ─── Variasi Provider / Harga ─────────────────────────────────────────────────
async function getOperators(service, countryId) {
  const res = await axios.get(`${BASE_URL}/operators.php`, {
    headers,
    params: { service, country: countryId }
  });
  if (!res.data.success) throw new Error('Gagal ambil operator');
  return res.data.data; // Array: [{ operator, provider_id, price, count }]
}

// ─── Buat Order Baru ──────────────────────────────────────────────────────────
async function buyNumber(service, countryId, providerId = '') {
  const params = new URLSearchParams({ service, country: countryId });
  if (providerId) params.append('provider_id', providerId);

  const res = await axios.post(`${BASE_URL}/order.php`, params.toString(), {
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  if (!res.data.success) throw new Error(res.data.error || 'Gagal buat order');
  return res.data; // { order_id, phone, price, status }
}

// ─── Cek Status & Ambil OTP ───────────────────────────────────────────────────
async function checkOrder(orderId) {
  const res = await axios.get(`${BASE_URL}/check.php`, {
    headers,
    params: { order_id: orderId }
  });
  if (!res.data.success) throw new Error(res.data.error || 'Gagal cek order');
  return res.data; // { order_id, phone, status, otp }
}

// ─── Batalkan & Refund ────────────────────────────────────────────────────────
async function cancelOrder(orderId) {
  const params = new URLSearchParams({ order_id: orderId });
  const res = await axios.post(`${BASE_URL}/cancel.php`, params.toString(), {
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  if (!res.data.success) {
    const err = new Error(res.data.error || 'Gagal batalkan order');
    err.error_code = res.data.error_code;
    err.wait_seconds = res.data.wait_seconds;
    throw err;
  }
  return res.data; // { refunded, message }
}

// ─── Minta SMS Ulang ──────────────────────────────────────────────────────────
async function resendSms(orderId) {
  const params = new URLSearchParams({ order_id: orderId });
  const res = await axios.post(`${BASE_URL}/resend.php`, params.toString(), {
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  if (!res.data.success) throw new Error(res.data.error || 'Gagal kirim ulang SMS');
  return res.data; // { message }
}

// ─── Riwayat Order (semua server) ────────────────────────────────────────────
async function getHistory({ status, limit = 20, page = 1 } = {}) {
  const params = { limit, page };
  if (status) params.status = status;

  const res = await axios.get(`${BASE_URL}/history.php`, { headers, params });
  if (!res.data.success) throw new Error('Gagal ambil riwayat');
  return res.data; // { total, page, data: [...] }
}

module.exports = {
  getBalance,
  getCountries,
  getServices,
  getServicesByCountry,
  getOperators,
  buyNumber,
  checkOrder,
  cancelOrder,
  resendSms,
  getHistory
};