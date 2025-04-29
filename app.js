// app.js

'use strict';

const { Client }     = require('whatsapp-web.js');
const qrcode         = require('qrcode-terminal');
const fetch          = require('node-fetch');  // v2.x

// === CONFIG ===
// Hardcoded chat IDs to avoid ambiguity and duplication
const SOURCE_CHAT_ID = "15129217431-1500313387@g.us";
const POST_CHAT_ID   = "120363417869857840@g.us";
// ================

const client = new Client({
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// 1) QR code for login
client.on('qr', qr => {
  console.log('🔍 Scan this QR code with WhatsApp on your phone:');
  qrcode.generate(qr, { small: true });
});

// 2) Once logged in…
client.on('ready', async () => {
  console.log('✅ Client is ready!');
  console.log(`[DEBUG] Using hardcoded chat IDs: source=${SOURCE_CHAT_ID}, post=${POST_CHAT_ID}`);

  // Initial sync: translate & repost the very last message
  try {
    console.log('[DEBUG] Fetching last message from source group…');
    const sourceChat = await client.getChatById(SOURCE_CHAT_ID);
    const msgs       = await sourceChat.fetchMessages({ limit: 1 });
    if (msgs.length) {
      const last = msgs[0];
      if (last.body) {
        const translated = await translateToEnglish(last.body);
        const target     = await client.getChatById(POST_CHAT_ID);
        // Format with both original and translated text
        const formattedMessage = `🌐 [${last._data.notifyName}]:\n\n🇪🇸 ${last.body}\n\n🇺🇸 ${translated}`;
        await target.sendMessage(formattedMessage);
        console.log('✅ [Initial repost] done');
      }
    }
  } catch (err) {
    console.error('⚠️ Initial sync error:', err);
  }
});

// 3) On every new message…
client.on('message', async msg => {
  if (msg.from !== SOURCE_CHAT_ID || !msg.body) return;
  console.log(`\n📩 [SRC] ${msg._data.notifyName}: ${msg.body}`);

  try {
    console.log('[DEBUG] Translating…');
    const en = await translateToEnglish(msg.body);
    console.log(`[DEBUG] Original: "${msg.body}"`);
    console.log(`[DEBUG] Translated: "${en}"`);
    const tgt = await client.getChatById(POST_CHAT_ID);
    // Format with both original and translated text
    const formattedMessage = `🌐 [${msg._data.notifyName}]:\n\n🇪🇸 ${msg.body}\n\n🇺🇸 ${en}`;
    await tgt.sendMessage(formattedMessage);
    console.log(`✅ [EN ] ${en}`);
  } catch (err) {
    console.error('⚠️ Translation/post error:', err);
  }
});

// 4) Helpers & event-handlers
client.on('auth_failure',   msg => console.error('🔒 Auth failure:', msg));
client.on('disconnected',   reason => console.log('🔌 Disconnected:', reason));

async function translateToEnglish(text) {
  const params = new URLSearchParams({
    client: 'gtx',
    sl:     'auto',
    tl:     'en',
    dt:     't',
    q:      text
  });
  const res  = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
  const data = await res.json();
  return data[0].map(seg => seg[0]).join('');
}

// 5) Start the client
client.initialize();