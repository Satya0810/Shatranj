import AppShell from '../components/AppShell';

export const metadata = {
  title: 'Terms of Service | ChessMaster',
  description: 'Terms of Service for ChessMaster.',
};

export default function TermsPage() {
  return (
    <AppShell title="Terms of Service">
      <div className="layout-container" style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-2xl) 0' }}>
        <h1 style={{ fontSize: '32px', marginBottom: 'var(--space-lg)' }}>Terms of Service</h1>
        <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-xl)', borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          <p style={{ marginBottom: 'var(--space-md)' }}>Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: 'var(--space-lg)', marginBottom: 'var(--space-sm)' }}>1. Acceptance of Terms</h2>
          <p style={{ marginBottom: 'var(--space-md)' }}>
            By accessing and using ChessMaster, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
          </p>

          <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: 'var(--space-lg)', marginBottom: 'var(--space-sm)' }}>2. Fair Play Policy</h2>
          <p style={{ marginBottom: 'var(--space-md)' }}>
            ChessMaster is committed to a fair and enjoyable environment. The use of external assistance, including chess engines, bots, or outside help during rated games against other players is strictly prohibited and may result in account termination.
          </p>

          <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: 'var(--space-lg)', marginBottom: 'var(--space-sm)' }}>3. User Content</h2>
          <p style={{ marginBottom: 'var(--space-md)' }}>
            You are responsible for any content you post in chats or on your profile. Harassment, hate speech, and spam are not tolerated.
          </p>

          <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: 'var(--space-lg)', marginBottom: 'var(--space-sm)' }}>4. Termination</h2>
          <p style={{ marginBottom: 'var(--space-md)' }}>
            We reserve the right to suspend or terminate your access to ChessMaster at our sole discretion, without notice, for conduct that we believe violates these Terms of Service or is harmful to other users of the service.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
