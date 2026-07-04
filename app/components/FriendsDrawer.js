'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import ChatWindow from './ChatWindow';

export default function FriendsDrawer({ isOpen, onClose }) {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('friends'); // 'friends', 'requests', 'search'
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  const [activeChatFriend, setActiveChatFriend] = useState(null);

  // Poll for updates to user.friends and user.friendRequests, assuming the /api/auth/me refreshes it
  // Or we can just use the user object directly.
  
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSearchResults(data.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (targetUserId) => {
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId })
      });
      const data = await res.json();
      if (data.success) {
        alert('Friend request sent!');
      } else {
        alert(data.error || 'Failed to send request');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequest = async (targetUserId, action) => {
    try {
      const res = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId, action })
      });
      const data = await res.json();
      if (data.success) {
        // Optimistically we should refresh the user, but for now we'll just alert
        alert(`Request ${action}ed. Please refresh the page to see changes.`);
      } else {
        alert(data.error || 'Failed to process request');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, width: '350px', height: '100vh',
      background: 'var(--bg-card)', borderLeft: '1px solid var(--border-medium)',
      boxShadow: '-4px 0 15px rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Friends & Chat</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
      </div>

      {!activeChatFriend ? (
        <>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
            <button 
              onClick={() => setActiveTab('friends')}
              style={{ flex: 1, padding: '12px', background: 'none', border: 'none', borderBottom: activeTab === 'friends' ? '2px solid var(--accent-green)' : '2px solid transparent', color: activeTab === 'friends' ? 'var(--accent-green)' : 'var(--text-secondary)', fontWeight: activeTab === 'friends' ? 'bold' : 'normal', cursor: 'pointer' }}
            >
              Friends
            </button>
            <button 
              onClick={() => setActiveTab('requests')}
              style={{ flex: 1, padding: '12px', background: 'none', border: 'none', borderBottom: activeTab === 'requests' ? '2px solid var(--accent-green)' : '2px solid transparent', color: activeTab === 'requests' ? 'var(--accent-green)' : 'var(--text-secondary)', fontWeight: activeTab === 'requests' ? 'bold' : 'normal', cursor: 'pointer' }}
            >
              Requests {user?.friendRequests?.length > 0 && `(${user.friendRequests.length})`}
            </button>
            <button 
              onClick={() => setActiveTab('search')}
              style={{ flex: 1, padding: '12px', background: 'none', border: 'none', borderBottom: activeTab === 'search' ? '2px solid var(--accent-green)' : '2px solid transparent', color: activeTab === 'search' ? 'var(--accent-green)' : 'var(--text-secondary)', fontWeight: activeTab === 'search' ? 'bold' : 'normal', cursor: 'pointer' }}
            >
              Search
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {activeTab === 'friends' && (
              <div>
                {user?.friends?.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>You have no friends yet.</p>
                ) : (
                  user?.friends?.map(friend => (
                    <div key={friend._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                          {friend.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 'bold' }}>{friend.username}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rating: {friend.rating}</div>
                        </div>
                      </div>
                      <button onClick={() => setActiveChatFriend(friend)} className="btn btn-primary btn-sm">Chat</button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'requests' && (
              <div>
                {user?.friendRequests?.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No pending requests.</p>
                ) : (
                  user?.friendRequests?.map(reqUser => (
                    <div key={reqUser._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{reqUser.username}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Wants to be friends</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleRequest(reqUser._id, 'accept')} className="btn btn-primary btn-sm" style={{ padding: '6px 10px' }}>✓</button>
                        <button onClick={() => handleRequest(reqUser._id, 'reject')} className="btn btn-danger btn-sm" style={{ padding: '6px 10px' }}>✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'search' && (
              <div>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Username..." className="input" style={{ flex: 1 }} />
                  <button type="submit" className="btn btn-primary" disabled={searching}>{searching ? '...' : 'Find'}</button>
                </form>
                
                {searchResults.map(resUser => (
                  <div key={resUser._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{resUser.username}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rating: {resUser.rating}</div>
                    </div>
                    {user?.friends?.some(f => f._id === resUser._id) ? (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Friend</span>
                    ) : (
                      <button onClick={() => sendRequest(resUser._id)} className="btn btn-secondary btn-sm">Add</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <ChatWindow 
          friend={activeChatFriend} 
          onBack={() => setActiveChatFriend(null)} 
          currentUser={user} 
          token={token} 
        />
      )}
    </div>
  );
}
