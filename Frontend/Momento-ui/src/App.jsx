import React, { useState, useEffect, useRef } from 'react';

// WS_URL uses localhost:8080 directly — bypassing the Vite proxy entirely.
// The proxy approach (ws://localhost:3000/ws) only works in dev if Vite's
// proxy is healthy. Direct connection to backend is more reliable and
// works in both dev and prod (just change the constant for prod).
const API_URL = '/api';
const WS_URL  = 'ws://localhost:8080/ws';

const generateUsername = () => {
  const adj  = ['quick','lazy','happy','brave','calm','eager','fancy','gentle','jolly','kind'][Math.floor(Math.random()*10)];
  const noun = ['fox','dog','cat','bear','lion','tiger','eagle','shark','wolf','panda'][Math.floor(Math.random()*10)];
  return `anon-${adj}-${noun}-${Math.random().toString(36).slice(2,6)}`;
};

export default function App() {
  const timerRef       = useRef(null);
  const wsRef          = useRef(null);     // the live WebSocket object
  const roomIdRef      = useRef('');       // mirror of roomId for use inside callbacks
  const usernameRef    = useRef('');       // mirror of username for use inside callbacks
  const messagesEndRef = useRef(null);
  const fileInputRef   = useRef(null);

  const [page,           setPage]           = useState('home');
  const [roomId,         setRoomId]         = useState('');
  const [username,       setUsername]       = useState(() => generateUsername());
  const [joinRoomId,     setJoinRoomId]     = useState('');
  const [messages,       setMessages]       = useState([]);
  const [messageInput,   setMessageInput]   = useState('');
  const [connected,      setConnected]      = useState(false);
  const [timeRemaining,  setTimeRemaining]  = useState(0);
  const [expiryMinutes,  setExpiryMinutes]  = useState(10);
  const [showEmojiPicker,setShowEmojiPicker]= useState(false);
  const [wsError,        setWsError]        = useState('');

  // Keep refs in sync with state so WS callbacks always see fresh values
  // without needing to be in dependency arrays.
  useEffect(() => { roomIdRef.current   = roomId;   }, [roomId]);
  useEffect(() => { usernameRef.current = username; }, [username]);

  const emojis = ['😀','😂','😍','🥰','😎','🤔','👍','👋','🎉','❤️','🔥','✨','💯','🚀','⭐','💪'];

  // ── scroll ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── countdown — only reacts to page change, NOT every tick ────────────────
  useEffect(() => {
    if (page !== 'chat') {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [page]); // ← only page, never timeRemaining

  // ── room-expired check ────────────────────────────────────────────────────
  useEffect(() => {
    if (page === 'chat' && timeRemaining === 0) {
      alert('Room has expired');
      doLeave();
    }
  }, [timeRemaining, page]);

  // ── helpers ────────────────────────────────────────────────────────────────
  const fmt = s => {
    if (!Number.isFinite(s) || s < 0) return '0:00';
    return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  };

  // doLeave uses refs so it's safe to call from anywhere including WS callbacks
  const doLeave = () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({
          type: 'LEAVE',
          roomId:  roomIdRef.current,
          sender:  usernameRef.current,
          content: `${usernameRef.current} left`,
        }));
      } catch (_) {}
    }
    if (ws) { ws.close(); wsRef.current = null; }
    clearInterval(timerRef.current);
    setPage('home');
    setMessages([]);
    setRoomId('');
    setJoinRoomId('');
    setConnected(false);
    setTimeRemaining(0);
    setWsError('');
    setUsername(generateUsername());
  };

  // ── create room ────────────────────────────────────────────────────────────
  const createRoom = async () => {
    const newUser = generateUsername();
    setUsername(newUser);
    usernameRef.current = newUser;
    try {
      const res  = await fetch(`${API_URL}/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiryMinutes }),
      });
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      setRoomId(data.roomId);
      roomIdRef.current = data.roomId;
      setTimeRemaining(data.remainingSeconds);
      setPage('room-created');
    } catch (e) {
      alert('Failed to create room — is the backend running on port 8080?');
    }
  };

  // ── join room ──────────────────────────────────────────────────────────────
  const joinRoom = async () => {
    const id = joinRoomId.trim();
    if (!id) { alert('Enter a Room ID'); return; }
    try {
      const res = await fetch(`${API_URL}/rooms/${id}`);
      if (!res.ok) { alert('Room not found or expired'); return; }
      const data = await res.json();
      const newUser = generateUsername();
      setUsername(newUser);
      usernameRef.current = newUser;
      setRoomId(id);
      roomIdRef.current = id;
      setTimeRemaining(data.remainingSeconds);
      setPage('username');
    } catch {
      alert('Failed to reach server');
    }
  };

  // ── connect WebSocket ──────────────────────────────────────────────────────
  const connectToChat = () => {
    // Guard: if there's already an open socket, don't make another
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setPage('chat');
      return;
    }

    setWsError('');
    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log('WS opened, readyState:', socket.readyState);
      wsRef.current = socket;
      setConnected(true);
      setPage('chat');
      socket.send(JSON.stringify({
        type:    'JOIN',
        roomId:  roomIdRef.current,
        sender:  usernameRef.current,
        content: `${usernameRef.current} joined`,
      }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ROOM_EXPIRED') { alert('Room expired'); doLeave(); return; }
        setMessages(prev => [...prev, msg]);
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    socket.onerror = (e) => {
      console.error('WebSocket error:', e);
      setWsError('Connection error — check backend is running');
      setConnected(false);
    };

    socket.onclose = (e) => {
      console.log('WS closed, code:', e.code, 'reason:', e.reason);
      setConnected(false);
      wsRef.current = null;
      // code 1000 = normal close, anything else is unexpected
      if (e.code !== 1000 && e.code !== 1001) {
        setWsError(`Connection lost (code ${e.code}) — try leaving and rejoining`);
      }
    };

    // Store immediately so the guard above works on fast double-clicks
    wsRef.current = socket;
  };

  // ── send message ───────────────────────────────────────────────────────────
  const sendMessage = () => {
    const ws = wsRef.current;
    const text = messageInput.trim();
    if (!text) return;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('WS not open, readyState:', ws?.readyState);
      setWsError('Not connected — try leaving and rejoining');
      return;
    }

    ws.send(JSON.stringify({
      type:      'CHAT',
      roomId:    roomIdRef.current,
      sender:    usernameRef.current,
      content:   text,
      timestamp: new Date().toISOString(),
    }));
    setMessageInput('');
    setShowEmojiPicker(false);
  };

  const addEmoji = (e) => { setMessageInput(p => p + e); setShowEmojiPicker(false); };
  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (f) setMessageInput(p => `${p}[File: ${f.name}]`);
  };

  // ── pages ──────────────────────────────────────────────────────────────────
  if (page === 'home') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-rose-400 to-red-600 bg-clip-text text-transparent mb-4">Momento</h1>
          <p className="text-slate-400 text-lg">Ephemeral conversations that disappear</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 mb-6 border border-slate-700/50 shadow-2xl">
          <h2 className="text-2xl font-semibold mb-4">Create Room</h2>
          <div className="mb-6">
            <label className="block text-sm text-slate-400 mb-3">Duration: {expiryMinutes} min</label>
            <input type="range" min="1" max="60" value={expiryMinutes}
              onChange={e => setExpiryMinutes(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"/>
          </div>
          <div className="bg-slate-700/50 rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-red-600 rounded-full flex items-center justify-center text-2xl">👤</div>
            <div>
              <p className="text-xs text-slate-500">You'll join as</p>
              <p className="text-white font-mono text-sm">{username}</p>
            </div>
          </div>
          <button onClick={createRoom}
            className="w-full bg-gradient-to-r from-rose-500 to-red-600 text-white font-semibold py-4 rounded-xl hover:from-rose-600 hover:to-red-700 transition-all shadow-lg shadow-rose-500/30">
            CREATE NEW ROOM
          </button>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
          <h2 className="text-2xl font-semibold mb-4">Join Room</h2>
          <input type="text" placeholder="Enter Room ID" value={joinRoomId}
            onChange={e => setJoinRoomId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && joinRoom()}
            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 mb-4"/>
          <button onClick={joinRoom}
            className="w-full bg-gradient-to-r from-rose-500 to-red-600 text-white font-semibold py-4 rounded-xl hover:from-rose-600 hover:to-red-700 transition-all shadow-lg shadow-rose-500/30">
            JOIN ROOM
          </button>
        </div>
      </div>
    </div>
  );

  if (page === 'room-created') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">✓</span>
          </div>
          <h2 className="text-3xl font-bold mb-2">Room Created!</h2>
        </div>
        <div className="bg-slate-700/50 rounded-2xl p-6 mb-4 border border-slate-600">
          <p className="text-slate-400 text-sm mb-2">Room ID</p>
          <div className="flex items-center justify-between gap-4">
            <p className="text-white font-mono text-2xl">{roomId}</p>
            <button onClick={() => { navigator.clipboard.writeText(roomId); alert('Copied!'); }}
              className="text-rose-400 hover:text-rose-300 text-sm font-semibold">Copy</button>
          </div>
        </div>
        <div className="bg-slate-700/50 rounded-2xl p-4 mb-4 border border-slate-600">
          <p className="text-slate-400 text-sm mb-1">Your username</p>
          <p className="text-white font-mono">{username}</p>
        </div>
        <div className="bg-slate-700/50 rounded-2xl p-4 mb-6 border border-slate-600">
          <p className="text-slate-400 text-sm mb-1">Expires in</p>
          <p className="text-white font-semibold text-xl">{fmt(timeRemaining)}</p>
        </div>
        <button onClick={connectToChat}
          className="w-full bg-gradient-to-r from-rose-500 to-red-600 text-white font-semibold py-4 rounded-xl hover:from-rose-600 hover:to-red-700 transition-all mb-3 shadow-lg shadow-rose-500/30">
          ENTER ROOM
        </button>
        <button onClick={() => { setPage('home'); setRoomId(''); setTimeRemaining(0); }}
          className="w-full text-slate-400 hover:text-white transition-colors py-2">Back to Home</button>
      </div>
    </div>
  );

  if (page === 'username') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
        <h2 className="text-3xl font-bold mb-6 text-center">Join Room</h2>
        <div className="mb-4 p-4 bg-slate-700/50 rounded-2xl border border-slate-600">
          <p className="text-slate-400 text-sm mb-1">Room ID</p>
          <p className="text-white font-mono text-xl">{roomId}</p>
        </div>
        <div className="mb-4 p-4 bg-slate-700/50 rounded-2xl border border-slate-600">
          <p className="text-slate-400 text-sm mb-1">Your username</p>
          <p className="text-white font-mono">{username}</p>
        </div>
        <div className="mb-6 p-4 bg-slate-700/50 rounded-2xl border border-slate-600">
          <p className="text-slate-400 text-sm mb-1">Expires in</p>
          <p className="text-white font-semibold text-xl">{fmt(timeRemaining)}</p>
        </div>
        <button onClick={connectToChat}
          className="w-full bg-gradient-to-r from-rose-500 to-red-600 text-white font-semibold py-4 rounded-xl hover:from-rose-600 hover:to-red-700 transition-all mb-3 shadow-lg shadow-rose-500/30">
          ENTER CHAT
        </button>
        <button onClick={() => { setPage('home'); setUsername(generateUsername()); setRoomId(''); setJoinRoomId(''); setTimeRemaining(0); }}
          className="w-full text-slate-400 hover:text-white transition-colors py-2">Back to Home</button>
      </div>
    </div>
  );

  if (page === 'chat') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col">
      <div className="bg-slate-800/80 backdrop-blur-xl border-b border-slate-700/50 px-6 py-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-red-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/30">
              <span className="text-xl">💬</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-rose-400 to-red-600 bg-clip-text text-transparent">Momento</h1>
              <p className="text-slate-400 text-xs">Room: <span className="font-mono text-slate-300">{roomId}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* connection status pill */}
            <span className={`text-xs px-2 py-1 rounded-full ${connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              {connected ? 'connected' : 'disconnected'}
            </span>
            <div className={`text-right px-4 py-2 rounded-lg border ${timeRemaining < 60 ? 'border-rose-500 bg-rose-500/10' : 'border-slate-600 bg-slate-700/50'}`}>
              <div className={`font-mono text-lg ${timeRemaining < 60 ? 'text-rose-400' : 'text-white'}`}>{fmt(timeRemaining)}</div>
              <div className="text-slate-400 text-xs">Remaining</div>
            </div>
            <button onClick={doLeave}
              className="bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white px-5 py-2 rounded-lg transition-all font-semibold shadow-lg shadow-rose-500/30">
              Leave
            </button>
          </div>
        </div>
        {/* error banner */}
        {wsError && (
          <div className="max-w-6xl mx-auto mt-2 bg-rose-500/20 border border-rose-500/50 rounded-lg px-4 py-2 text-rose-300 text-sm">
            {wsError}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx}>
              {(msg.type === 'JOIN' || msg.type === 'LEAVE') && (
                <div className="text-center">
                  <span className="bg-slate-700/50 text-slate-400 text-xs py-1 px-3 rounded-full border border-slate-600">
                    {msg.sender} {msg.type === 'JOIN' ? 'joined' : 'left'}
                  </span>
                </div>
              )}
              {msg.type === 'CHAT' && (
                <div className={`flex ${msg.sender === username ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-md rounded-2xl px-4 py-3 ${msg.sender === username
                    ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-lg shadow-rose-500/30'
                    : 'bg-slate-700/80 border border-slate-600'}`}>
                    <div className={`text-xs mb-1 font-medium ${msg.sender === username ? 'text-rose-100' : 'text-slate-400'}`}>
                      {msg.sender}
                    </div>
                    <div className="text-white break-words">{msg.content}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef}/>
        </div>
      </div>

      <div className="bg-slate-800/80 backdrop-blur-xl border-t border-slate-700/50 p-6 shadow-2xl">
        <div className="max-w-4xl mx-auto">
          {showEmojiPicker && (
            <div className="bg-slate-700/90 rounded-2xl p-4 mb-4 border border-slate-600">
              <div className="flex flex-wrap gap-2">
                {emojis.map((e, i) => (
                  <button key={i} onClick={() => addEmoji(e)}
                    className="text-2xl hover:bg-slate-600/50 w-12 h-12 rounded-lg transition-colors">{e}</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 items-end">
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="bg-slate-700/50 hover:bg-slate-600/50 text-white p-3 rounded-xl transition-colors border border-slate-600">
              <span className="text-xl">😊</span>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*"/>
            <button onClick={() => fileInputRef.current?.click()}
              className="bg-slate-700/50 hover:bg-slate-600/50 text-white p-3 rounded-xl transition-colors border border-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
              </svg>
            </button>
            <input type="text" placeholder="Type a message…" value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"/>
            <button onClick={sendMessage}
              disabled={!connected}
              className="bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-all shadow-lg shadow-rose-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}