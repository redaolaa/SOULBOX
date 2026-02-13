import { useState, useEffect } from 'react';
import api from '../utils/api';

/**
 * Station 1 Phase tri-set selector for Monday & Saturday.
 * All 3 exercises are linked; user picks one tri-set and all 3 slots update together.
 */
export default function Station1TriSetSelector({
  phase,
  workoutId,
  currentPhaseExercises,
  focus,
  onUpdate,
  disabled = false
}) {
  const [triSets, setTriSets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const triSetFocus = focus === 'Mixed/Full Body' ? 'Mixed' : focus === 'Upper Body' ? 'Upper' : focus === 'Lower Body' ? 'Lower' : 'Mixed';

  useEffect(() => {
    if (!workoutId || disabled) return;
    const params = new URLSearchParams({ focus: triSetFocus });
    api.get(`/trisets?${params}`)
      .then((res) => setTriSets(res.data || []))
      .catch(() => setTriSets([]));
  }, [workoutId, triSetFocus, disabled]);

  useEffect(() => {
    if (!currentPhaseExercises?.length || triSets.length === 0) {
      setSelectedId('');
      return;
    }
    const currentIds = new Set(
      (currentPhaseExercises || [])
        .map((ex) => ex.exerciseId?._id || ex.exerciseId)
        .filter(Boolean)
    );
    const match = triSets.find((ts) => {
      const tsIds = (ts.exerciseIds || []).map((ex) => (typeof ex === 'object' ? ex._id : ex));
      return tsIds.length === 3 && tsIds.every((id) => currentIds.has(String(id)));
    });
    setSelectedId(match ? match._id : '');
  }, [currentPhaseExercises, triSets]);

  const handleChange = (e) => {
    const triSetId = e.target.value;
    if (!triSetId || !workoutId) return;
    setSaving(true);
    api
      .patch(`/workouts/${workoutId}/station1-phase`, { phase, triSetId })
      .then((res) => {
        onUpdate?.(res.data);
        setSelectedId(triSetId);
      })
      .catch((err) => alert(err.response?.data?.error || 'Failed to update'))
      .finally(() => setSaving(false));
  };

  const phaseLabel = phase === 1 ? 'Tri-set' : 'Phase 2';
  const displayName = (ts) => {
    if (ts.concept && ts.concept.trim()) return ts.concept.trim();
    if (ts.name && ts.name.trim()) return ts.name.trim();
    const names = (ts.exerciseIds || []).map((ex) => (typeof ex === 'object' ? ex.name : '')).filter(Boolean);
    return names.length ? names.join(' → ') : 'Tri-set';
  };

  if (disabled) {
    return (
      <div className="station1-triset-selector">
        <span className="past-week-phase-label">{phaseLabel}</span>
        <ul className="past-week-list compact">
          {(currentPhaseExercises || []).map((ex, idx) => (
            <li key={idx}>{ex.name || ex.exerciseId?.name || '—'}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="station1-triset-selector">
      <div className="past-week-phase-label">{phaseLabel}</div>
      <select
        className="editable-exercise-select triset-select"
        value={selectedId}
        onChange={handleChange}
        disabled={saving}
        title={`Select a tri-set for ${phaseLabel}; all 3 exercises update together`}
      >
        <option value="">Select tri-set…</option>
        {triSets.map((ts) => (
          <option key={ts._id} value={ts._id}>
            {displayName(ts)}
          </option>
        ))}
      </select>
      {saving && <span className="editable-saving">Saving…</span>}
      <ul className="past-week-list compact editable-list">
        {(currentPhaseExercises || []).map((ex, idx) => (
          <li key={idx}>
            <strong>{String.fromCharCode(65 + idx)}.</strong> {ex.name || ex.exerciseId?.name || '—'}
          </li>
        ))}
      </ul>
    </div>
  );
}
