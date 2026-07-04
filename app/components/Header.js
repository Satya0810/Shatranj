'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import ProfileModal from './ProfileModal';
import FriendsDrawer from './FriendsDrawer';
import { useAuth } from './AuthContext';

export default function Header({ title }) {
  const { user, logout, openAuthModal } = useAuth();
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name) => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  return (
    <header className="header" id="main-header">
      <div className="header-left">
        <h1 className="header-title">{title || 'ChessMaster'}</h1>
      </div>
      <div className="header-right" ref={dropdownRef}>
        
        {/* Friends */}
        {user && (
          <button 
            className={`header-btn ${showFriends ? 'active' : ''}`} 
            title="Friends" 
            onClick={() => setShowFriends(!showFriends)}
          >
            👥
          </button>
        )}

        {/* Notifications */}
        <div className="header-dropdown-container">
          <button 
            className={`header-btn ${activeDropdown === 'notifications' ? 'active' : ''}`} 
            title="Notifications" 
            id="btn-notifications"
            onClick={() => toggleDropdown('notifications')}
          >
            🔔
          </button>
          {activeDropdown === 'notifications' && (
            <div className="header-dropdown">
              <div className="dropdown-header">Notifications</div>
              <div className="dropdown-body">
                <p className="dropdown-empty">No new notifications</p>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="header-dropdown-container">
          <button 
            className={`header-btn ${activeDropdown === 'settings' ? 'active' : ''}`} 
            title="Settings" 
            id="btn-settings"
            onClick={() => toggleDropdown('settings')}
          >
            ⚙️
          </button>
          {activeDropdown === 'settings' && (
            <div className="header-dropdown">
              <div className="dropdown-header">Quick Settings</div>
              <div className="dropdown-body">
                <button className="dropdown-item">Theme: Dark</button>
                <button className="dropdown-item">Sound: On</button>
                <button className="dropdown-item">Animations: On</button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="header-dropdown-container">
          <div 
            className="user-avatar" 
            id="user-avatar" 
            title={user ? user.username : "Guest Player"}
            onClick={() => toggleDropdown('profile')}
          >
            {user ? user.username.charAt(0).toUpperCase() : 'G'}
          </div>
          {activeDropdown === 'profile' && (
            <div className="header-dropdown dropdown-right">
              {user ? (
                <>
                  <div className="dropdown-header">
                    <strong>{user.username}</strong>
                    <span className="dropdown-subtext">{user.email}</span>
                  </div>
                  <div className="dropdown-body">
                    <Link href="/history" className="dropdown-item" onClick={() => setActiveDropdown(null)}>Match History</Link>
                    <button className="dropdown-item" onClick={() => { setShowProfile(true); setActiveDropdown(null); }}>Edit Profile</button>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item text-danger" onClick={() => { logout(); setActiveDropdown(null); }}>Log Out</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="dropdown-header">
                    <strong>Guest Player</strong>
                    <span className="dropdown-subtext">Play anonymously or login</span>
                  </div>
                  <div className="dropdown-body">
                    <button className="dropdown-item" onClick={() => { openAuthModal(); setActiveDropdown(null); }}>Log In / Sign Up</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      </div>
      
      {showProfile && user && (
        <ProfileModal username={user.username} onClose={() => setShowProfile(false)} />
      )}
      
      <FriendsDrawer isOpen={showFriends} onClose={() => setShowFriends(false)} />
    </header>
  );
}
