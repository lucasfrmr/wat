const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// === CONFIG ===
const SOURCE_CHAT_ID = "120363401637851953@g.us";
const POST_CHAT_ID   = "120363417869857840@g.us";

// Initialize client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox','--disable-setuid-sandbox'] }
});

// 1) QR code for login
client.on('qr', qr => {
  console.log('🔍 Scan this QR code:');
  qrcode.generate(qr, { small: true });
});

// 2) Ready event
client.on('ready', () => {
  console.log('✅ Client ready—listening for new messages in your source group.');
});

// // 3) message_create fires once for each new incoming message (and your own)
// client.on('message_create', async msg => {
//   // 3a) Skip messages sent by the bot itself
//   if (msg.fromMe) return;

//   // 3b) Only care about messages *to* the source group
//   if (msg.to !== SOURCE_CHAT_ID) {
//     return;
//   }

//   console.log(`📩 Received in SOURCE: ${msg.body || '[MEDIA]'}`);

//   // 3c) Detect Spanish
//   const text = msg.body || '';
//   const isSpanish = text.trim() && await detectSpanish(text);

//   let translation = '';
//   if (isSpanish) {
//     translation = await translateToEnglish(text);
//     console.log(`🌐 Translated: ${translation}`);
//   }

//   // 3d) Get the target chat and forward
//   const target = await client.getChatById(POST_CHAT_ID);

//   if (msg.hasMedia) {
//     const media = await msg.downloadMedia();
//     if (media) {
//       const caption = translation ? `🇺🇸 ${translation}` : undefined;
//       try {
//         await target.sendMessage(media, { caption });
//         console.log('✅ Forwarded media + caption');
//       } catch (err) {
//         console.warn('⚠️ Media forward failed, sending caption only');
//         if (caption) await target.sendMessage(caption);
//       }
//     }
//   } else if (translation) {
//     await target.sendMessage(`🌐 [Translated from Spanish]:\n\n${translation}`);
//     console.log('✅ Forwarded translated text');
//   } else {
//     console.log('⏭️ Not Spanish, no media → skipped.');
//   }
// });

client.on('message_create', async msg => {
  // Temporarily allow processing of messages sent by the bot itself:
  // if (msg.fromMe) return;

  // Only care about messages to the source group:
  if (msg.to !== SOURCE_CHAT_ID) {
    return;
  }

  console.log(`📩 Received in SOURCE: ${msg.body || '[MEDIA]'}`);

  // Detect Spanish
  const text = msg.body || '';
  const isSpanish = text.trim() && await detectSpanish(text);

  let translation = '';
  if (isSpanish) {
    translation = await translateToEnglish(text);
    console.log(`🌐 Translated: ${translation}`);
  }

  const target = await client.getChatById(POST_CHAT_ID);

  if (msg.hasMedia) {
    const media = await msg.downloadMedia();
    if (media) {
      const caption = translation ? `🇺🇸 ${translation}` : undefined;
      try {
        await target.sendMessage(media, { caption });
        console.log('✅ Forwarded media + caption');
      } catch (err) {
        console.warn('⚠️ Media forward failed, sending caption only');
        if (caption) await target.sendMessage(caption);
      }
    }
  } else if (translation) {
    await target.sendMessage(`🌐 [Translated from Spanish]:\n\n${translation}`);
    console.log('✅ Forwarded translated text');
  } else {
    console.log('⏭️ Not Spanish, no media → skipped.');
  }
});


// ——— Translation Helpers ———
async function detectSpanish(text) {
  const p = new URLSearchParams({ client:'gtx', sl:'auto', tl:'es', dt:'t', q:text });
  const r = await fetch(`https://translate.googleapis.com/translate_a/single?${p}`);
  const d = await r.json();
  console.log(`   → Detected language: ${d[2]}`);
  return d[2] === 'es';
}

async function translateToEnglish(text) {
  const p = new URLSearchParams({ client:'gtx', sl:'es', tl:'en', dt:'t', q:text });
  const r = await fetch(`https://translate.googleapis.com/translate_a/single?${p}`);
  const d = await r.json();
  return d[0].map(seg => seg[0]).join('');
}

// 4) Auth/disconnect handlers
client.on('auth_failure', e => console.error('🔒 Auth failure:', e));
client.on('disconnected', r => console.log('🔌 Disconnected:', r));

// 5) Start everything
client.initialize();
