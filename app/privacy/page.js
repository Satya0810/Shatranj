import AppShell from '../components/AppShell';

export const metadata = {
  title: 'Privacy Policy | ChessMaster',
  description: 'Privacy Policy for ChessMaster.',
};

export default function PrivacyPage() {
  return (
    <AppShell title="Privacy Policy">
      <div className="layout-container" style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-2xl) 0' }}>
        <h1 style={{ fontSize: '32px', marginBottom: 'var(--space-lg)' }}>Privacy Policy</h1>
        <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-xl)', borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          <p style={{ marginBottom: 'var(--space-md)' }}>Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: 'var(--space-lg)', marginBottom: 'var(--space-sm)' }}>1. Information We Collect</h2>
          <p style={{ marginBottom: 'var(--space-md)' }}>
            When you register for an account, we collect your email address, username, and password. If you use Google OAuth, we collect your Google profile information (Name, Email, Profile Picture).
            We also collect data regarding your active sessions (IP addresses, device information) to provide security features like Session Control.
          </p>

          <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: 'var(--space-lg)', marginBottom: 'var(--space-sm)' }}>2. How We Use Your Information</h2>
          <p style={{ marginBottom: 'var(--space-md)' }}>
            Your information is used strictly to provide the ChessMaster service. This includes authenticating your account, saving your game history, and matching you with other players.
          </p>

          <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: 'var(--space-lg)', marginBottom: 'var(--space-sm)' }}>3. Third-Party Integrations</h2>
          <p style={{ marginBottom: 'var(--space-md)' }}>
            If you choose to link your Lichess or Chess.com accounts, we retrieve public information from those platforms to display on your profile. We do not sell your personal data to any third parties.
          </p>

          <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: 'var(--space-lg)', marginBottom: 'var(--space-sm)' }}>4. Data Security</h2>
          <p style={{ marginBottom: 'var(--space-md)' }}>
            We use industry-standard encryption to protect your passwords and data. However, no transmission of data over the internet is completely secure.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
