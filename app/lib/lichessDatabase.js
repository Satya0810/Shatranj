export async function fetchLichessUser(username) {
  try {
    const res = await fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}`);
    if (!res.ok) {
      if (res.status === 404) throw new Error('User not found');
      throw new Error(`Error fetching user: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function fetchLichessGames(username, max = 15) {
  try {
    const res = await fetch(
      `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&pgnInJson=true&opening=true`,
      { headers: { 'Accept': 'application/x-ndjson' } }
    );
    
    if (!res.ok) {
      throw new Error(`Error fetching games: ${res.status}`);
    }

    const text = await res.text();
    // Lichess returns ndjson (Newline Delimited JSON) for games API
    const games = text
      .trim()
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => JSON.parse(line));

    return games;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function fetchLichessGamePgn(gameId) {
  try {
    const res = await fetch(`https://lichess.org/game/export/${encodeURIComponent(gameId)}?clocks=false&evals=false`);
    if (!res.ok) {
      throw new Error(`Error fetching game PGN: ${res.status}`);
    }
    return await res.text();
  } catch (error) {
    console.error(error);
    throw error;
  }
}
