'use client';

export default function Header({ title }) {
  return (
    <header className="header" id="main-header">
      <div className="header-left">
        <h1 className="header-title">{title || 'ChessMaster'}</h1>
      </div>
      <div className="header-right">
        <button className="header-btn" title="Notifications" id="btn-notifications">
          🔔
        </button>
        <button className="header-btn" title="Settings" id="btn-settings">
          ⚙️
        </button>
        <div className="user-avatar" id="user-avatar" title="Guest Player">
          G
        </div>
      </div>
    </header>
  );
}
