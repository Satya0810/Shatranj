import AppShell from '../components/AppShell';
import AnalysisBoard from '../components/AnalysisBoard';
import { Suspense } from 'react';

export const metadata = {
  title: 'Game Analysis - ChessMaster',
  description: 'Analyze your chess games with Stockfish engine. Import PGN, get deep evaluation, best moves, and engine lines.',
};

export default function AnalyzePage() {
  return (
    <AppShell title="Analysis Board">
      <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading Analysis Board...</div>}>
        <AnalysisBoard />
      </Suspense>
    </AppShell>
  );
}
