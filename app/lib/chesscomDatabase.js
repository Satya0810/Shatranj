// Helper functions for Chess.com API interactions

export async function fetchChesscomUser(username) {
  const res = await fetch(`https://api.chess.com/pub/player/${username}`, {
    headers: {
      'User-Agent': 'ChessMaster (Personal Chess App)',
    },
  });
  
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('User not found on Chess.com');
    }
    throw new Error('Failed to fetch Chess.com user data');
  }
  
  return await res.json();
}

export async function fetchChesscomStats(username) {
  const res = await fetch(`https://api.chess.com/pub/player/${username}/stats`, {
    headers: {
      'User-Agent': 'ChessMaster (Personal Chess App)',
    },
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch Chess.com stats');
  }
  
  return await res.json();
}

export async function fetchChesscomGames(username, max = 15) {
  // 1. Fetch archives list
  const archivesRes = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`, {
    headers: {
      'User-Agent': 'ChessMaster (Personal Chess App)',
    },
  });
  
  if (!archivesRes.ok) {
    if (archivesRes.status === 404) {
      return []; // No games found
    }
    throw new Error('Failed to fetch Chess.com game archives');
  }
  
  const archivesData = await archivesRes.json();
  if (!archivesData.archives || archivesData.archives.length === 0) {
    return [];
  }
  
  // 2. Fetch the latest month's archive
  const latestArchiveUrl = archivesData.archives[archivesData.archives.length - 1];
  const gamesRes = await fetch(latestArchiveUrl, {
    headers: {
      'User-Agent': 'ChessMaster (Personal Chess App)',
    },
  });
  
  if (!gamesRes.ok) {
    throw new Error('Failed to fetch latest Chess.com games');
  }
  
  const gamesData = await gamesRes.json();
  const games = gamesData.games || [];
  
  // 3. Return the last `max` games, sorted descending by end_time (most recent first)
  // Chess.com games array is usually chronological. Reverse to get most recent first.
  const recentGames = games.reverse().slice(0, max);
  return recentGames;
}
