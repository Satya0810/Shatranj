'use client';

import Sidebar from './Sidebar';
import Header from './Header';

export default function AppShell({ children, title }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <Header title={title} />
        <main className="app-main">
          {children}
        </main>
      </div>
    </div>
  );
}
