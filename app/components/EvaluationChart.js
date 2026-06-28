'use client';

export default function EvaluationChart({ evals, historyLength }) {
  if (!evals || Object.keys(evals).length === 0) return null;

  const CLAMP = 1000;
  
  // Convert evals object to array of clamped values
  const data = [];
  for (let i = 0; i < historyLength; i++) {
    let val = evals[i] || 0;
    if (val > CLAMP) val = CLAMP;
    if (val < -CLAMP) val = -CLAMP;
    data.push(val);
  }

  return (
    <div className="card" style={{ marginTop: 'var(--space-md)' }}>
      <div className="card-header">
        <span className="card-title">📈 Evaluation Chart</span>
      </div>
      <div className="card-body">
        <div style={{
          width: '100%',
          height: '140px',
          background: 'var(--bg-darkest)',
          borderRadius: 'var(--radius-md)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden'
        }}>
          {/* 0.0 line */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: '1px',
            background: 'rgba(255, 255, 255, 0.2)',
            zIndex: 1
          }} />

          {/* Bars */}
          <div style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            position: 'relative',
            zIndex: 2,
            alignItems: 'center'
          }}>
            {data.map((val, idx) => {
              const isWhiteAdvantage = val > 0;
              const percentHeight = (Math.abs(val) / CLAMP) * 50;
              
              return (
                <div key={idx} style={{
                  flex: 1,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: isWhiteAdvantage ? 'flex-end' : 'flex-start'
                }}>
                  <div style={{ height: '50%', display: 'flex', alignItems: 'flex-end', padding: '0 1px' }}>
                    {isWhiteAdvantage && (
                      <div style={{
                        width: '100%',
                        height: `${percentHeight * 2}%`,
                        background: 'var(--eval-white)',
                        borderTopLeftRadius: '2px',
                        borderTopRightRadius: '2px'
                      }} />
                    )}
                  </div>
                  <div style={{ height: '50%', display: 'flex', alignItems: 'flex-start', padding: '0 1px' }}>
                    {!isWhiteAdvantage && (
                      <div style={{
                        width: '100%',
                        height: `${percentHeight * 2}%`,
                        background: 'var(--eval-black)',
                        borderBottomLeftRadius: '2px',
                        borderBottomRightRadius: '2px'
                      }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
          <span>Start</span>
          <span>End</span>
        </div>
      </div>
    </div>
  );
}
