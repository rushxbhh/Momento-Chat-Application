import React, { useState, useEffect, useRef } from 'react';

// Use relative URLs for API calls - works with Vite proxy
const API_URL = '/api';
const WS_URL = window.location.protocol === 'https:'
  ? `wss://${window.location.host}/ws`
  : `ws://${window.location.host}/ws`;

// Generate random anonymous username
const generateUsername = () => {
  const adjectives = ['quick', 'lazy', 'happy', 'brave', 'calm', 'eager', 'fancy', 'gentle', 'jolly', 'kind', 'lively', 'proud', 'silly', 'witty', 'zealous'];
  const nouns = ['fox', 'dog', 'cat', 'bear', 'lion', 'tiger', 'eagle', 'shark', 'wolf', 'panda', 'koala', 'otter', 'seal', 'dove', 'hawk'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const id = Math.random().toString(36).substring(2, 7);
  return `anonymous-${adj}-${noun}-${id}`;
};

export default function App() {
  const timerRef = useRef(null);
  const [page, setPage] = useState('home');
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(600);
  const [expiryMinutes, setExpiryMinutes] = useState(10);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const ws = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const emojis = ['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '👋', '🎉', '❤️', '🔥', '✨', '💯', '🚀', '⭐', '💪'];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!username) {
      setUsername(generateUsername());
    }
  }, [username]);

  useEffect(() => {
    if (page !== 'chat') return;
    if (!Number.isFinite(timeRemaining) || timeRemaining <= 0) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [page, timeRemaining]);

  useEffect(() => {
    if (page === 'chat' && timeRemaining === 0) {
      alert('Room expired');
      leaveRoom();
    }
  }, [timeRemaining, page]);

  const formatTime = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const createRoom = async () => {
    const generatedUsername = generateUsername();
    setUsername(generatedUsername);

    try {
      const response = await fetch(`${API_URL}/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiryMinutes: expiryMinutes })
      });
      const data = await response.json();
      setRoomId(data.roomId);
      setTimeRemaining(data.remainingSeconds || data.remainingMinutes * 60);
      setPage('room-created');
    } catch (error) {
      alert('Failed to create room');
    }
  };

  const joinRoom = async () => {
    if (!joinRoomId.trim()) {
      alert('Please enter a room ID');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/rooms/${joinRoomId}`);
      if (response.ok) {
        const data = await response.json();
        setRoomId(joinRoomId);
        setTimeRemaining(data.remainingSeconds || data.remainingMinutes * 60);
        const generatedUsername = generateUsername();
        setUsername(generatedUsername);
        setPage('username');
      } else {
        alert('Room not found or expired');
      }
    } catch (error) {
      alert('Failed to join room');
    }
  };

  const connectToChat = async () => {
    try {
      const res = await fetch(`${API_URL}/rooms/${roomId}`);
      const data = await res.json();
      setTimeRemaining(data.remainingSeconds || data.remainingMinutes * 60);

      const websocket = new WebSocket(WS_URL);

      websocket.onopen = () => {
        setConnected(true);
        setPage('chat');

        websocket.send(JSON.stringify({
          type: 'JOIN',
          roomId,
          sender: username,
          content: `${username} joined the room`
        }));
      };

      websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'ROOM_EXPIRED') {
          alert('Room expired');
          leaveRoom();
          return;
        }

        setMessages(prev => [...prev, message]);
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      websocket.onclose = () => {
        setConnected(false);
      };

      ws.current = websocket;
    } catch (error) {
      alert('Failed to connect to room');
    }
  };

  const sendMessage = () => {
    if (messageInput.trim() && connected && ws.current) {
      ws.current.send(JSON.stringify({
        type: 'CHAT',
        roomId: roomId,
        sender: username,
        content: messageInput,
        timestamp: new Date().toISOString()
      }));
      setMessageInput('');
      setShowEmojiPicker(false);
    }
  };

  const addEmoji = (emoji) => {
    setMessageInput(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // For now, just show file name (you can extend this to handle file uploads)
      setMessageInput(prev => prev + ` [File: ${file.name}]`);
    }
  };

  const leaveRoom = () => {
    if (ws.current) {
      ws.current.send(JSON.stringify({
        type: 'LEAVE',
        roomId: roomId,
        sender: username,
        content: `${username} left the room`
      }));
      ws.current.close();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setPage('home');
    setMessages([]);
    setRoomId('');
    setJoinRoomId('');
    setConnected(false);
    setTimeRemaining(600);
    setUsername(generateUsername());
  };

  if (page === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-rose-400 to-red-600 bg-clip-text text-transparent mb-4">Momento</h1>
            <p className="text-slate-400 text-lg">Ephemeral conversations that disappear</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 mb-6 border border-slate-700/50 shadow-2xl">
            <h2 className="text-2xl font-semibold mb-4">Create Room</h2>
            <p className="text-slate-400 mb-6">
              Start a new private chat room that self-destructs after {expiryMinutes} minutes.
              You'll join anonymously with a random name.
            </p>

            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-3">Room Duration: {expiryMinutes} minutes</label>
              <input
                type="range"
                min="1"
                max="60"
                value={expiryMinutes}
                onChange={(e) => setExpiryMinutes(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
            </div>

            <div className="bg-slate-700/50 rounded-xl p-4 mb-6 flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-red-600 rounded-full flex items-center justify-center text-2xl">
                👤
              </div>
              <div>
                <p className="text-xs text-slate-500">You'll join as</p>
                <p className="text-white font-mono text-sm">{username || 'anonymous-user'}</p>
              </div>
            </div>

            <button
              onClick={createRoom}
              className="w-full bg-gradient-to-r from-rose-500 to-red-600 text-white font-semibold py-4 rounded-xl hover:from-rose-600 hover:to-red-700 transition-all shadow-lg shadow-rose-500/30"
            >
              CREATE NEW ROOM
            </button>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
            <h2 className="text-2xl font-semibold mb-4">Join Room</h2>
            <p className="text-slate-400 mb-6">Enter a room ID to join an existing chat.</p>

            <input
              type="text"
              placeholder="Enter Room ID"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 mb-4"
            />

            <button
              onClick={joinRoom}
               className="w-full bg-gradient-to-r from-rose-500 to-red-600 text-white font-semibold py-4 rounded-xl hover:from-rose-600 hover:to-red-700 transition-all shadow-lg shadow-rose-500/30"
                          >
              JOIN ROOM
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (page === 'room-created') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
              <span className="text-4xl">✓</span>
            </div>
            <h2 className="text-3xl font-bold mb-2">Room Created!</h2>
            <p className="text-slate-400">Share this ID to invite others</p>
          </div>

          <div className="bg-slate-700/50 rounded-2xl p-6 mb-6 border border-slate-600">
            <p className="text-slate-400 text-sm mb-2">Room ID:</p>
            <div className="flex items-center justify-between gap-4">
              <p className="text-white font-mono text-2xl break-all">{roomId}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(roomId);
                  alert('Room ID copied!');
                }}
                className="text-rose-400 hover:text-rose-300 text-sm whitespace-nowrap font-semibold"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="bg-slate-700/50 rounded-2xl p-4 mb-6 border border-slate-600">
            <p className="text-slate-400 text-sm mb-2">Your username:</p>
            <p className="text-white font-mono break-all">{username}</p>
          </div>

          <div className="bg-slate-700/50 rounded-2xl p-4 mb-6 border border-slate-600">
            <p className="text-slate-400 text-sm mb-2">Expires in:</p>
            <p className="text-white font-semibold text-xl">{formatTime(timeRemaining)}</p>
          </div>

          <button
            onClick={connectToChat}
            className="w-full bg-gradient-to-r from-rose-500 to-red-600 text-white font-semibold py-4 rounded-xl hover:from-rose-600 hover:to-red-700 transition-all mb-3 shadow-lg shadow-rose-500/30"
          >
            ENTER ROOM
          </button>

          <button
            onClick={() => {
              setPage('home');
              setRoomId('');
              setTimeRemaining(600);
            }}
            className="w-full text-slate-400 hover:text-white transition-colors py-2"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (page === 'username') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
          <h2 className="text-3xl font-bold mb-6 text-center">Join Room</h2>

          <div className="mb-6 p-4 bg-slate-700/50 rounded-2xl border border-slate-600">
            <p className="text-slate-400 text-sm mb-1">Room ID:</p>
            <p className="text-white font-mono text-xl break-all">{roomId}</p>
          </div>

          <div className="mb-6 p-4 bg-slate-700/50 rounded-2xl border border-slate-600">
            <p className="text-slate-400 text-sm mb-1">Your username:</p>
            <p className="text-white font-mono break-all">{username}</p>
          </div>

          <div className="mb-6 p-4 bg-slate-700/50 rounded-2xl border border-slate-600">
            <p className="text-slate-400 text-sm mb-1">Expires in:</p>
            <p className="text-white font-semibold text-xl">{formatTime(timeRemaining)}</p>
          </div>

          <button
            onClick={connectToChat}
            className="w-full bg-gradient-to-r from-rose-500 to-red-600 text-white font-semibold py-4 rounded-xl hover:from-rose-600 hover:to-red-700 transition-all mb-3 shadow-lg shadow-rose-500/30"
          >
            ENTER CHAT
          </button>

          <button
            onClick={() => {
              setPage('home');
              setUsername(generateUsername());
              setRoomId('');
              setJoinRoomId('');
              setTimeRemaining(600);
            }}
            className="w-full text-slate-400 hover:text-white transition-colors py-2"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (page === 'chat') {
    return (
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
            <div className="flex items-center gap-4">
              <div className="text-right bg-slate-700/50 px-4 py-2 rounded-lg border border-slate-600">
                <div className="text-white font-mono text-lg">{formatTime(timeRemaining)}</div>
                <div className="text-slate-400 text-xs">Remaining</div>
              </div>
              <button
                onClick={leaveRoom}
                className="bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white px-5 py-2 rounded-lg transition-all font-semibold shadow-lg shadow-rose-500/30"
              >
                Leave
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-slate-900/50 to-slate-800/50">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx}>
                {msg.type === 'JOIN' && (
                  <div className="text-center">
                    <span className="bg-slate-700/50 text-slate-400 text-xs py-1 px-3 rounded-full border border-slate-600">
                      {msg.sender} joined
                    </span>
                  </div>
                )}
                {msg.type === 'LEAVE' && (
                  <div className="text-center">
                    <span className="bg-slate-700/50 text-slate-400 text-xs py-1 px-3 rounded-full border border-slate-600">
                      {msg.sender} left
                    </span>
                  </div>
                )}
                {msg.type === 'CHAT' && (
                  <div className={`flex ${msg.sender === username ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-md ${msg.sender === username ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-lg shadow-rose-500/30' : 'bg-slate-700/80 border border-slate-600'} rounded-2xl px-4 py-3 backdrop-blur-sm`}>
                      <div className={`text-xs ${msg.sender === username ? 'text-rose-100' : 'text-slate-400'} mb-1 font-medium`}>
                        {msg.sender}
                      </div>
                      <div className="text-white break-words">{msg.content}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="bg-slate-800/80 backdrop-blur-xl border-t border-slate-700/50 p-6 shadow-2xl">
          <div className="max-w-4xl mx-auto">
            {showEmojiPicker && (
              <div className="bg-slate-700/90 backdrop-blur-xl rounded-2xl p-4 mb-4 border border-slate-600 shadow-xl">
                <div className="flex flex-wrap gap-2">
                  {emojis.map((emoji, idx) => (
                    <button
                      key={idx}
                      onClick={() => addEmoji(emoji)}
                      className="text-2xl hover:bg-slate-600/50 w-12 h-12 rounded-lg transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 items-end">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="bg-slate-700/50 hover:bg-slate-600/50 text-white p-3 rounded-xl transition-colors border border-slate-600"
                title="Emoji"
              >
                <span className="text-xl">😊</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,video/*"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-700/50 hover:bg-slate-600/50 text-white p-3 rounded-xl transition-colors border border-slate-600"
                title="Attach file"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />

              <button
                onClick={sendMessage}
                className="bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white p-3 rounded-xl font-semibold transition-all shadow-lg shadow-rose-500/30"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}