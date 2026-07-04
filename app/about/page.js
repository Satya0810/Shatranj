import AppShell from '../components/AppShell';

export const metadata = {
  title: 'About Us | ChessMaster',
  description: 'Learn more about ChessMaster and our mission.',
};

export default function AboutPage() {
  return (
    <AppShell title="About Us">
      <div className="layout-container" style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-2xl) 0' }}>
        <h1 style={{ fontSize: '32px', marginBottom: 'var(--space-lg)' }}>About ChessMaster</h1>
        <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-xl)', borderRadius: 'var(--radius-lg)' }}>
          <p style={{ lineHeight: '1.7', marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>
            ChessMaster is a premium, open-source chess platform built for players of all skill levels. 
            Our mission is to provide a seamless, beautiful, and highly responsive environment for you to enjoy the greatest game ever invented.
          </p>
          <h2 style={{ fontSize: '20px', marginTop: 'var(--space-xl)', marginBottom: 'var(--space-sm)' }}>Our Features</h2>
          <ul style={{ lineHeight: '1.7', color: 'var(--text-secondary)', paddingLeft: '20px', marginBottom: 'var(--space-md)' }}>
            <li>Play real-time online matches with friends or opponents globally.</li>
            <li>Analyze your games with the powerful Stockfish engine.</li>
            <li>Solve tactics and puzzles to sharpen your skills.</li>
            <li>Enjoy a stunning, modern UI built with Next.js and React.</li>
          </ul>
          <h2 style={{ fontSize: '20px', marginTop: 'var(--space-xl)', marginBottom: 'var(--space-sm)' }}>Open Source</h2>
          <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            We believe in the power of community. ChessMaster is open-source, and we welcome contributions from developers and chess enthusiasts around the world.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
