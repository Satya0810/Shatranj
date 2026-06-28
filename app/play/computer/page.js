import AppShell from '../../components/AppShell';
import PlayComputer from '../../components/PlayComputer';

export const metadata = {
  title: 'Play vs Computer - ChessMaster',
  description: 'Play chess against Stockfish AI. Choose your difficulty level and time control.',
};

export default function PlayComputerPage() {
  return (
    <AppShell title="Play vs Computer">
      <PlayComputer />
    </AppShell>
  );
}
