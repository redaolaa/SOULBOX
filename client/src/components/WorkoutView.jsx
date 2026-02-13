const WorkoutView = ({ workout, onClose, onRegenerate }) => {
  if (!workout) return null;

  const getName = (ex) => (ex?.name || ex?.exerciseId?.name || '').trim();
  const isNonstopSparring = (name) => {
    const n = (name || '').toLowerCase();
    const compact = n.replace(/[-\s]/g, '');
    return compact.includes('nonstopsparring');
  };
  const collapseNonstopStation3 = (station3) => {
    const names = (station3 || []).map(getName).filter(Boolean);
    if (names.length !== 3) return null;
    const normalized = names.map((n) => n.toLowerCase());
    const allSame = normalized.every((n) => n === normalized[0]);
    if (allSame && isNonstopSparring(names[0])) return names[0];
    return null;
  };

  const nonstopStation3Name = collapseNonstopStation3(workout.station3);

  return (
    <div className="workout-modal-overlay" onClick={onClose}>
      <div className="workout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="workout-header">
          <h2>{workout.dayOfWeek} - {workout.dayType}</h2>
          <div className="workout-meta">
            <span className="badge">{workout.filter}</span>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="workout-content">
          <div className="station">
            <h3>Station 1: Conditioning (Tri-Sets)</h3>
            <div className="phase">
              <h4>Phase 1:</h4>
              <ol>
                {workout.station1.phase1.map((ex, idx) => (
                  <li key={idx}>{ex.name || ex.exerciseId?.name || 'Loading...'}</li>
                ))}
              </ol>
            </div>
            <div className="phase">
              <h4>Phase 2:</h4>
              <ol>
                {workout.station1.phase2.map((ex, idx) => (
                  <li key={idx}>{ex.name || ex.exerciseId?.name || 'Loading...'}</li>
                ))}
              </ol>
            </div>
          </div>

          <div className="station">
            <h3>Station 2: Bag Work (3 Combos)</h3>
            <ol>
              {workout.station2.map((ex, idx) => (
                <li key={idx}>
                  <strong>{String.fromCharCode(65 + idx)}:</strong> {ex.name || ex.exerciseId?.name || 'Loading...'}
                </li>
              ))}
            </ol>
          </div>

          <div className="station">
            <h3>Station 3: Technique (Partner Drills)</h3>
            {nonstopStation3Name ? (
              <ol>
                <li>{nonstopStation3Name}</li>
              </ol>
            ) : (
              <ol>
                {workout.station3.map((ex, idx) => (
                  <li key={idx}>
                    <strong>{String.fromCharCode(65 + idx)}:</strong> {ex.name || ex.exerciseId?.name || 'Loading...'}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Regenerate button is now only used for current/future weeks via parent */}
      </div>
    </div>
  );
};

export default WorkoutView;
