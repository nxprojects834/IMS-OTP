const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { BOT_TOKEN, WEBHOOK_URL, PORT } = require('./config');

const bot = new TelegramBot(BOT_TOKEN);
const app = express();
app.use(express.json());

bot.setWebHook(`${WEBHOOK_URL}/bot${BOT_TOKEN}`);
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get('/', (req, res) => res.send('Bot is running!'));

require('./handlers/commands')(bot);
require('./handlers/callbacks')(bot);
require('./handlers/admin')(bot);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Bot berjalan di port ${PORT}`);
});