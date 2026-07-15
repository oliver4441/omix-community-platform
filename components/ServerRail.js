function ServerRail({ isMobile, currentView }) {
  var servers = React.useState(Store.servers);
  var setServers = servers[1];
  var showCreate = React.useState(false);
  var setShowCreate = showCreate[1];
  var newName = React.useState('');
  var setNewName = newName[1];
  var isAdmin = Store.isAdmin;

  React.useEffect(function() {
    var cb = function(type, data) { if (type === 'servers') setServers([].concat(data)); };
    var unsub = Store.subscribeServers(cb);
    return function() { unsub(); };
  }, []);

  var selectServer = function(serverId) {
    Store.currentServerId = serverId;
    localStorage.setItem('omix_server', serverId);
    Store.channels = [];
    Store.messages = [];
    window.dispatchEvent(new CustomEvent('serverChanged', {detail: serverId}));
  };

  var createServerFn = function(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    Store.createServer(newName.trim()).then(function(id) {
      selectServer(id);
      setShowCreate(false);
      setNewName('');
    });
  };

  var deleteServer = function(serverId, name) {
    if (!isAdmin) return;
    if (confirm('Delete server "' + name + '"? All channels will be orphaned.')) {
      Store.deleteServer(serverId);
    }
  };

  if (isMobile && currentView !== 'servers') return null;

  return React.createElement('div', {
    className: 'w-[72px] bg-[var(--bg-rail)] h-full flex flex-col items-center py-3 gap-2 overflow-y-auto scroll-custom z-10 shrink-0' + (isMobile ? ' w-full' : ''),
    'data-name': 'server-rail' },

    // Home icon
    React.createElement('div', { className: 'w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-[var(--bg-chat)] flex items-center justify-center text-[var(--text-primary)] cursor-pointer transition-all duration-200 group relative overflow-hidden' },
      React.createElement('img', { src: 'logo.jpg', className: 'w-full h-full object-cover', alt: 'Home' }),
      React.createElement('div', { className: 'absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full hidden group-hover:block' })
    ),

    React.createElement('div', { className: 'w-8 h-[2px] bg-[var(--bg-hover)] my-1 rounded-full' }),

    // Server list
    Store.servers.map(function(server) {
      var isActive = Store.currentServerId === server.id;
      return React.createElement('div', { key: server.id,
        onClick: function() { selectServer(server.id); },
        className: 'w-12 h-12 rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-200 overflow-hidden relative group ' +
          (isActive ? 'rounded-[16px] bg-[var(--accent)]' : 'bg-[var(--bg-chat)]'),
        title: server.name },
        server.icon
          ? React.createElement('img', { src: server.icon, alt: server.name, className: 'w-full h-full object-cover' })
          : React.createElement('span', { className: 'text-[var(--text-primary)] text-sm font-medium' }, server.name.charAt(0).toUpperCase()),
        React.createElement('div', { className: 'absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full ' + (isActive ? 'block' : 'hidden group-hover:block') }),
        isAdmin && React.createElement('button', { onClick: function(e) { e.stopPropagation(); deleteServer(server.id, server.name); },
          className: 'absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] opacity-0 group-hover:opacity-100 hover:scale-110 transition-all',
          title: 'Delete server' }, '✕')
      );
    }),

    // Create server button
    React.createElement('div', { onClick: function() { setShowCreate(true); },
      className: 'w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-[var(--bg-chat)] flex items-center justify-center text-[#23a559] hover:bg-[#23a559] hover:text-white cursor-pointer transition-all duration-200 mt-2' },
      React.createElement('div', { className: 'icon-plus text-2xl' })
    ),

    // Create server modal
    showCreate && React.createElement('div', { className: 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50',
      onClick: function(e) { if (e.target === e.currentTarget) setShowCreate(false); } },
      React.createElement('div', { className: 'bg-[var(--bg-sidebar)] rounded-xl p-6 w-80 shadow-2xl border border-gray-700',
        onClick: function(e) { e.stopPropagation(); } },
        React.createElement('h2', { className: 'text-lg font-bold text-[var(--text-primary)] mb-4' }, 'Create Server'),
        React.createElement('form', { onSubmit: createServerFn },
          React.createElement('input', { type: 'text', placeholder: 'Server name', value: newName, onChange: function(e) { setNewName(e.target.value); },
            className: 'w-full bg-[#1e1f22] text-[var(--text-primary)] rounded-lg p-3 mb-4 outline-none focus:ring-2 focus:ring-[var(--accent)] border border-gray-700', autoFocus: true }),
          React.createElement('div', { className: 'flex gap-2' },
            React.createElement('button', { type: 'submit', className: 'btn-accent px-4 py-2 rounded-lg flex-1 font-semibold' }, 'Create'),
            React.createElement('button', { type: 'button', onClick: function() { setShowCreate(false); setNewName(''); },
              className: 'text-[var(--text-muted)] hover:text-[var(--text-primary)] px-4 py-2' }, 'Cancel')
          )
        )
      )
    )
  );
}
