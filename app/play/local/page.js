import AppShell from '../../components/AppShell';
import PlayLocal from '../../components/PlayLocal';

export const metadata = {
  title: 'Play a Friend - ChessMaster',
  description: 'Play chess with a friend on the same device. Two player mode.',
};

export default function PlayLocalPage() {
  return (
    <AppShell title="Play a Friend">
      <PlayLocal />
    </AppShell>
  );
}
