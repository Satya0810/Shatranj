import AppShell from '../components/AppShell';
import PuzzleBoard from '../components/PuzzleBoard';

export const metadata = {
  title: 'Chess Puzzles - ChessMaster',
  description: 'Solve chess puzzles to improve your tactical skills. Forks, pins, skewers, and more.',
};

export default function PuzzlesPage() {
  return (
    <AppShell title="Puzzles">
      <PuzzleBoard />
    </AppShell>
  );
}
