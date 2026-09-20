import { NextResponse } from 'next/server';
import { chatCompletion, parseJsonResponse } from '../../../lib/llm';
import { checkRateLimit } from '../../../lib/rateLimit';

const GAME_SUMMARY_PROMPT = `You are an expert chess coach. The user has just finished a game of chess and run a full engine analysis. 
You will receive the game PGN, the accuracies of both players, and a classification of move qualities (best, excellent, good, inaccuracy, mistake, blunder, miss, etc.).
Your job is to provide an encouraging, insightful, and concise post-game summary (2-3 paragraphs).

Respond ONLY with a valid JSON object in this exact structure. No markdown, no preamble:

{
  "title": "<Catchy 3-word title>",
  "summary": "<1 short paragraph of insightful coaching. Mention key turning points.>",
  "key_takeaway": "<One punchy sentence of advice>"
}`;

export async function POST(req) {
  try {
    const rateCheck = checkRateLimit(req, { limit: 15, windowMs: 60000, keyPrefix: 'coach_game_summary' });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Game summary rate limit exceeded. Please wait ${rateCheck.resetSeconds} seconds.` },
        { status: 429, headers: { 'Retry-After': String(rateCheck.resetSeconds) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { pgn, whiteAccuracy, blackAccuracy, counts } = body;

    if (!pgn || typeof pgn !== 'string' || pgn.length > 30000) {
      return NextResponse.json({ error: 'Valid PGN is required (max 30,000 characters)' }, { status: 400 });
    }

    let parsedFeedback = null;
    try {
      const llmResult = await chatCompletion({
        messages: [
          { role: 'system', content: GAME_SUMMARY_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              game_pgn: pgn,
              performance: {
                white_accuracy: whiteAccuracy,
                black_accuracy: blackAccuracy
              },
              mistakes_overview: counts
            }, null, 2)
          }
        ],
        responseFormat: { type: 'json_object' },
        temperature: 0.7
      });

      parsedFeedback = parseJsonResponse(llmResult.content);
    } catch (llmErr) {
      console.warn('Game summary LLM call failed:', llmErr.message);
    }

    if (!parsedFeedback || !parsedFeedback.title || !parsedFeedback.summary) {
      console.warn("LLM failed or returned invalid format for game summary. Generating fallback.");
      parsedFeedback = {
        title: "Game Analysis Complete",
        summary: `The engine has finished analyzing your game! You played with an accuracy of ${whiteAccuracy}% for White and ${blackAccuracy}% for Black. Review the move classifications and evaluation chart above to find where the key mistakes were made.`,
        key_takeaway: "Review the move classifications and evaluation chart for strategic improvement!"
      };
    }

    return NextResponse.json(parsedFeedback);
  } catch (error) {
    console.error('Game Summary Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
