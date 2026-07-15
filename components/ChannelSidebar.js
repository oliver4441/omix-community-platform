function ChannelSidebar({ isMobile, currentView, displayName }) {
  var channels = React.useState(Store.channels);
  var setChannels = channels[1];
  var activeState = React.useState(Store.currentChannelId);
  var activeChannel = activeState[0];
  var setActiveChannel = activeState[1];
  var onlineState = React.useState([]);
  var onlineUsers = onlineState[0];
  var setOnlineUsers = onlineState[1];
  var showCreate = React.useState(false);
  var setShowCreate = showCreate[1];
  var newChanName = React.useState('');
  var setNewChanName = newChanName[1];
  var unreadState = React.useState(Object.assign({}, Store.unreadCounts));
  var unreadCounts = unreadState[0];
  var setUnreadCounts = unreadState[1];
  var isAdmin = Store.isAdmin;

  React.useEffect(function() {
    var serverId = Store.currentServerId;
    var cb = function(type, data) { if (type === 'channels') setChannels([].concat(data)); };
    var unsub = Store.subscribeChannels(serverId, cb);
    Store.setPresence(displayName || 'Guest');
    var presenceCb = function(users) { setOnlineUsers([].concat(users)); };
    var presenceUnsub = Store.subscribePresence(presenceCb);
    var unreadInterval = setInterval(function() { setUnreadCounts(Object.assign({}, Store.unreadCounts)); }, 2000);

    var handler = function(e) {
      Store.cleanup();
      Store.subscribeChannels(e.detail, cb);
      Store.setPresence(displayName || 'Guest');
      setActiveChannel(null);
    };
    window.addEventListener('serverChanged', handler);
    return function() { unsub(); presenceUnsub(); clearInterval(unreadInterval); window.removeEventListener('serverChanged', handler); };
  }, []);

  var selectChannel = function(channelId) {
    Store.currentChannelId = channelId;
    localStorage.setItem('omix_channel', channelId);
    setActiveChannel(channelId);
    Store.messages = [];
    Store.markChannelRead(channelId);
    setUnreadCounts(Object.assign({}, Store.unreadCounts));
    window.dispatchEvent(new CustomEvent('channelChanged', {detail: channelId}));
  };

  var createChannel = function(e) {
    e.preventDefault();
    if (!newChanName.trim()) return;
    Store.createChannel(Store.currentServerId, newChanName.trim());
    setShowCreate(false);
    setNewChanName('');
  };

  var deleteChannel = function(channelId, name) {
    if (!isAdmin) return;
    if (confirm('Delete #' + name + '? This cannot be undone.')) {
      Store.deleteChannel(channelId);
    }
  };

  if (isMobile && currentView !== 'channels') return null;

  var categories = {};
  Store.channels.forEach(function(ch) {
    var cat = ch.category || 'Text Channels';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(ch);
  });

  return React.createElement('div', {
    className: 'w-[240px] bg-[var(--bg-sidebar)] h-full flex flex-col flex-shrink-0' + (isMobile ? ' w-full' : ''),
    'data-name': 'channel-sidebar' },

    // Server header with logo
    React.createElement('div', { className: 'h-12 border-b border-[var(--bg-rail)] flex items-center px-3 shadow-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)] gap-2' },
      React.createElement('img', { src: 'logo.jpg', className: 'w-7 h-7 rounded-md object-cover shrink-0', alt: '' }),
      React.createElement('span', { className: 'font-bold text-[var(--text-primary)] text-sm truncate' }, 'Omix Community'),
      isAdmin && React.createElement('span', { className: 'ml-auto text-[10px] bg-[var(--accent)] text-white px-1.5 py-0.5 rounded font-medium' }, 'ADMIN'),
      React.createElement('div', { className: 'icon-chevron-down text-lg text-[var(--text-muted)]' })
    ),

    // Online count
    React.createElement('div', { className: 'text-xs text-[var(--text-muted)] px-4 py-2 flex items-center gap-1.5 border-b border-[var(--bg-rail)]' },
      React.createElement('div', { className: 'w-2 h-2 rounded-full bg-[var(--online)]', style: { animation: 'pulse 2s ease infinite' } }),
      React.createElement('span', null, onlineUsers.length, ' online'),
      React.createElement('div', { className: 'flex ml-2' },
        onlineUsers.slice(0, 5).map(function(u) {
          return React.createElement('div', { key: u.id, className: 'w-5 h-5 rounded-full bg-[var(--bg-hover)] -ml-1 border-2 border-[var(--bg-sidebar)] flex items-center justify-center text-[9px] font-bold',
            style: { color: u.color || '#fff', backgroundColor: u.color ? u.color + '33' : '' }, title: u.name },
            u.name.charAt(0).toUpperCase());
        }),
        onlineUsers.length > 5 && React.createElement('div', { className: 'w-5 h-5 rounded-full bg-[var(--bg-hover)] -ml-1 border-2 border-[var(--bg-sidebar)] flex items-center justify-center text-[9px] text-[var(--text-muted)]' },
          '+' + (onlineUsers.length - 5))
      )
    ),

    // Channel list
    React.createElement('div', { className: 'flex-1 overflow-y-auto scroll-custom p-2' },
      Object.keys(categories).map(function(catName) {
        return React.createElement('div', { key: catName },
          React.createElement('div', { className: 'text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 mt-4 px-2 flex justify-between items-center group cursor-pointer hover:text-[var(--text-primary)] transition-colors' },
            catName,
            React.createElement('button', { onClick: function() { setShowCreate(true); },
              className: 'icon-plus hidden group-hover:block text-lg hover:text-[var(--text-primary)] transition-colors' })
          ),
          categories[catName].map(function(channel) {
            var unread = unreadCounts[channel.id] || 0;
            return React.createElement('div', { key: channel.id, onClick: function() { selectChannel(channel.id); },
              className: 'flex items-center px-2 py-1.5 mx-1 rounded-lg cursor-pointer group mb-[2px] transition-colors ' +
                (activeChannel === channel.id
                  ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]') },

              React.createElement('div', { className: 'icon-hash text-lg mr-1.5 opacity-60 shrink-0' }),
              React.createElement('span', { className: 'truncate flex-1 text-sm ' + (unread > 0 ? 'text-[var(--text-primary)] font-semibold' : '') }, channel.name),

              // Admin delete button
              isAdmin && React.createElement('button', { onClick: function(e) { e.stopPropagation(); deleteChannel(channel.id, channel.name); },
                className: 'hidden group-hover:block text-xs text-[var(--text-muted)] hover:text-red-400 mr-1 transition-colors' }, '✕'),

              unread > 0 && React.createElement('span', { className: 'ml-1 bg-[var(--accent)] text-white text-xs rounded-full px-1.5 py-0.5 font-bold min-w-[18px] text-center leading-tight' },
                unread > 9 ? '9+' : unread)
            );
          })
        );
      }),

      // Create channel form
      showCreate && React.createElement('div', { className: 'mt-4 px-2' },
        React.createElement('form', { onSubmit: createChannel, className: 'flex flex-col gap-2' },
          React.createElement('input', { type: 'text', placeholder: 'Channel name', onChange: function(e) { setNewChanName(e.target.value); },
            className: 'bg-[#1e1f22] text-[var(--text-primary)] rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]', autoFocus: true }),
          React.createElement('div', { className: 'flex gap-2' },
            React.createElement('button', { type: 'submit', className: 'btn-accent text-xs px-3 py-1.5 rounded flex-1' }, 'Create'),
            React.createElement('button', { type: 'button', onClick: function() { setShowCreate(false); },
              className: 'text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-3 py-1.5' }, 'Cancel')
          )
        )
      )
    ),

    // User footer
    React.createElement('div', { className: 'h-[52px] bg-[#232428] px-2 py-1.5 flex items-center gap-2 shrink-0' },
      React.createElement('div', { className: 'relative cursor-pointer hover:opacity-80 transition-opacity rounded-full w-8 h-8 flex-shrink-0',
        style: { backgroundColor: getUserColor(displayName) + '33' } },
        React.createElement('div', { className: 'w-full h-full rounded-full flex items-center justify-center text-sm font-bold',
          style: { color: getUserColor(displayName) } },
          (displayName || '?').charAt(0).toUpperCase()
        ),
        React.createElement('div', { className: 'absolute bottom-0 right-0 w-3 h-3 bg-[var(--online)] rounded-full border-2 border-[#232428]' })
      ),
      React.createElement('div', { className: 'flex-col flex-1 min-w-0 cursor-pointer' },
        React.createElement('div', { className: 'text-sm font-semibold text-[var(--text-primary)] truncate flex items-center gap-1' },
          displayName || 'Guest',
          isAdmin && React.createElement('span', { className: 'text-xs text-[var(--accent)] font-medium' }, '🛡️')
        ),
        React.createElement('div', { className: 'text-xs text-[var(--text-muted)] truncate hover:underline' }, 'Online')
      ),
      React.createElement('div', { className: 'flex gap-1' },
        React.createElement('button', { onClick: function() { var a = confirm('Sign out?'); if (a) { localStorage.removeItem('omix_username'); localStorage.removeItem('omix_admin'); window.location.reload(); } },
          className: 'w-8 h-8 rounded hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors', title: 'Sign out' },
          React.createElement('div', { className: 'icon-log-out text-lg' })
        )
      )
    )
  );
}
