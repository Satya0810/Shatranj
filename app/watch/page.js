import AppShell from '../components/AppShell';
import WatchContent from '../components/WatchContent';

export const metadata = {
  title: 'Watch Live Chess - ChessMaster',
  description: 'Watch top-rated games live from Lichess, browse famous games, and learn from the best.',
};

export default function WatchPage() {
  return (
    <AppShell title="Watch Live">
      <WatchContent />
    </AppShell>
  );
}
