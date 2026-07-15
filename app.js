class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('ErrorBoundary:', error, errorInfo.componentStack); }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', { className: 'min-h-screen flex items-center justify-center bg-[var(--bg-chat)]' },
        React.createElement('div', { className: 'text-center p-8 animate-fade-up' },
          React.createElement('img', { src: 'logo.jpg', className: 'w-20 h-20 rounded-2xl mx-auto mb-4 object-cover', alt: 'Omix' }),
          React.createElement('h1', { className: 'text-2xl font-bold text-[var(--text-primary)] mb-2' }, 'Something went wrong'),
          React.createElement('p', { className: 'text-[var(--text-muted)] mb-4' }, this.state.error.message),
          React.createElement('button', { onClick: function() { window.location.reload(); }, className: 'btn-accent px-6 py-2 rounded font-semibold' }, 'Reload')
        )
      );
    }
    return this.props.children;
  }
}

function WelcomeScreen({ onEnter }) {
  var nameState = React.useState('');
  var setName = nameState[1];
  var adminState = React.useState(false);
  var showAdmin = adminState[0];
  var setShowAdmin = adminState[1];
  var passState = React.useState('');
  var setPass = passState[1];
  var errorState = React.useState('');
  var setError = errorState[1];
  var loadingState = React.useState(false);
  var loading = loadingState[0];
  var setLoading = loadingState[1];
  var onlineCountState = React.useState(0);
  var onlineCount = onlineCountState[0];
  var setOnlineCount = onlineCountState[1];

  React.useEffect(function() {
    var cb = function(users) { setOnlineCount(users.length); };
    Store.subscribePresence(cb);
  }, []);

  var handleJoin = function(e) {
    e.preventDefault();
    var name = nameState[0].trim();
    if (!name) return;
    setLoading(true);
    setError('');

    if (showAdmin && passState[0].trim()) {
      Store.verifyAdminPassword(passState[0].trim()).then(function(ok) {
        if (ok) {
          Store.setAdmin(true);
          onEnter(name);
        } else {
          setError('Incorrect admin password');
          setLoading(false);
        }
      }).catch(function() {
        setError('Could not verify password. Try again.');
        setLoading(false);
      });
    } else {
      if (showAdmin && !passState[0].trim()) {
        setError('Enter the admin password');
        setLoading(false);
        return;
      }
      onEnter(name);
    }
  };

  return React.createElement('div', { className: 'min-h-screen flex items-center justify-center p-4',
    style: { background: 'linear-gradient(135deg, #0f0f13 0%, #1a1b2e 30%, #1e1f22 60%, #0f0f13 100%)' } },
    // Animated gradient overlay
    React.createElement('div', { className: 'fixed inset-0 animate-gradient pointer-events-none opacity-30',
      style: { background: 'linear-gradient(135deg, #5865f2 0%, transparent 30%, #4752c4 50%, transparent 70%, #5865f2 100%)', backgroundSize: '200% 200%' } }),
    
    // Decorative dots
    React.createElement('div', { className: 'fixed inset-0 pointer-events-none opacity-[0.03]',
      style: { backgroundImage: 'radial-gradient(circle, #5865f2 1px, transparent 1px)', backgroundSize: '30px 30px' } }),

    React.createElement('div', { className: 'bg-[var(--bg-sidebar)] rounded-2xl p-8 w-full max-w-md shadow-2xl border border-gray-800 relative animate-fade-up',
      style: { animationDelay: '0.1s' } },
      
      // Logo + Title
      React.createElement('div', { className: 'text-center mb-6' },
        React.createElement('img', { src: 'logo.jpg',
          className: 'w-24 h-24 rounded-2xl mx-auto mb-4 shadow-lg object-cover',
          alt: 'Omix Community', style: { boxShadow: '0 8px 32px rgba(88,101,242,0.25)' } }),
        React.createElement('h1', { className: 'text-2xl font-bold text-[var(--text-primary)]' }, 'Omix Community'),
        React.createElement('p', { className: 'text-[var(--text-muted)] text-sm mt-1' }, 'Join the conversation')
      ),

      // Online count banner with pulse
      React.createElement('div', { className: 'bg-[#232428] rounded-lg px-4 py-2 mb-6 flex items-center justify-center gap-2 text-sm' },
        React.createElement('div', { className: 'flex items-center gap-2' },
          React.createElement('div', { className: 'w-2 h-2 rounded-full bg-[var(--online)]', style: { animation: 'pulse 2s ease infinite' } }),
          React.createElement('span', { className: 'text-[var(--text-muted)]' }, onlineCount + ' online now')
        )
      ),

      // Form
      React.createElement('form', { onSubmit: handleJoin, className: 'space-y-4' },
        React.createElement('div', null,
          React.createElement('label', { className: 'text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider' }, 'Display Name'),
          React.createElement('input', { type: 'text', onChange: function(e) { setName(e.target.value); },
            className: 'w-full bg-[#1e1f22] text-[var(--text-primary)] rounded-lg p-3 mt-1 outline-none focus:ring-2 focus:ring-[var(--accent)] border border-gray-700 transition-all',
            placeholder: 'Your name', required: true, maxLength: 20 })
        ),

        // Admin toggle
        React.createElement('div', { className: 'flex items-center gap-2' },
          React.createElement('input', { type: 'checkbox', id: 'adminToggle', onChange: function(e) { setShowAdmin(e.target.checked); setError(''); },
            className: 'w-4 h-4 rounded accent-[var(--accent)]' }),
          React.createElement('label', { htmlFor: 'adminToggle', className: 'text-sm text-[var(--text-muted)] cursor-pointer' },
            'Sign in as admin')
        ),

        // Admin password
        showAdmin && React.createElement('div', { className: 'animate-fade-up' },
          React.createElement('input', { type: 'password', onChange: function(e) { setPass(e.target.value); },
            className: 'w-full bg-[#1e1f22] text-[var(--text-primary)] rounded-lg p-3 outline-none focus:ring-2 focus:ring-[var(--accent)] border border-gray-700 transition-all',
            placeholder: 'Admin password' })
        ),

        errorState[0] && React.createElement('p', { className: 'text-red-400 text-sm animate-fade-up' }, errorState[0]),

        React.createElement('button', { type: 'submit', disabled: loading,
          className: 'btn-accent w-full p-3 rounded-lg font-semibold text-base disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]' +
            (loading ? ' opacity-70 cursor-not-allowed' : '') },
          loading ? React.createElement('span', { className: 'flex items-center justify-center gap-2' },
            React.createElement('span', { className: 'w-4 h-4 border-2 border-white border-t-transparent rounded-full', style: { animation: 'spin 0.8s linear infinite' } }),
            'Verifying...'
          ) : 'Join Community'
        )
      ),

      // Footer
      React.createElement('p', { className: 'text-center mt-6 text-xs text-[var(--text-muted)]' },
        'Built on Firebase — Real-time community chat')
    )
  );
}

function App() {
  var viewState = React.useState('chat');
  var setView = viewState[1];
  var mobileState = React.useState(window.innerWidth < 768);
  var setIsMobile = mobileState[1];
  var loadedState = React.useState(false);
  var setLoaded = loadedState[1];

  React.useEffect(function() {
    // Entrance animation
    setTimeout(function() { setLoaded(true); }, 100);
    var h = function() { setIsMobile(window.innerWidth < 768); };
    window.addEventListener('resize', h);
    return function() { window.removeEventListener('resize', h); };
  }, []);

  var savedName = localStorage.getItem('omix_username');
  if (!savedName) {
    return React.createElement(WelcomeScreen, { onEnter: function(name) {
      localStorage.setItem('omix_username', name);
      window.location.reload();
    }});
  }

  return React.createElement('div', { className: 'h-screen w-full flex bg-[var(--bg-chat)] overflow-hidden' + (loadedState[0] ? ' opacity-100' : ' opacity-0'),
    style: { transition: 'opacity 0.3s ease' } },
    React.createElement(Layout, { isMobile: mobileState[0], currentView: viewState[0], setView: setView, displayName: savedName })
  );
}

var root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(ErrorBoundary, null, React.createElement(App)));
