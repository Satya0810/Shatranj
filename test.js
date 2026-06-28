fetch('https://text.pollinations.ai/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{role: 'user', content: 'You are a chess engine. Analyze this FEN: r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1 b - - 1 23. Output ONLY a valid JSON object with {"evaluation": "string", "reason": "string"}.'}],
    jsonMode: false
  })
}).then(r => r.text()).then(console.log);
