async function testPollinations() {
  const prompt = `You are an expert chess coach. Provide your analysis in JSON format exactly as follows:
{ "move_verdict": { "emoji": "!", "label": "Good" } }

Here is the data:
FEN: rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1
Move: e4`;

  try {
    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are an expert chess coach. Always output valid JSON.' },
          { role: 'user', content: prompt }
        ],
        jsonMode: true,
        model: 'openai'
      })
    });
    
    const text = await res.text();
    console.log("Response:", text);
  } catch (e) {
    console.error(e);
  }
}

testPollinations();
