export default function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-darkest)' }}>
      <div className="spinner" style={{ width: '40px', height: '40px' }} />
    </div>
  );
}
