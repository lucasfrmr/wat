const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// === CONFIG ===
const SOURCE_CHAT_ID = "15129217431-1500313387@g.us";
const POST_CHAT_ID   = "120363417869857840@g.us";

// === FILTER CONFIGURATION ===
const FILTER_CONFIG = {
  // Staff IDs to monitor (WhatsApp format with @c.us suffix)
  staffIds: [
    "15127382268@c.us",
    "17024189209@c.us",
    "18329676321@c.us"
  ],
  
  // Staff phone numbers (without @c.us suffix) for text matching
  staffPhones: [
    "15127382268",
    "17024189209", 
    "18329676321"
  ],
  
  // Keywords that indicate IT support is being mentioned
  keywords: [
    "IT",
    "IT Support",
    "it support",
    "@it support",
    "@it suport",
    "i.t",
    "@i.t",
    "it help",
    "tech support",
    "it team",
    "it department"
  ]
};
// ================

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
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

  try {
    const chats = await client.getChats();
    console.log('📋 List of all chats:');
    chats.forEach(chat => {
      console.log(`- ${chat.name || chat.formattedTitle || chat.id.user || chat.id._serialized}: ${chat.id._serialized}`);
      
      // Check if this is our source chat and log it prominently
      if (chat.id._serialized === SOURCE_CHAT_ID) {
        console.log(`🔔 FOUND SOURCE CHAT: ${chat.name || chat.formattedTitle} (${chat.id._serialized})`);
      }
      
      // Check if this is our post chat and log it prominently
      if (chat.id._serialized === POST_CHAT_ID) {
        console.log(`🔔 FOUND POST CHAT: ${chat.name || chat.formattedTitle} (${chat.id._serialized})`);
      }
    });
    
    // Verify we can get the chats by ID
    try {
      const sourceChat = await client.getChatById(SOURCE_CHAT_ID);
      const postChat = await client.getChatById(POST_CHAT_ID);
      console.log(`✅ Successfully got source chat: ${sourceChat.name || sourceChat.formattedTitle}`);
      console.log(`✅ Successfully got post chat: ${postChat.name || postChat.formattedTitle}`);
      
      // Skip historical messages and only process new ones going forward
      console.log('✅ Bot is now active and listening for new messages');
      console.log('✅ Only mirroring new messages from now on - skipping historical message processing');
    } catch (err) {
      console.error('⚠️ Error accessing chats by ID:', err);
      console.log('⚠️ Please check if the chat IDs are correct in the CONFIG section');
    }
  } catch (err) {
    console.error('⚠️ Error fetching chats:', err);
  }
});

// Function to list recent messages from the source chat with comprehensive details
async function listRecentMessages(sourceChat, count) {
  try {
    console.log(`\n📜 Listing the last ${count} messages from the source chat...`);
    
    const messages = await sourceChat.fetchMessages({ limit: count });
    
    console.log(`\n============= LAST ${messages.length} MESSAGES =============`);
    messages.reverse().forEach((msg, index) => {
      const timestamp = new Date(msg.timestamp * 1000).toLocaleString();
      const sender = msg._data.notifyName || (msg.fromMe ? 'You' : 'Unknown');
      const hasMedia = msg.hasMedia ? '📷' : '';
      const mentionsIT = 
        (msg.body && (
          msg.body.toLowerCase().includes('it support') || 
          msg.body.toLowerCase().includes('@it') || 
          msg.body.toLowerCase().includes('tech')
        )) ? '🔔' : '';
      
      // Create a comprehensive details section with all available info
      let details = '\n    ----- MESSAGE DETAILS -----';
      
      // Basic metadata
      details += `\n    Message ID: ${msg.id._serialized || 'Unknown'}`;
      details += `\n    From Chat: ${msg.from || 'Unknown'}`;
      details += `\n    To: ${msg.to || 'Unknown'}`;
      details += `\n    Author ID: ${msg._data.author || 'Unknown'}`;
      details += `\n    Sender Name: ${sender}`;
      details += `\n    Timestamp: ${timestamp}`;
      details += `\n    Is From Me: ${msg.fromMe ? 'Yes' : 'No'}`;
      details += `\n    Has Media: ${msg.hasMedia ? 'Yes' : 'No'}`;
      details += `\n    Media Type: ${msg._data.type || 'None'}`;
      
      // Reply chain info
      if (msg._data.quotedMsg) {
        details += '\n    ----- REPLY INFO -----';
        details += `\n    Replying to Message ID: ${msg._data.quotedMsg.id?._serialized || 'Unknown'}`;
        details += `\n    Reply Sender: ${msg._data.quotedMsg.sender || 'Unknown'}`;
        details += `\n    Reply Sender Name: ${msg._data.quotedMsg._data?.notifyName || 'Unknown'}`;
        details += `\n    Reply Content: ${msg._data.quotedMsg.body || '[MEDIA]'}`;
        details += `\n    Reply Has Media: ${msg._data.quotedMsg.hasMedia ? 'Yes' : 'No'}`;
      }
      
      // Mention information
      if (msg.mentionedIds && msg.mentionedIds.length > 0 || 
          msg._data.mentionedJidList && msg._data.mentionedJidList.length > 0) {
        details += '\n    ----- MENTIONS -----';
        
        if (msg.mentionedIds && msg.mentionedIds.length > 0) {
          details += `\n    Mentioned IDs: ${JSON.stringify(msg.mentionedIds)}`;
        }
        
        if (msg._data.mentionedJidList && msg._data.mentionedJidList.length > 0) {
          details += `\n    Mentioned JIDs: ${JSON.stringify(msg._data.mentionedJidList)}`;
        }
      }
      
      // Raw data - dumps ALL available data for maximum debugging
      details += '\n    ----- RAW DATA DUMP -----';
      const safeData = { ...msg._data };
      // Remove circular references and complex objects
      delete safeData.id;
      delete safeData._data;
      details += `\n    ${JSON.stringify(safeData, null, 2).replace(/^/gm, '    ')}`;
      
      console.log(`${index + 1}. [${timestamp}] ${hasMedia} ${mentionsIT} ${sender}: ${msg.body || '[MEDIA]'}${details}`);
      console.log('---------------------------------------------');
    });
    console.log('=====================================================\n');
    
    return messages;
  } catch (err) {
    console.error('⚠️ Error listing message history:', err);
    return [];
  }
}

// Using the IDs configured at the top of the file

// Function to fetch and mirror recent messages that mention IT Support
async function fetchAndMirrorRecentMessages(sourceChat, count) {
  try {
    console.log(`🔍 Fetching the last ${count} messages from the source chat...`);
    
    // Fetch more messages than needed to ensure we get enough after filtering
    const fetchCount = count * 3; // Fetch 3x more to have enough after filtering
    const messages = await sourceChat.fetchMessages({ limit: fetchCount });
    
    console.log(`📥 Retrieved ${messages.length} messages from history`);
    
    // Log all detected mentions for later analysis
    const allMentionedJids = new Set();
    messages.forEach(msg => {
      if (msg._data.mentionedJidList && msg._data.mentionedJidList.length) {
        msg._data.mentionedJidList.forEach(jid => allMentionedJids.add(jid));
      }
    });
    console.log(`\n📊 All mentioned JIDs in the chat: ${Array.from(allMentionedJids).join(', ')}`);
    
    // Filter messages that mention IT Support - with broader detection
    const relevantMessages = messages.filter(msg => {
      if (!msg.body && !msg._data.notifyName) return false;
      
      // Check the message body for IT Support mentions with variations
      const messageBody = msg.body ? msg.body.toLowerCase() : '';
      const notifyName = msg._data.notifyName ? msg._data.notifyName.toLowerCase() : '';
      
      // Check if any IT Support staff was mentioned directly
      let directlyMentioned = false;
      
      // Check mentionedJidList for direct mentions of our IT staff
      if (msg._data.mentionedJidList && msg._data.mentionedJidList.length) {
        directlyMentioned = msg._data.mentionedJidList.some(jid => 
          // Check against our known IT Support staff IDs from the config
          FILTER_CONFIG.staffIds.includes(jid) || 
          // Look for JIDs that might be IT staff even if not in our list yet
          (typeof jid === 'string' && 
            (jid.includes('it') || jid.toLowerCase().includes('support') || jid.toLowerCase().includes('tech')))
        );
      }
      
      // Also check for mentions of these specific phone numbers in the text
      // Sometimes they might be mentioned without proper @ format in WhatsApp
      if (!directlyMentioned && msg.body) {
        directlyMentioned = FILTER_CONFIG.staffPhones.some(phone => 
          msg.body.includes(phone) || msg.body.includes(`@${phone}`)
        );
      }
      
      // Check if message contains any keywords from our configuration
      const containsKeyword = FILTER_CONFIG.keywords.some(keyword => 
        messageBody.includes(keyword.toLowerCase())
      );
      
      // Check if sender name contains any of our keywords
      const senderNameMatches = FILTER_CONFIG.keywords.some(keyword =>
        notifyName.includes(keyword.toLowerCase())
      );
      
      // Final determination if this message should be mirrored
      const mentionsITSupport = 
        containsKeyword || 
        senderNameMatches || 
        directlyMentioned;
      
      return mentionsITSupport;
    });
    
    console.log(`✅ Found ${relevantMessages.length} messages mentioning IT Support`);
    
    // Get last N messages (up to count)
    const messagesToMirror = relevantMessages.slice(0, count);
    
    // Process each message in sequence
    console.log(`🔄 Mirroring ${messagesToMirror.length} messages...`);
    
    for (const msg of messagesToMirror) {
      console.log(`\n📩 [HISTORY] ${msg._data.notifyName || 'Unknown'}: ${msg.body}`);
      await processMessageForMirroring(msg);
      
      // Short delay between messages to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`✅ Done mirroring historical messages`);
  } catch (err) {
    console.error('⚠️ Error fetching message history:', err);
  }
}

// 3) On every new message…
client.on('message', async msg => {
  // Debug all incoming messages
  console.log(`\n🔍 [DEBUG] Message detected:
    - From: ${msg.from}
    - To: ${msg.to}
    - Chat ID: ${msg._data.id.remote}
    - Author: ${msg._data.author || 'self'}
    - Name: ${msg._data.notifyName || 'Unknown'}
  `);

  // Adjusted source chat detection to include all messages from the source chat
  const isFromSourceChat = msg.from === SOURCE_CHAT_ID || msg.to === SOURCE_CHAT_ID || 
                          msg._data.id.remote === SOURCE_CHAT_ID || 
                          (msg._data.author && msg._data.author.includes(SOURCE_CHAT_ID.split('@')[0]));
  
  if (!isFromSourceChat) {
    console.log(`⏭️ Skipping message (not from source chat)`);
    return;
  }

  console.log(`\n📩 [SRC] ${msg._data.notifyName || 'Unknown'}: ${msg.body}`);
  
  // Check if the message is from or to IT staff
  const messageAuthorId = msg._data.author || msg.from;
  const isFromStaff = FILTER_CONFIG.staffIds.some(id => messageAuthorId && messageAuthorId.includes(id.split('@')[0]));
  
  // Check if directed to staff (mentioned in message)
  const isToStaff = msg.mentionedIds?.some(id => 
    FILTER_CONFIG.staffIds.some(staffId => id && id.includes(staffId.split('@')[0]))
  );
  
  // Check for staff phone numbers in the message
  const mentionsStaffPhone = FILTER_CONFIG.staffPhones.some(phone => 
    msg.body && (msg.body.includes(phone) || msg.body.includes(`@${phone}`))
  );
  
  // Check for keyword mentions
  const mentionsKeyword = FILTER_CONFIG.keywords.some(keyword => 
    msg.body && msg.body.toLowerCase().includes(keyword.toLowerCase())
  );
  
  // Mirror if the message is from staff, to staff, or mentions staff/IT keywords
  if (isFromStaff || isToStaff || mentionsStaffPhone || mentionsKeyword) {
    if (isFromStaff) {
      console.log(`✅ Message FROM IT staff - will mirror this message`);
    } else if (isToStaff) {
      console.log(`✅ Message TO IT staff - will mirror this message`);
    } else {
      console.log(`✅ Message mentions IT Support - will mirror this message`);
    }
    // Process message for mirroring
    await processMessageForMirroring(msg);
  } else {
    console.log(`⏭️ Skipping message (not related to IT Support)`);
  }
});

// Add handler for message_create to capture ALL messages including your own
client.on('message_create', async msg => {
  console.log(`\n🔍 [DEBUG] Message_create detected:
    - From: ${msg.from}
    - To: ${msg.to}
    - Chat ID: ${msg._data.id.remote}
    - Author: ${msg._data.author || 'self'}
    - Name: ${msg._data.notifyName || 'Unknown'}
    - Body: ${msg.body}
  `);
  
  // Check if this is in our source chat
  const isFromSourceChat = msg.from === SOURCE_CHAT_ID || msg.to === SOURCE_CHAT_ID || 
                          msg._data.id.remote === SOURCE_CHAT_ID;
  
  if (isFromSourceChat) {
    console.log(`\n📩 [SRC-CREATED] Message in source chat: ${msg.body}`);
    
    // Check if the message is from or to IT staff
    const messageAuthorId = msg._data.author || msg.from;
    const isFromStaff = FILTER_CONFIG.staffIds.some(id => messageAuthorId && messageAuthorId.includes(id.split('@')[0]));
    
    // Check if directed to staff (mentioned in message)
    const isToStaff = msg.mentionedIds?.some(id => 
      FILTER_CONFIG.staffIds.some(staffId => id && id.includes(staffId.split('@')[0]))
    );
    
    // Check for staff phone numbers in the message
    const mentionsStaffPhone = FILTER_CONFIG.staffPhones.some(phone => 
      msg.body && (msg.body.includes(phone) || msg.body.includes(`@${phone}`))
    );
    
    // Check for keyword mentions
    const mentionsKeyword = FILTER_CONFIG.keywords.some(keyword => 
      msg.body && msg.body.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Mirror if the message is from staff, to staff, or mentions staff/IT keywords
    if (isFromStaff || isToStaff || mentionsStaffPhone || mentionsKeyword) {
      if (isFromStaff) {
        console.log(`✅ Message FROM IT staff - will mirror this message`);
      } else if (isToStaff) {
        console.log(`✅ Message TO IT staff - will mirror this message`);
      } else {
        console.log(`✅ Message mentions IT Support - will mirror this message`);
      }
      // Process message for mirroring
      await processMessageForMirroring(msg);
    } else {
      console.log(`⏭️ Skipping message (not related to IT Support)`);
    }
  }
});

// Extract message processing to a separate function to avoid code duplication
async function processMessageForMirroring(msg) {
  const tgt = await client.getChatById(POST_CHAT_ID);

  try {
    let translated = '';
    if (msg.body) {
      console.log('[DEBUG] Translating text…');
      translated = await translateToEnglish(msg.body);
      console.log(`[DEBUG] Translated: "${translated}"`);
    }

    if (msg.hasMedia) {
      console.log('[DEBUG] Downloading media…');
      const media = await msg.downloadMedia();
      if (media) {
        const caption = translated || undefined;
        await tgt.sendMessage(media, { caption });
        console.log('✅ [MEDIA] Sent media with caption');
      } else {
        console.warn('⚠️ Could not download media');
      }
    } else if (translated) {
      // Use sender name if available, otherwise use "You" for own messages
      const senderName = msg._data.notifyName || (msg.fromMe ? 'You' : 'Unknown');
      await tgt.sendMessage(`🌐 [${senderName}]:\n\n🇺🇸 ${translated}`);
      console.log(`✅ [EN] Sent translated text`);
    }
  } catch (err) {
    console.error('⚠️ Translation/post error:', err);
  }
}


// 4) Event handlers
client.on('auth_failure', msg => console.error('🔒 Auth failure:', msg));
client.on('disconnected', reason => console.log('🔌 Disconnected:', reason));

// 5) Translation helper
async function translateToEnglish(text) {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'auto',
    tl: 'en',
    dt: 't',
    q: text
  });
  const res = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
  const data = await res.json();
  return data[0].map(seg => seg[0]).join('');
}

// 6) Start
client.initialize();
