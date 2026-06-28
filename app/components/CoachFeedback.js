export default function CoachFeedback({ feedback, loading }) {
  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">🤖 AI Coach</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Coach is analyzing the position...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!feedback) return null;

  // Fallback for when the LLM returns an unexpected JSON structure
  if (!feedback.move_verdict && !feedback.position_summary) {
    const rawMessage = feedback.content || feedback.parsing_error || JSON.stringify(feedback, null, 2);
    return (
      <div className="card" id="coach-feedback">
        <div className="card-header">
          <span className="card-title">🤖 AI Coach Feedback</span>
        </div>
        <div className="card-body">
          <div style={{ padding: 'var(--space-md)', color: 'var(--text-secondary)' }}>
            <strong>Raw Output:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', marginTop: 'var(--space-sm)' }}>
              {typeof rawMessage === 'string' ? rawMessage : JSON.stringify(rawMessage)}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card" id="coach-feedback">
      <div className="card-header">
        <span className="card-title">🤖 AI Coach Feedback</span>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        
        {/* Verdict */}
        {feedback.move_verdict && (
          <div style={{ padding: 'var(--space-sm)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{feedback.move_verdict.emoji}</span>
              <span>{feedback.move_verdict.label}</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {feedback.move_verdict.one_liner}
            </div>
          </div>
        )}

        {/* Position Summary */}
        {feedback.position_summary && (
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Position Evaluation</div>
            <div style={{ fontSize: '13px' }}><strong>{feedback.position_summary.eval_text}</strong></div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{feedback.position_summary.eval_bar_description}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>{feedback.position_summary.phase_note}</div>
          </div>
        )}

        {/* Best Move Explanation */}
        {feedback.best_move_explanation && (
          <div style={{ borderLeft: '3px solid var(--accent-green)', paddingLeft: '12px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent-green)', marginBottom: '4px', fontWeight: 600 }}>Best Move: {feedback.best_move_explanation.move}</div>
            <div style={{ fontSize: '13px', marginBottom: '4px' }}>{feedback.best_move_explanation.reason || feedback.best_move_explanation.short_reason}</div>
          </div>
        )}

        {/* Mistake Analysis */}
        {feedback.mistake_analysis && (
          <div style={{ borderLeft: '3px solid var(--accent-red)', paddingLeft: '12px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent-red)', marginBottom: '4px', fontWeight: 600 }}>Mistake Analysis</div>
            <div style={{ fontSize: '13px', marginBottom: '4px' }}><strong>What went wrong:</strong> {feedback.mistake_analysis.what_went_wrong}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}><strong>Consequence:</strong> {feedback.mistake_analysis.consequence}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}><strong>Fix:</strong> {feedback.mistake_analysis.how_to_avoid}</div>
          </div>
        )}

        {/* Opening Insight */}
        {feedback.opening_insight && (
          <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent-blue)', marginBottom: '4px', fontWeight: 600 }}>Opening Insight</div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>{feedback.opening_insight.name_and_context}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0' }}>{feedback.opening_insight.your_position_in_it}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{feedback.opening_insight.stat_summary}</div>
          </div>
        )}

        {/* Endgame Verdict */}
        {feedback.endgame_verdict && (
          <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent-purple)', marginBottom: '4px', fontWeight: 600 }}>Endgame Analysis</div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{feedback.endgame_verdict.result}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0' }}>{feedback.endgame_verdict.how_to_convert}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{feedback.endgame_verdict.urgency}</div>
          </div>
        )}

        {/* Coach Tip */}
        {feedback.coach_tip && (
          <div style={{ background: 'rgba(129, 182, 74, 0.1)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(129, 182, 74, 0.3)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-green)', marginBottom: '4px' }}>💡 {feedback.coach_tip.principle}</div>
            <div style={{ fontSize: '13px', marginBottom: '8px' }}>{feedback.coach_tip.tip}</div>
            <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>"{feedback.coach_tip.encouragement}"</div>
          </div>
        )}

        {/* Alternatives Summary */}
        {feedback.alternatives_summary && feedback.alternatives_summary.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Alternative Moves</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {feedback.alternatives_summary.map((alt, i) => (
                <div key={i} style={{ fontSize: '12px', display: 'flex', gap: '8px' }}>
                  <span style={{ fontWeight: 600, width: '35px' }}>{alt.move}</span>
                  <span style={{ color: 'var(--text-muted)', width: '30px' }}>{alt.cp_diff}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{alt.why_playable}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
