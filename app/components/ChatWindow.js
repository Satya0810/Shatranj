'use client';
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export default function ChatWindow({ friend, onBack, currentUser, token }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Fetch historical messages
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/chat/${friend._id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();

    // Initialize Socket
    const socket = io({ path: '/api/socketio' });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('auth', { userId: currentUser.id });
    });

    socket.on('private-message', (data) => {
      // If the message involves this friend, add it to chat
      if (data.senderId === friend._id || data.receiverId === friend._id) {
        setMessages(prev => {
          // Avoid duplicates if echoed back
          if (prev.find(m => m._id === data._id)) return prev;
          return [...prev, data];
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [friend._id, currentUser.id, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    if (socketRef.current) {
      socketRef.current.emit('private-message', {
        recipientId: friend._id,
        message: inputMessage.trim(),
        senderId: currentUser.id,
        senderName: currentUser.username
      });
      setInputMessage('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>← Back</button>
        <div style={{ fontWeight: 'bold' }}>{friend.username}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px' }}>Say hi to {friend.username}!</div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.senderId === currentUser.id;
            return (
              <div key={msg._id || i} style={{ 
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                background: isMe ? 'var(--accent-green)' : 'var(--bg-surface)',
                color: isMe ? 'white' : 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: '16px',
                maxWidth: '80%',
                wordBreak: 'break-word'
              }}>
                {msg.content}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '12px', borderTop: '1px solid var(--border-subtle)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            value={inputMessage} 
            onChange={e => setInputMessage(e.target.value)} 
            placeholder="Type a message..."
            className="input"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={!inputMessage.trim()}>Send</button>
        </form>
      </div>
    </div>
  );
}
