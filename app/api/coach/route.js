import { NextResponse } from 'next/server';

// The system prompt provided by the user
const COACH_SYSTEM_PROMPT = `You are an expert chess coach and analyst with deep knowledge of chess theory, tactics, strategy, and endgames. You have the ability to explain complex chess concepts in simple, encouraging language suited to players of all levels.

You receive structured chess data from multiple analysis engines and APIs, and your job is to transform this raw data into clear, human-readable, actionable coaching feedback.

Respond ONLY with a valid JSON object in this exact structure. No markdown, no preamble, no explanation outside the JSON:

{
  "move_verdict": {
    "emoji": "<emoji>",
    "label": "<label>",
    "one_liner": "<one punchy sentence>"
  },
  "best_move_explanation": {
    "move": "<SAN>",
    "reason": "<one sentence — why THIS move, simply stated>"
  },
  "mistake_analysis": {
    "what_went_wrong": "<explain the error briefly if applicable, else null>",
    "how_to_avoid": "<pattern to remember for next time, else null>"
  },
  "coach_tip": {
    "tip": "<1 sentence coaching advice>"
  }
}

TONE AND LANGUAGE RULES
BEGINNER players: Use everyday language. Be warm.
INTERMEDIATE players: Use standard chess terms. Be direct and specific.
ADVANCED players: Use precise chess terminology. Give deep reasoning.

EVALUATION TRANSLATION RULES
+300 or more -> "Winning"
+150 to +299 -> "Clearly better"
+50 to +149 -> "Slightly better"
-50 to +49 -> "Equal"

CRITICAL RULES:
1. YOUR RESPONSE MUST BE EXACTLY ONE VALID JSON OBJECT.
2. DO NOT output any conversational text before or after the JSON.
3. DO NOT "think out loud" or output your reasoning.
4. The very first character of your response must be '{'.
5. NEVER use raw numbers like "1.4" — always translate to plain English.
6. Speak as the coach, do not say "the engine says".`;

export async function POST(req) {
  try {
    const body = await req.json();
    const { 
      fen, 
      moveNumber = 1, 
      playerColor = 'white', 
      playerLevel = 'intermediate',
      playedMoveSan,
      playedMoveUci,
      gamePhase = 'middlegame',
      previousMistakes = 0,
      isCriticalMoment = false,
      cloudData: clientCloudData,
      sfData: clientSfData,
      positionBreakdown
    } = body;

    if (!fen) {
      return NextResponse.json({ error: 'FEN is required' }, { status: 400 });
    }

    // 1. Fetch from chess-api.com (Stockfish 18) - ONLY if client didn't provide sfData
    const stockfishPromise = clientSfData ? Promise.resolve(clientSfData) : fetch('https://chess-api.com/v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, depth: 14 }) // depth 14 for speed
    }).then(res => res.json()).catch(() => null);

    // 2. Fetch Lichess Cloud Eval - ONLY if client didn't provide cloudData
    let lichessCloudPromise = Promise.resolve(null);
    if (clientCloudData) {
      lichessCloudPromise = Promise.resolve(clientCloudData);
    } else {
      const lichessCloudUrl = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=3`;
      lichessCloudPromise = fetch(lichessCloudUrl)
        .then(res => res.ok ? res.json() : null)
        .catch(() => null);
    }

    // 3. Fetch Lichess Opening Explorer (only if move < 20)
    let openingPromise = Promise.resolve(null);
    if (moveNumber < 20) {
      openingPromise = fetch(`https://explorer.lichess.ovh/lichess?fen=${encodeURIComponent(fen)}&speeds=blitz,rapid,classical`, {
        headers: { 'User-Agent': 'ChessMasterApp/1.0' }
      }).then(res => res.json()).catch(() => null);
    }

    // 4. Fetch Syzygy Tablebase (only if <= 7 pieces)
    const pieceCount = fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
    let tablebasePromise = Promise.resolve(null);
    if (pieceCount <= 7) {
      tablebasePromise = fetch(`http://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`)
        .then(res => res.json())
        .catch(() => null);
    }

    const [sfData, cloudData, openingData, tbData] = await Promise.all([
      stockfishPromise, lichessCloudPromise, openingPromise, tablebasePromise
    ]);

    // Format the gathered data into the requested JSON structure
    const inputData = {
      player_level: playerLevel,
      player_color: playerColor,
      move_number: moveNumber,
      position: {
        fen,
        phase: gamePhase
      },
      engine_eval: {},
      game_context: {
        previous_mistakes: previousMistakes,
        is_critical_moment: isCriticalMoment,
        time_pressure: false
      }
    };

    if (sfData && sfData.eval !== undefined) {
      inputData.engine_eval = {
        score_cp: sfData.centipawns || sfData.eval * 100,
        score_mate: sfData.mate || null,
        depth: sfData.depth || 14,
        best_move_uci: sfData.move,
        best_move_san: sfData.san,
        best_move_piece: sfData.piece,
        principal_variation: sfData.continuationArr || []
      };
    } else if (cloudData && cloudData.pvs && cloudData.pvs.length > 0) {
      inputData.engine_eval = {
        score_cp: cloudData.pvs[0].cp || 0,
        score_mate: cloudData.pvs[0].mate || null,
        depth: cloudData.depth,
        best_move_uci: cloudData.pvs[0].moves.split(' ')[0],
      };
    }

    if (openingData && openingData.opening) {
      const totalGames = (openingData.white || 0) + (openingData.draws || 0) + (openingData.black || 0);
      inputData.opening = {
        name: openingData.opening.name,
        eco: openingData.opening.eco
      };
      inputData.opening_stats = {
        total_games: totalGames,
        white_wins_pct: totalGames > 0 ? ((openingData.white || 0) / totalGames) * 100 : 0,
        draw_pct: totalGames > 0 ? ((openingData.draws || 0) / totalGames) * 100 : 0,
        black_wins_pct: totalGames > 0 ? ((openingData.black || 0) / totalGames) * 100 : 0,
      };
    }

    if (tbData && tbData.category) {
      inputData.tablebase = {
        category: tbData.category,
        dtm: tbData.dtm,
        dtz: tbData.dtz
      };
    }

    if (playedMoveSan) {
      inputData.move_classification = {
        played_move_san: playedMoveSan,
        played_move_uci: playedMoveUci,
      };
    }

    if (positionBreakdown) {
      inputData.position_breakdown = positionBreakdown;
    }

    // Now, call the free LLM API (OpenRouter)
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    
    let llmResponse;
    let retries = 3;
    let delay = 10000; // wait 10 seconds before retrying
    
    while (retries > 0) {
      llmResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'ChessMaster Coach',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free', // Reverted to the smarter 70B model
          messages: [
            { role: 'system', content: COACH_SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify(inputData, null, 2) }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7
        })
      });
      
      if (llmResponse.status === 429) {
        retries--;
        if (retries === 0) break;
        console.warn(`OpenRouter rate limited (429). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay += 2000; // increase wait time
      } else {
        break;
      }
    }

    const llmText = await llmResponse.text();
    console.log('LLM Text:', llmText);
    
    let parsedFeedback = {};
    
    // 1. If it's a JSON object wrapper (e.g. OpenAI format), extract the inner string
    let responseString = llmText;
    try {
      const wrapper = JSON.parse(llmText);
      if (wrapper.choices && wrapper.choices[0] && wrapper.choices[0].message && wrapper.choices[0].message.content) {
        responseString = wrapper.choices[0].message.content;
      } else if (wrapper.message && wrapper.message.content) {
        responseString = wrapper.message.content;
      } else if (wrapper.content) {
        responseString = wrapper.content;
      }
    } catch (e) {
      // It's not a JSON wrapper, just raw text. That's fine.
    }

    // 2. Try to parse the inner string. If it fails, extract the JSON block.
    try {
      // Clean markdown code blocks if present
      let cleanString = responseString.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedFeedback = JSON.parse(cleanString);
    } catch (e) {
      // Fallback: use regex to extract the first JSON-like object
      const jsonMatch = responseString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedFeedback = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          parsedFeedback = { parsing_error: 'LLM did not return valid JSON inside the object', raw_output: responseString };
        }
      } else {
        parsedFeedback = { parsing_error: 'LLM did not return any JSON object', raw_output: responseString };
      }
    }

    // Fallback if LLM failed to return the correct structure
    if (!parsedFeedback.move_verdict && !parsedFeedback.best_move_explanation) {
      console.warn("LLM failed or returned invalid format. Generating fallback feedback.");
      const isGood = inputData.engine_eval?.score_cp > 50;
      parsedFeedback = {
        move_verdict: {
          emoji: isGood ? "👍" : "🤔",
          label: isGood ? "Good Move" : "Interesting",
          one_liner: "The AI Coach service is currently experiencing high load, but here is the engine evaluation."
        },
        best_move_explanation: {
          move: inputData.engine_eval?.best_move_san || "Unknown",
          reason: `Stockfish evaluates this position at ${inputData.engine_eval?.score_cp > 0 ? '+' : ''}${(inputData.engine_eval?.score_cp / 100 || 0).toFixed(2)}.`
        },
        coach_tip: {
          tip: "When the AI Coach is busy, you can still rely on the Stockfish evaluation bar and move classifications!"
        }
      };
    }

    console.log('Final Parsed Feedback:', parsedFeedback);
    return NextResponse.json(parsedFeedback);
  } catch (error) {
    console.error('Coach API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
