import AppShell from '../../components/AppShell';
import PlayOnline from '../../components/PlayOnline';

export const metadata = {
  title: 'Play Online - ChessMaster',
  description: 'Play chess online against real players. Real-time multiplayer with matchmaking.',
};

export default function PlayOnlinePage() {
  return (
    <AppShell title="Play Online">
      <PlayOnline />
    </AppShell>
  );
}
