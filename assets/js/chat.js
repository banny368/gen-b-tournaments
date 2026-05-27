/**
 * @file chat.js
 * @description Gen B Tournaments — Realtime Chat System Module
 * Handles global/match/clan chat channels via Supabase Realtime.
 * Depends on: config.js, supabase.js, utils.js
 */

'use strict';

function _sb() {
  if (!window._supabaseClient) {
    window._supabaseClient = supabase.createClient(
      GENBCONFIG.supabase.url,
      GENBCONFIG.supabase.anonKey
    );
  }
  return window._supabaseClient;
}

/* ─────────────────────────────────────────────────────────────────────────────
   STATE
   ───────────────────────────────────────────────────────────────────────────── */

const _chat = {
  /** @type {import('@supabase/supabase-js').RealtimeChannel|null} */
  channel: null,
  channelType: 'global',
  channelId: 'global',
  userId: null,
  username: 'Player',
  avatarUrl: null,
  emojiPickerOpen: false,
  isAtBottom: true,
};

/* ─────────────────────────────────────────────────────────────────────────────
   DATA FUNCTIONS
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Fetch recent messages for a channel.
 * @param {'global'|'match'|'clan'} channelType
 * @param {string} channelId
 * @param {number} [limit=50]
 * @returns {Promise<Array>}
 */
async function getMessages(channelType, channelId, limit = 50) {
  try {
    const { data, error } = await _sb()
      .from('messages')
      .select('*, users:user_id(username, avatar_url)')
      .eq('channel_type', channelType)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).reverse();
  } catch (err) {
    console.error('[getMessages]', err);
    return [];
  }
}

/**
 * Send a message to a channel.
 * @param {'global'|'match'|'clan'} channelType
 * @param {string} channelId
 * @param {string} userId
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function sendMessage(channelType, channelId, userId, text) {
  try {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) return false;

    const { error } = await _sb().from('messages').insert({
      channel_type: channelType,
      channel_id: channelId,
      user_id: userId,
      text: trimmed,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[sendMessage]', err);
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   REALTIME SUBSCRIPTION
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Subscribe to a Supabase Realtime channel for new messages.
 * @param {{ type: string, id: string }} channel
 * @returns {import('@supabase/supabase-js').RealtimeChannel}
 */
function subscribeToChannel(channel) {
  // Remove previous subscription
  if (_chat.channel) {
    _sb().removeChannel(_chat.channel);
    _chat.channel = null;
  }

  const channelName = `chat:${channel.type}:${channel.id}`;

  const rtChannel = _sb()
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_type=eq.${channel.type}`,
      },
      async (payload) => {
        const msg = payload.new;
        if (msg.channel_id !== channel.id) return;

        // Fetch sender info if not embedded
        if (!msg.users) {
          const { data: userData } = await _sb()
            .from('users')
            .select('username, avatar_url')
            .eq('id', msg.user_id)
            .single();
          msg.users = userData || {};
        }

        handleNewMessage(msg);
      }
    )
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        console.log(`[chat] Subscribed to ${channelName}`);
      }
    });

  _chat.channel = rtChannel;
  return rtChannel;
}

/* ─────────────────────────────────────────────────────────────────────────────
   RENDER FUNCTIONS
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Returns HTML for a chat message bubble.
 * @param {Object} msg
 * @param {string} currentUserId
 * @returns {string}
 */
function renderMessage(msg, currentUserId) {
  const isMine = msg.user_id === currentUserId;
  const avatar = msg.users?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.user_id}`;
  const username = msg.users?.username || 'Player';
  const timeStr = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '';

  if (isMine) {
    return `
<div class="flex justify-end gap-2 mb-2 group" data-msg-id="${msg.id || ''}">
  <div class="max-w-[75%]">
    <div class="flex justify-end mb-0.5">
      <span class="text-[10px] text-gray-500">${timeStr}</span>
    </div>
    <div class="px-3 py-2 rounded-2xl rounded-tr-sm text-sm text-white break-words"
         style="background:linear-gradient(135deg,#b14aed,#7c3aed);">
      ${_escapeHtml(msg.text)}
    </div>
  </div>
  <img src="${avatar}" alt="${username}"
       class="w-7 h-7 rounded-full object-cover border border-[#b14aed]/40 self-end flex-shrink-0"
       onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${msg.user_id}'">
</div>`.trim();
  }

  return `
<div class="flex gap-2 mb-2 group" data-msg-id="${msg.id || ''}">
  <img src="${avatar}" alt="${username}"
       class="w-7 h-7 rounded-full object-cover border border-white/10 self-end flex-shrink-0"
       onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${msg.user_id}'">
  <div class="max-w-[75%]">
    <div class="flex items-center gap-1.5 mb-0.5">
      <span class="text-[10px] font-semibold text-[#00d4ff]">${_escapeHtml(username)}</span>
      <span class="text-[10px] text-gray-600">${timeStr}</span>
    </div>
    <div class="px-3 py-2 rounded-2xl rounded-tl-sm text-sm text-gray-100 break-words"
         style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08);">
      ${_escapeHtml(msg.text)}
    </div>
  </div>
</div>`.trim();
}

/** Escape HTML to prevent XSS */
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ─────────────────────────────────────────────────────────────────────────────
   LIVE MESSAGE HANDLER
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Append a new realtime message to the chat window.
 * @param {Object} msg
 */
function handleNewMessage(msg) {
  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return;

  const html = renderMessage(msg, _chat.userId);
  messagesEl.insertAdjacentHTML('beforeend', html);

  // Auto-scroll only if user was near the bottom
  if (_chat.isAtBottom) {
    _scrollToBottom();
  } else {
    // Show "new message" nudge
    const nudge = document.getElementById('chat-new-msg-nudge');
    if (nudge) nudge.classList.remove('hidden');
  }
}

/** Scroll chat window to bottom */
function _scrollToBottom() {
  const el = document.getElementById('chat-messages');
  if (el) el.scrollTop = el.scrollHeight;
}

/* ─────────────────────────────────────────────────────────────────────────────
   INIT FUNCTIONS
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Initialise a chat channel (load messages + subscribe).
 * @param {'global'|'match'|'clan'} channelType
 * @param {string} channelId
 * @param {string} userId
 */
async function initChat(channelType, channelId, userId) {
  _chat.channelType = channelType;
  _chat.channelId = channelId;
  _chat.userId = userId;

  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return;

  // Loading state
  messagesEl.innerHTML = `
    <div class="flex items-center justify-center py-10 text-gray-500">
      <div class="w-6 h-6 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin mr-2"></div>
      Loading messages...
    </div>`;

  const messages = await getMessages(channelType, channelId);

  if (messages.length === 0) {
    messagesEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-gray-500">
        <i data-lucide="message-circle" class="w-10 h-10 mb-2 opacity-30"></i>
        <p class="text-sm">No messages yet. Say hello! 👋</p>
      </div>`;
    lucide.createIcons();
  } else {
    messagesEl.innerHTML = messages.map(m => renderMessage(m, userId)).join('');
    _scrollToBottom();
  }

  // Subscribe to realtime
  subscribeToChannel({ type: channelType, id: channelId });
}

const _EMOJIS = ['😊','🎮','🏆','🔥','💥','⚡','👏','🥇','💀','🎯','👑','🎉','😂','😎','🤣','❤️','👍','💪','🙌','✌️'];

/**
 * Initialise the full chat page with tabs and input handlers.
 */
async function initChatPage() {
  const { data: { user } } = await _sb().auth.getUser();
  if (!user) { window.location.href = '/auth.html'; return; }

  const userId = user.id;
  _chat.userId = userId;

  // Fetch user info
  const { data: profile } = await _sb().from('users').select('username, avatar_url, clan_id').eq('id', userId).single();
  _chat.username = profile?.username || 'Player';
  _chat.avatarUrl = profile?.avatar_url || null;

  // ── Tab Switching ──────────────────────────────────────────
  async function switchChannel(type, id) {
    document.querySelectorAll('[data-chat-tab]').forEach(t => {
      t.classList.remove('active', 'text-[#00d4ff]', 'border-[#00d4ff]');
      t.classList.add('text-gray-400', 'border-transparent');
    });
    const activeTab = document.querySelector(`[data-chat-tab="${type}"]`);
    if (activeTab) {
      activeTab.classList.add('active', 'text-[#00d4ff]', 'border-[#00d4ff]');
      activeTab.classList.remove('text-gray-400', 'border-transparent');
    }

    // Update channel header
    const headerEl = document.getElementById('chat-channel-name');
    const typeLabels = { global: '🌍 Global', match: '⚔️ Match', clan: '🏴 Clan' };
    if (headerEl) headerEl.textContent = typeLabels[type] || type;

    await initChat(type, id, userId);
  }

  // Tab click handlers
  document.querySelectorAll('[data-chat-tab]').forEach(tab => {
    tab.addEventListener('click', async () => {
      const type = tab.dataset.chatTab;
      let channelId = type === 'global' ? 'global' : tab.dataset.channelId || type;

      if (type === 'clan') {
        if (!profile?.clan_id) {
          showToast('Join a clan to access clan chat.', 'warning');
          return;
        }
        channelId = profile.clan_id;
      }

      await switchChannel(type, channelId);
    });
  });

  // ── Message Input ──────────────────────────────────────────
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');

  async function handleSend() {
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = '';
    inputEl.focus();

    // Optimistic render
    const optimisticMsg = {
      id: `opt_${Date.now()}`,
      user_id: userId,
      channel_type: _chat.channelType,
      channel_id: _chat.channelId,
      text,
      created_at: new Date().toISOString(),
      users: { username: _chat.username, avatar_url: _chat.avatarUrl },
    };
    handleNewMessage(optimisticMsg);

    const ok = await sendMessage(_chat.channelType, _chat.channelId, userId, text);
    if (!ok) {
      showToast('Failed to send message.', 'error');
    }
  }

  if (sendBtn) sendBtn.addEventListener('click', handleSend);

  if (inputEl) {
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  }

  // ── Emoji Picker ───────────────────────────────────────────
  const emojiBtn = document.getElementById('emoji-btn');
  const emojiPicker = document.getElementById('emoji-picker');

  if (emojiPicker) {
    emojiPicker.innerHTML = _EMOJIS.map(e =>
      `<button class="w-8 h-8 text-lg hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center emoji-btn-item"
               data-emoji="${e}">${e}</button>`
    ).join('');

    emojiPicker.addEventListener('click', e => {
      const btn = e.target.closest('.emoji-btn-item');
      if (!btn) return;
      if (inputEl) {
        const pos = inputEl.selectionStart || inputEl.value.length;
        inputEl.value = inputEl.value.slice(0, pos) + btn.dataset.emoji + inputEl.value.slice(pos);
        inputEl.focus();
        inputEl.selectionStart = inputEl.selectionEnd = pos + 2;
      }
      emojiPicker.classList.add('hidden');
      _chat.emojiPickerOpen = false;
    });
  }

  if (emojiBtn && emojiPicker) {
    emojiBtn.addEventListener('click', e => {
      e.stopPropagation();
      _chat.emojiPickerOpen = !_chat.emojiPickerOpen;
      emojiPicker.classList.toggle('hidden', !_chat.emojiPickerOpen);
    });

    document.addEventListener('click', e => {
      if (_chat.emojiPickerOpen && !emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        emojiPicker.classList.add('hidden');
        _chat.emojiPickerOpen = false;
      }
    });
  }

  // ── Scroll tracking ────────────────────────────────────────
  const messagesEl = document.getElementById('chat-messages');
  if (messagesEl) {
    messagesEl.addEventListener('scroll', () => {
      const distFromBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
      _chat.isAtBottom = distFromBottom < 60;

      if (_chat.isAtBottom) {
        const nudge = document.getElementById('chat-new-msg-nudge');
        if (nudge) nudge.classList.add('hidden');
      }
    });
  }

  // "New message" nudge click
  const nudge = document.getElementById('chat-new-msg-nudge');
  if (nudge) {
    nudge.addEventListener('click', () => {
      _scrollToBottom();
      nudge.classList.add('hidden');
    });
  }

  // ── Start with global channel ──────────────────────────────
  await switchChannel('global', 'global');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChatPage);
} else {
  initChatPage();
}
