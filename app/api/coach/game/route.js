import { NextResponse } from 'next/server';

const GAME_SUMMARY_PROMPT = `You are an expert chess coach. The user has just finished a game of chess and run a full engine analysis. 
You will receive the game PGN, the accuracies of both players, and a classification of mistakes/blunders made by both sides.
Your job is to provide an encouraging, insightful, and concise post-game summary (2-3 paragraphs).

Respond ONLY with a valid JSON object in this exact structure. No markdown, no preamble:

{
  "title": "<Catchy 3-word title>",
  "summary": "<1 short paragraph of insightful coaching. Mention key turning points.>",
  "key_takeaway": "<One punchy sentence of advice>"
}`;

export async function POST(req) {
  try {
    const body = await req.json();
    const { pgn, whiteAccuracy, blackAccuracy, counts } = body;

    const llmResponse = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: GAME_SUMMARY_PROMPT },
          { role: 'user', content: JSON.stringify({
            game_pgn: pgn,
            performance: {
              white_accuracy: whiteAccuracy,
              black_accuracy: blackAccuracy
            },
            mistakes_overview: counts
          }, null, 2) }
        ],
        jsonMode: true,
        model: 'openai',
        max_tokens: 1500,
        temperature: 0.7
      })
    });

    const llmText = await llmResponse.text();
    let parsedFeedback = {};
    
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
    } catch (e) {}

    try {
      let cleanString = responseString.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedFeedback = JSON.parse(cleanString);
    } catch (e) {
      const jsonMatch = responseString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsedFeedback = JSON.parse(jsonMatch[0]); } catch (e2) {}
      }
    }

    if (!parsedFeedback.title || !parsedFeedback.summary) {
      console.warn("LLM failed or returned invalid format for game summary. Generating fallback.");
      parsedFeedback = {
        title: "Game Analysis Complete",
        summary: `The engine has finished analyzing your game! You played with an accuracy of ${whiteAccuracy}% for White and ${blackAccuracy}% for Black. Review the move classifications and evaluation chart above to find where the key mistakes were made.`,
        key_takeaway: "The AI summary service is currently busy. Please review the chart for insights!"
      };
    }

    return NextResponse.json(parsedFeedback);
  } catch (error) {
    console.error('Game Summary Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
