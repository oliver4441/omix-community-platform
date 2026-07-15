// Firestore Data Store — Full-featured community chat

var SESSION_ID = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
var TYPING_TIMEOUT = null;

// User color palette
var USER_COLORS = ['#5865f2','#ed4245','#faa61a','#57f287','#eb459e','#00b0f0','#ff73fa','#95efb8','#fee75c','#b0aa8e'];

function getUserColor(name) {
  var hash = 0;
  for (var i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

var Store = {
  servers: [],
  channels: [],
  messages: [],
  pinnedMessages: [],
  typingUsers: [],
  onlineUsers: [],
  currentServerId: localStorage.getItem('omix_server') || 'server1',
  currentChannelId: localStorage.getItem('omix_channel') || 'channel1',
  isAdmin: localStorage.getItem('omix_admin') === 'true',
  listeners: [],
  typingListeners: [],
  presenceListeners: [],
  pinListeners: [],

  // === ADMIN ===
  verifyAdminPassword: function(password) {
    return db.collection('config').doc('settings').get().then(function(doc) {
      if (!doc.exists) {
        // First-time setup — store the password
        return db.collection('config').doc('settings').set({
          adminPassword: password
        }).then(function() { return true; });
      }
      return doc.data().adminPassword === password;
    });
  },

  setAdmin: function(val) {
    Store.isAdmin = val;
    localStorage.setItem('omix_admin', val ? 'true' : '');
  },

  // === SERVERS ===
  subscribeServers: function(callback) {
    var unsub = db.collection('servers').orderBy('name').onSnapshot(function(snapshot) {
      Store.servers = [];
      snapshot.forEach(function(doc) {
        Store.servers.push({ id: doc.id, ...doc.data() });
      });
      callback('servers', Store.servers);
    });
    Store.listeners.push(unsub);
    return unsub;
  },

  createServer: function(name) {
    return db.collection('servers').add({
      name: name.trim(),
      icon: '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(ref) { return ref.id; });
  },

  deleteServer: function(serverId) {
    if (!Store.isAdmin) return Promise.reject('Admin only');
    return db.collection('servers').doc(serverId).delete();
  },

  // === CHANNELS ===
  subscribeChannels: function(serverId, callback) {
    Store.cleanupTyping();
    Store.cleanupPresence();
    Store.cleanupPins();
    var unsub = db.collection('channels')
      .where('serverId', '==', serverId)
      .orderBy('name')
      .onSnapshot(function(snapshot) {
        Store.channels = [];
        snapshot.forEach(function(doc) {
          Store.channels.push({ id: doc.id, ...doc.data() });
        });
        callback('channels', Store.channels);
      });
    Store.listeners.push(unsub);
    return unsub;
  },

  createChannel: function(serverId, name, category) {
    return db.collection('channels').add({
      serverId: serverId,
      name: name.toLowerCase().replace(/\s+/g, '-'),
      category: category || 'Text Channels',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(ref) {
      Store.currentChannelId = ref.id;
      localStorage.setItem('omix_channel', ref.id);
      return ref.id;
    });
  },

  deleteChannel: function(channelId) {
    if (!Store.isAdmin) return Promise.reject('Admin only');
    return db.collection('channels').doc(channelId).delete();
  },

  // === MESSAGES ===
  subscribeMessages: function(channelId, callback) {
    Store.cleanupTyping();
    var unsub = db.collection('messages')
      .where('channelId', '==', channelId)
      .orderBy('timestamp', 'asc')
      .onSnapshot(function(snapshot) {
        Store.messages = [];
        snapshot.forEach(function(doc) {
          var d = doc.data();
          if (!d.pinned) {
            Store.messages.push({ id: doc.id, ...d });
          }
        });
        callback('messages', Store.messages);
      });
    Store.listeners.push(unsub);
    return unsub;
  },

  sendMessage: function(channelId, text, displayName, opts) {
    opts = opts || {};
    if (!text.trim() && !opts.fileUrl) return Promise.resolve();
    var msg = {
      channelId: channelId,
      author: displayName || 'Anonymous',
      text: text.trim(),
      authorId: SESSION_ID,
      sessionId: SESSION_ID,
      color: getUserColor(displayName),
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      reactions: {}
    };
    if (opts.fileUrl) { msg.fileUrl = opts.fileUrl; msg.fileType = opts.fileType || 'image'; }
    if (opts.replyTo) { msg.replyTo = opts.replyTo; }
    return db.collection('messages').add(msg);
  },

  editMessage: function(messageId, newText) {
    return db.collection('messages').doc(messageId).update({
      text: newText.trim(),
      edited: true,
      editedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  deleteMessage: function(messageId) {
    return db.collection('messages').doc(messageId).delete();
  },

  // === PINS ===
  togglePin: function(messageId) {
    if (!Store.isAdmin) return Promise.reject('Admin only');
    return db.collection('messages').doc(messageId).get().then(function(doc) {
      if (!doc.exists) return;
      var data = doc.data();
      if (data.pinned) {
        return db.collection('messages').doc(messageId).update({ pinned: false });
      } else {
        return db.collection('messages').doc(messageId).update({ pinned: true, pinnedAt: firebase.firestore.FieldValue.serverTimestamp() });
      }
    });
  },

  subscribePins: function(channelId, callback) {
    var unsub = db.collection('messages')
      .where('channelId', '==', channelId)
      .where('pinned', '==', true)
      .onSnapshot(function(snapshot) {
        var pins = [];
        snapshot.forEach(function(doc) {
          pins.push({ id: doc.id, ...doc.data() });
        });
        Store.pinnedMessages = pins;
        callback(pins);
      });
    Store.pinListeners.push(unsub);
    return unsub;
  },

  cleanupPins: function() {
    Store.pinListeners.forEach(function(u) { u(); });
    Store.pinListeners = [];
  },

  // === REACTIONS ===
  toggleReaction: function(messageId, emoji, displayName) {
    var ref = db.collection('messages').doc(messageId);
    return ref.get().then(function(doc) {
      if (!doc.exists) return;
      var data = doc.data();
      var reactions = data.reactions || {};
      var users = reactions[emoji] || [];
      var idx = users.indexOf(displayName);
      if (idx > -1) {
        users.splice(idx, 1);
        if (users.length === 0) { delete reactions[emoji]; }
        else { reactions[emoji] = users; }
      } else {
        users.push(displayName);
        reactions[emoji] = users;
      }
      return ref.update({ reactions: reactions });
    });
  },

  // === TYPING ===
  startTyping: function(channelId, displayName) {
    if (!channelId || !displayName) return;
    var ref = db.collection('typing').doc(channelId + '_' + SESSION_ID);
    ref.set({
      channelId: channelId,
      name: displayName,
      sessionId: SESSION_ID,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    if (TYPING_TIMEOUT) clearTimeout(TYPING_TIMEOUT);
    TYPING_TIMEOUT = setTimeout(function() { ref.delete(); }, 3000);
  },

  stopTyping: function(channelId) {
    if (TYPING_TIMEOUT) { clearTimeout(TYPING_TIMEOUT); TYPING_TIMEOUT = null; }
    if (!channelId) return;
    db.collection('typing').doc(channelId + '_' + SESSION_ID).delete();
  },

  subscribeTyping: function(channelId, callback) {
    if (!channelId) return function(){};
    var unsub = db.collection('typing')
      .where('channelId', '==', channelId)
      .onSnapshot(function(snapshot) {
        var users = [];
        snapshot.forEach(function(doc) {
          var data = doc.data();
          if (data.name && data.sessionId !== SESSION_ID) {
            users.push(data.name);
          }
        });
        Store.typingUsers = users;
        callback(users);
      });
    Store.typingListeners.push(unsub);
    return unsub;
  },

  cleanupTyping: function() {
    Store.typingListeners.forEach(function(u) { try { u(); } catch(e) {} });
    Store.typingListeners = [];
  },

  // === PRESENCE ===
  setPresence: function(displayName) {
    var ref = db.collection('presence').doc(SESSION_ID);
    var heartbeat = function() { ref.update({ online: true, lastSeen: firebase.firestore.FieldValue.serverTimestamp() }); };
    ref.set({ name: displayName, online: true, color: getUserColor(displayName), lastSeen: firebase.firestore.FieldValue.serverTimestamp() });
    setInterval(heartbeat, 30000);
    window.addEventListener('beforeunload', function() { ref.update({ online: false }); });
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) { ref.update({ online: false }); }
      else { ref.update({ online: true, lastSeen: firebase.firestore.FieldValue.serverTimestamp() }); }
    });
  },

  subscribePresence: function(callback) {
    var unsub = db.collection('presence')
      .where('online', '==', true)
      .onSnapshot(function(snapshot) {
        var users = [];
        snapshot.forEach(function(doc) {
          var data = doc.data();
          if (data.name) { users.push({ name: data.name, id: doc.id, color: data.color }); }
        });
        Store.onlineUsers = users;
        callback(users);
      });
    Store.presenceListeners.push(unsub);
    return unsub;
  },

  cleanupPresence: function() {
    Store.presenceListeners.forEach(function(u) { try { u(); } catch(e) {} });
    Store.presenceListeners = [];
  },

  // === FILE UPLOAD ===
  uploadFile: function(file, channelId, displayName) {
    return new Promise(function(resolve, reject) {
      if (file.size > 5 * 1024 * 1024) { reject('File too large'); return; }
      var reader = new FileReader();
      reader.onload = function(e) {
        Store.sendMessage(channelId, '', displayName, { fileUrl: e.target.result, fileType: file.type });
        resolve();
      };
      reader.onerror = function() { reject('Failed to read file'); };
      reader.readAsDataURL(file);
    });
  },

  // === UNREAD ===
  unreadCounts: {},
  markChannelRead: function(channelId) {
    Store.unreadCounts[channelId] = 0;
    try { localStorage.setItem('omix_unread', JSON.stringify(Store.unreadCounts)); } catch(e) {}
  },
  incrementUnread: function(channelId) {
    if (channelId === Store.currentChannelId) return;
    Store.unreadCounts[channelId] = (Store.unreadCounts[channelId] || 0) + 1;
    try { localStorage.setItem('omix_unread', JSON.stringify(Store.unreadCounts)); } catch(e) {}
  },
  loadUnread: function() {
    try {
      var saved = JSON.parse(localStorage.getItem('omix_unread') || '{}');
      Store.unreadCounts = saved;
    } catch(e) { Store.unreadCounts = {}; }
  },

  // === CLEANUP ===
  cleanup: function() {
    Store.listeners.forEach(function(u) { try { u(); } catch(e) {} });
    Store.listeners = [];
    Store.cleanupTyping();
    Store.cleanupPresence();
    Store.cleanupPins();
  }
};

Store.loadUnread();
