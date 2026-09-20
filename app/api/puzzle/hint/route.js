import { NextResponse } from 'next/server';
import { chatCompletion, parseJsonResponse } from '../../../lib/llm';
import { checkRateLimit } from '../../../lib/rateLimit';

const PUZZLE_HINT_PROMPT = `You are an expert, encouraging chess coach guiding a student through a tactical chess puzzle.
Your goal is to guide the student to discover the solution on their own.
CRITICAL RULES:
1. NEVER reveal the exact move notation (e.g., do NOT say "Play Bxf7+" or "Move your queen to h5").
2. Describe tactical motifs, loose pieces, geometric alignments, king safety, or candidate squares.
3. Respond ONLY with a valid JSON object in this exact format. No markdown, no preamble:

{
  "theme_focus": "<Short tactical motif, e.g. 'Discovered Attack' or 'Weak Back Rank'>",
  "hint": "<1-2 sentences pointing out what weakness, piece relationship, or idea to calculate>",
  "encouragement": "<1 brief motivational sentence>"
}`;

export async function POST(req) {
  try {
    const rateCheck = checkRateLimit(req, { limit: 30, windowMs: 60000, keyPrefix: 'puzzle_hint' });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Hint service rate limit exceeded. Please wait ${rateCheck.resetSeconds} seconds.` },
        { status: 429, headers: { 'Retry-After': String(rateCheck.resetSeconds) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { fen, theme = 'Tactics', rating, step = 0 } = body;

    if (!fen || typeof fen !== 'string' || fen.length > 120) {
      return NextResponse.json({ error: 'Valid FEN is required (max 120 characters)' }, { status: 400 });
    }

    let parsed = null;
    try {
      const llmResult = await chatCompletion({
        messages: [
          { role: 'system', content: PUZZLE_HINT_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              current_fen: fen,
              puzzle_theme: theme,
              puzzle_rating: rating || 'Intermediate',
              current_step: step
            }, null, 2)
          }
        ],
        responseFormat: { type: 'json_object' },
        temperature: 0.6
      });

      parsed = parseJsonResponse(llmResult.content);
    } catch (llmErr) {
      console.warn('Puzzle hint LLM error:', llmErr.message);
    }

    if (!parsed || !parsed.hint) {
      parsed = {
        theme_focus: theme || 'Tactical Pattern',
        hint: 'Look for unprotected pieces, king alignment, and forcing checks or captures in this position.',
        encouragement: 'Take your time and calculate candidate moves!'
      };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Puzzle hint route error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
