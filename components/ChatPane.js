var EMOJIS = ['😀','😎','🔥','❤️','🎉','👍','😂','🥳','💯','👏','✨','🤣','🙌','💪','😍','🤔','👀','🚀','💀','🤝','😭','😤','💜','🌟'];
var MENTION_RE = /@(\w*)$/;

function ChatPane({ isMobile, currentView, displayName }) {
  var messages = React.useState(Store.messages);
  var setMessages = messages[1];
  var inputState = React.useState('');
  var input = inputState[0];
  var setInput = inputState[1];
  var channelNameState = React.useState('general');
  var channelName = channelNameState[0];
  var setChannelName = channelNameState[1];
  var typingState = React.useState([]);
  var typingUsers = typingState[0];
  var setTypingUsers = typingState[1];
  var showEmoji = React.useState(false);
  var setShowEmoji = showEmoji[1];
  var editing = React.useState(null);
  var setEditing = editing[1];
  var editText = React.useState('');
  var setEditText = editText[1];
  var replyState = React.useState(null);
  var replyTo = replyState[0];
  var setReplyTo = replyState[1];
  var pinsState = React.useState([]);
  var pins = pinsState[0];
  var setPins = pinsState[1];
  var showMentions = React.useState(false);
  var setShowMentions = showMentions[1];
  var mentionQuery = React.useState('');
  var setMentionQuery = mentionQuery[1];
  var isAdmin = Store.isAdmin;

  React.useEffect(function() {
    var channelId = Store.currentChannelId;
    if (!channelId) return;

    var cb = function(t, data) { if (t === 'messages') setMessages([].concat(data)); };
    var unsub = Store.subscribeMessages(channelId, cb);
    var typingCb = function(u) { setTypingUsers([].concat(u)); };
    var typingUnsub = Store.subscribeTyping(channelId, typingCb);
    var pinsCb = function(p) { setPins([].concat(p)); };
    var pinsUnsub = Store.subscribePins(channelId, pinsCb);

    Store.markChannelRead(channelId);

    var handler = function(e) {
      Store.cleanup();
      Store.markChannelRead(e.detail);
      Store.subscribeMessages(e.detail, cb);
      Store.subscribeTyping(e.detail, typingCb);
      Store.subscribePins(e.detail, pinsCb);
      var ch = Store.channels.find(function(c) { return c.id === e.detail; });
      if (ch) setChannelName(ch.name);
      setShowEmoji(false);
      setReplyTo(null);
    };
    window.addEventListener('channelChanged', handler);
    return function() { unsub(); typingUnsub(); pinsUnsub(); window.removeEventListener('channelChanged', handler); };
  }, []);

  React.useEffect(function() {
    var container = document.getElementById('messages-container');
    if (container) { container.scrollTop = container.scrollHeight; }
  }, [Store.messages.length]);

  var sendMsg = function(e) {
    e.preventDefault();
    if (!input.trim()) return;
    var opts = {};
    if (replyTo) { opts.replyTo = { id: replyTo.id, author: replyTo.author, text: replyTo.text.substring(0, 80) }; }
    Store.stopTyping(Store.currentChannelId);
    Store.sendMessage(Store.currentChannelId, input, displayName || 'Anonymous', opts);
    setInput('');
    setReplyTo(null);
  };

  var handleInput = function(e) {
    var val = e.target.value;
    setInput(val);
    if (val.trim()) { Store.startTyping(Store.currentChannelId, displayName || 'Anonymous'); }
    else { Store.stopTyping(Store.currentChannelId); }

    // @mention detection
    var cursorPos = e.target.selectionStart;
    var beforeCursor = val.substring(0, cursorPos);
    var match = beforeCursor.match(MENTION_RE);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  var insertMention = function(name) {
    var cursorPos = document.getElementById('chat-input').selectionStart;
    var before = input.substring(0, cursorPos);
    var after = input.substring(cursorPos);
    var match = before.match(MENTION_RE);
    if (match) {
      var newVal = before.substring(0, before.length - match[0].length) + '@' + name + ' ' + after;
      setInput(newVal);
    }
    setShowMentions(false);
  };

  var addEmoji = function(emoji) { setInput(input + emoji); setShowEmoji(false); };
  var toggleReaction = function(msgId, emoji) { Store.toggleReaction(msgId, emoji, displayName || 'Anonymous'); };
  var startEdit = function(msg) { setEditing(msg.id); setEditText(msg.text); };
  var saveEdit = function(msgId) { if (editText.trim()) { Store.editMessage(msgId, editText); } setEditing(null); setEditText(''); };
  var confirmDelete = function(msgId) { if (confirm('Delete this message?')) { Store.deleteMessage(msgId); } };
  var togglePin = function(msgId) { Store.togglePin(msgId); };

  var handleFileSelect = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    Store.uploadFile(file, Store.currentChannelId, displayName || 'Anonymous');
    e.target.value = '';
  };

  // Filter mentions
  var filteredMentions = [];
  if (showMentions && mentionQuery !== undefined) {
    var allNames = [];
    Store.onlineUsers.forEach(function(u) { if (allNames.indexOf(u.name) === -1) allNames.push(u.name); });
    Store.messages.forEach(function(m) { if (allNames.indexOf(m.author) === -1 && m.author !== displayName) allNames.push(m.author); });
    filteredMentions = allNames.filter(function(n) { return n.toLowerCase().indexOf(mentionQuery) > -1; }).slice(0, 6);
  }

  if (isMobile && currentView !== 'chat') return null;

  return React.createElement('div', { className: 'flex-1 flex flex-col min-w-0 bg-[var(--bg-chat)]', 'data-name': 'chat-pane' },
    // Header
    React.createElement('div', { className: 'h-12 border-b border-[var(--bg-rail)] flex items-center px-4 shadow-sm shrink-0' },
      React.createElement('div', { className: 'icon-hash text-xl text-[var(--text-muted)] mr-2' }),
      React.createElement('span', { className: 'font-bold text-[var(--text-primary)] mr-4' }, channelName),
      React.createElement('div', { className: 'w-[1px] h-6 bg-[var(--bg-hover)] mx-2' }),
      React.createElement('span', { className: 'text-sm text-[var(--text-muted)] truncate flex-1' }, '#' + channelName),
      pins.length > 0 && React.createElement('div', { className: 'text-xs text-[var(--accent)] flex items-center gap-1 mr-2', title: pins.length + ' pinned message' + (pins.length > 1 ? 's' : '') },
        React.createElement('span', null, '📌'), React.createElement('span', null, pins.length)),
      React.createElement('div', { className: 'icon-search text-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors' })
    ),

    // Pinned messages banner
    pins.length > 0 && React.createElement('div', { className: 'bg-[#232428] border-b border-[var(--bg-rail)] px-4 py-2 text-sm flex items-center gap-2 shrink-0' },
      React.createElement('span', { className: 'text-[var(--accent)] font-bold' }, '📌 Pinned'),
      React.createElement('span', { className: 'text-[var(--text-muted)] truncate' }, pins[0].text.substring(0, 60) + (pins[0].text.length > 60 ? '...' : '')),
      React.createElement('span', { className: 'text-[var(--text-muted)] text-xs' }, '— ' + pins[0].author),
      pins.length > 1 && React.createElement('span', { className: 'text-[var(--text-muted)] text-xs' }, '+ ' + (pins.length - 1) + ' more')
    ),

    // Messages container
    React.createElement('div', { className: 'flex-1 overflow-y-auto scroll-custom p-4 flex flex-col gap-[2px]', id: 'messages-container' },
      Store.messages.length === 0 && React.createElement('div', { className: 'flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm' },
        'No messages yet. Say something!'),
      Store.messages.map(function(msg) {
        var isOwn = msg.sessionId === SESSION_ID;
        var reactions = msg.reactions || {};
        var hasFile = msg.fileUrl;
        var msgColor = msg.color || '#5865f2';
        var isPinned = msg.pinned;
        var avatarLetter = (msg.author || '?').charAt(0).toUpperCase();

        return React.createElement('div', { key: msg.id,
          className: 'flex gap-3 hover:bg-[var(--bg-message-hover)] -mx-4 px-4 py-1.5 rounded-lg group relative transition-colors' },
          // Avatar - colored circle with initial
          React.createElement('div', { className: 'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 mt-0.5 cursor-pointer',
            style: { backgroundColor: msgColor },
            title: msg.author },
            avatarLetter
          ),

          React.createElement('div', { className: 'flex-1 min-w-0' },
            // Author + Timestamp
            React.createElement('div', { className: 'flex items-baseline gap-2' },
              React.createElement('span', { className: 'font-semibold cursor-pointer hover:underline text-sm',
                style: { color: msgColor } },
                msg.author,
                msg.sessionId === SESSION_ID && React.createElement('span', { className: 'text-xs text-[var(--text-muted)] font-normal ml-1' }, '(you)')
              ),
              React.createElement('span', { className: 'text-xs text-[var(--text-muted)]' },
                msg.timestamp ? (msg.timestamp.toDate ? msg.timestamp.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '') : '',
                msg.edited ? ' (edited)' : '',
                isPinned ? ' 📌' : ''
              ),
              // Message actions
              React.createElement('span', { className: 'hidden group-hover:inline-flex gap-1 ml-2 transition-opacity' },
                React.createElement('button', { onClick: function() { setReplyTo({ id: msg.id, author: msg.author, text: msg.text }); },
                  className: 'text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors', title: 'Reply' }, '💬'),
                React.createElement('button', { onClick: function() { toggleReaction(msg.id, '👍'); },
                  className: 'text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors' }, '😊'),
                (isOwn || isAdmin) && React.createElement('button', { onClick: function() { startEdit(msg); },
                  className: 'text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors', title: 'Edit' }, '✏️'),
                (isOwn || isAdmin) && React.createElement('button', { onClick: function() { confirmDelete(msg.id); },
                  className: 'text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors', title: 'Delete' }, '🗑️'),
                isAdmin && React.createElement('button', { onClick: function() { togglePin(msg.id); },
                  className: 'text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors', title: isPinned ? 'Unpin' : 'Pin' },
                  isPinned ? '📌' : '📍')
              )
            ),

            // Reply context
            msg.replyTo && React.createElement('div', { className: 'text-xs text-[var(--text-muted)] border-l-2 border-[var(--text-muted)] pl-2 mt-0.5 mb-1 italic' },
              'Replying to ', React.createElement('span', { className: 'font-medium text-[var(--text-primary)]' }, msg.replyTo.author),
              ': ', msg.replyTo.text
            ),

            // Edit mode
            editing === msg.id
              ? React.createElement('div', { className: 'flex gap-2 mt-1' },
                  React.createElement('input', { type: 'text', value: editText, onChange: function(e) { setEditText(e.target.value); },
                    className: 'bg-[#1e1f22] text-[var(--text-primary)] rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] flex-1',
                    onKeyDown: function(e) { if (e.key === 'Enter') saveEdit(msg.id); if (e.key === 'Escape') setEditing(null); }, autoFocus: true }),
                  React.createElement('button', { onClick: function() { saveEdit(msg.id); }, className: 'text-xs text-[var(--accent)] hover:underline' }, 'Save'),
                  React.createElement('button', { onClick: function() { setEditing(null); }, className: 'text-xs text-[var(--text-muted)] hover:underline' }, 'Cancel')
                )
              : React.createElement('div', null,
                  React.createElement('span', { className: 'text-[var(--text-primary)] leading-relaxed text-sm' }, msg.text),
                  hasFile && msg.fileType && msg.fileType.startsWith('image') &&
                    React.createElement('div', { className: 'mt-2' },
                      React.createElement('img', { src: msg.fileUrl, className: 'max-w-xs max-h-72 rounded-xl border border-gray-700', alt: 'Shared image' })
                    ),
                  hasFile && msg.fileType && !msg.fileType.startsWith('image') &&
                    React.createElement('div', { className: 'mt-2' },
                      React.createElement('a', { href: msg.fileUrl, target: '_blank', className: 'text-[var(--accent)] hover:underline text-sm flex items-center gap-1' },
                        '📎 View attachment')
                    )
                ),

            // Reactions
            React.createElement('div', { className: 'flex gap-1 mt-1 flex-wrap' },
              Object.keys(reactions).map(function(emoji) {
                var users = reactions[emoji] || [];
                var hasReacted = users.indexOf(displayName) > -1;
                return React.createElement('button', { key: emoji, onClick: function() { toggleReaction(msg.id, emoji); },
                  className: 'text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-all ' +
                    (hasReacted ? 'bg-[var(--accent)] bg-opacity-20 border border-[var(--accent)]' : 'bg-[var(--bg-hover)] hover:bg-[var(--bg-hover)] border border-transparent') },
                  React.createElement('span', null, emoji),
                  React.createElement('span', { className: 'text-xs text-[var(--text-muted)]' }, users.length)
                );
              })
            )
          )
        );
      })
    ),

    // Typing indicator
    typingUsers.length > 0 && React.createElement('div', { className: 'px-4 pb-1 text-xs text-[var(--text-muted)] italic flex items-center gap-2' },
      React.createElement('div', { className: 'flex gap-0.5' },
        React.createElement('div', { className: 'w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]', style: { animation: 'pulse 1.5s ease infinite' } }),
        React.createElement('div', { className: 'w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]', style: { animation: 'pulse 1.5s ease infinite', animationDelay: '0.2s' } }),
        React.createElement('div', { className: 'w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]', style: { animation: 'pulse 1.5s ease infinite', animationDelay: '0.4s' } })
      ),
      React.createElement('span', null, typingUsers.join(', ') + ' ' + (typingUsers.length === 1 ? 'is' : 'are') + ' typing...')
    ),

    // Emoji picker
    showEmoji[0] && React.createElement('div', { className: 'px-4 pb-1' },
      React.createElement('div', { className: 'bg-[var(--bg-sidebar)] rounded-xl p-2 flex flex-wrap gap-1 max-h-32 overflow-y-auto border border-gray-700' },
        EMOJIS.map(function(emoji) {
          return React.createElement('button', { key: emoji, onClick: function() { addEmoji(emoji); },
            className: 'text-xl hover:bg-[var(--bg-hover)] rounded p-1 cursor-pointer transition-all hover:scale-110' }, emoji);
        })
      )
    ),

    // @mention dropdown
    showMentions && filteredMentions.length > 0 && React.createElement('div', { className: 'px-4 pb-1' },
      React.createElement('div', { className: 'bg-[var(--bg-sidebar)] rounded-xl p-1 border border-gray-700 max-h-36 overflow-y-auto' },
        filteredMentions.map(function(name) {
          return React.createElement('button', { key: name, onClick: function() { insertMention(name); },
            className: 'flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg w-full cursor-pointer' },
            React.createElement('span', { className: 'w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs text-white' }, '@'),
            name
          );
        })
      )
    ),

    // Reply indicator
    replyTo && React.createElement('div', { className: 'px-4 pt-2 pb-0 flex items-center gap-2 text-sm bg-[#232428] mx-4 rounded-t-lg border-t border-l border-r border-gray-700' },
      React.createElement('span', { className: 'text-[var(--text-muted)]' }, '💬 Replying to'),
      React.createElement('span', { className: 'font-medium text-[var(--text-primary)]' }, replyTo.author),
      React.createElement('span', { className: 'text-[var(--text-muted)] truncate flex-1' }, replyTo.text.substring(0, 40)),
      React.createElement('button', { onClick: function() { setReplyTo(null); }, className: 'text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors' }, '✕')
    ),

    // Input
    React.createElement('div', { className: 'p-4 pt-2 shrink-0' },
      React.createElement('form', { onSubmit: sendMsg, className: 'bg-[#383a40] rounded-xl p-3 flex items-start gap-3 border border-gray-700 focus-within:border-[var(--accent)] transition-all duration-200' },
        React.createElement('label', { className: 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-sidebar)] rounded-full p-1 h-6 w-6 flex items-center justify-center shrink-0 cursor-pointer transition-colors' },
          React.createElement('div', { className: 'icon-plus text-sm' }),
          React.createElement('input', { type: 'file', onChange: handleFileSelect, className: 'hidden', accept: 'image/*,.pdf,.doc,.docx,.txt' })
        ),
        React.createElement('input', { id: 'chat-input', type: 'text', value: input, onChange: handleInput,
          placeholder: 'Message #' + channelName + (isAdmin ? ' (Admin)' : ''),
          className: 'bg-transparent border-none outline-none text-[var(--text-primary)] w-full placeholder-[var(--text-muted)] text-sm',
          autoComplete: 'off'
        }),
        React.createElement('div', { className: 'flex items-center gap-2 text-[var(--text-muted)] shrink-0' },
          React.createElement('button', { type: 'button', onClick: function() { setShowEmoji(!showEmoji[0]); },
            className: 'icon-smile text-lg hover:text-[var(--text-primary)] cursor-pointer transition-colors' }),
          React.createElement('button', { type: 'submit',
            className: 'text-lg hover:text-[var(--text-primary)] cursor-pointer transition-colors ' + (input.trim() ? 'text-[var(--accent)]' : '') },
            React.createElement('span', null, '➤')
          )
        )
      )
    )
  );
}
