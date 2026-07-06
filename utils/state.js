const state = {};

function setState(chatId, data) {
  state[chatId] = { ...state[chatId], ...data };
}

function getState(chatId) {
  return state[chatId] || {};
}

function clearState(chatId) {
  delete state[chatId];
}

module.exports = { setState, getState, clearState };