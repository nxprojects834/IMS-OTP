const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data.json');

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, orders: {} }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH));
  } catch {
    return { users: {}, orders: {} };
  }
}

function saveDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getUser(chatId) {
  const db = loadDb();
  if (!db.users[chatId]) {
    db.users[chatId] = {
      chatId: chatId.toString(),
      balance: 0,       // Rupiah (integer)
      totalOrder: 0,
      joinDate: new Date().toISOString()
    };
    saveDb(db);
  }
  return db.users[chatId];
}

function updateUser(chatId, data) {
  const db = loadDb();
  db.users[chatId] = { ...db.users[chatId], ...data };
  saveDb(db);
}

function topUpUser(chatId, amount) {
  const db = loadDb();
  if (!db.users[chatId]) {
    db.users[chatId] = {
      chatId: chatId.toString(),
      balance: 0,
      totalOrder: 0,
      joinDate: new Date().toISOString()
    };
  }
  db.users[chatId].balance = (db.users[chatId].balance || 0) + amount;
  saveDb(db);
  return db.users[chatId].balance;
}

function deductUser(chatId, amount) {
  const db = loadDb();
  if (!db.users[chatId] || db.users[chatId].balance < amount) return false;
  db.users[chatId].balance -= amount;
  saveDb(db);
  return true;
}

// order = { id (order_id), phone, service, price, status }
function saveOrder(chatId, order) {
  const db = loadDb();
  if (!db.orders[chatId]) db.orders[chatId] = [];
  db.orders[chatId].unshift({
    id: order.id,
    phone: order.phone,
    service: order.service,
    price: order.price,      // Rupiah
    status: order.status,
    createdAt: new Date().toISOString()
  });
  db.orders[chatId] = db.orders[chatId].slice(0, 10); // Simpan max 10
  saveDb(db);
}

function getOrders(chatId) {
  const db = loadDb();
  return db.orders[chatId] || [];
}

function getAllUsers() {
  const db = loadDb();
  return db.users;
}

function getUserCount() {
  const db = loadDb();
  return Object.keys(db.users).length;
}

module.exports = {
  getUser,
  updateUser,
  topUpUser,
  deductUser,
  saveOrder,
  getOrders,
  getAllUsers,
  getUserCount
};