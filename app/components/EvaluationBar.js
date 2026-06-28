'use client';

export default function EvaluationBar({ evaluation = 0, mate = null, orientation = 'white' }) {
  // Calculate bar height (50% = equal, 100% = white winning, 0% = black winning)
  let percentage;
  let displayText;

  if (mate !== null) {
    percentage = mate > 0 ? 100 : 0;
    displayText = `M${Math.abs(mate)}`;
  } else {
    // Clamp eval between -10 and 10, then map to 0-100
    const clampedEval = Math.max(-10, Math.min(10, evaluation));
    // Sigmoid-like mapping for smoother visual
    percentage = 50 + (clampedEval / 10) * 50;
    displayText = evaluation > 0 ? `+${evaluation.toFixed(1)}` : evaluation.toFixed(1);
  }

  // Flip if board is flipped
  if (orientation === 'black') {
    percentage = 100 - percentage;
  }

  return (
    <>
      {/* Vertical bar (desktop) */}
      <div className="eval-bar-container" id="eval-bar">
        <div className="eval-bar" title={`Evaluation: ${displayText}`}>
          <div
            className="eval-bar-fill"
            style={{ height: `${percentage}%` }}
          />
          {percentage > 50 && (
            <span className="eval-bar-score bottom">{displayText}</span>
          )}
          {percentage <= 50 && (
            <span className="eval-bar-score top">{displayText}</span>
          )}
        </div>
      </div>

      {/* Horizontal bar (mobile) */}
      <div className="eval-bar-horizontal" id="eval-bar-mobile">
        <div
          className="eval-bar-fill"
          style={{ width: `${percentage}%` }}
        />
        <span className="eval-bar-score">{displayText}</span>
      </div>
    </>
  );
}
