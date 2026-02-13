import { useState, useEffect } from 'react';
import api from '../utils/api';
import { getWorkoutId } from '../utils/workoutId';

/**
 * Monday Station 1: one phase only — 3 exercises selected together as a tri-set (same sequence).
 */
export default function MondayStation1Selector({ workoutId, workout, weekStartDate, dayOfWeek, onUpdate, disabled = false }) {
  const [triSets, setTriSets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (!workoutId || disabled) return;
    api.get('/trisets?focus=Mixed')
      .then((res) => {
        const all = res.data || [];
        setTriSets(all.filter((ts) => ts.exerciseIds && ts.exerciseIds.length === 3));
      })
      .catch(() => setTriSets([]));
  }, [workoutId, disabled]);

  useEffect(() => {
    if (!workout?.station1 || triSets.length === 0) {
      setSelectedId('');
      return;
    }
    const p1 = workout.station1.phase1 || [];
    const p1Ids = (p1.map((ex) => (ex.exerciseId?._id || ex.exerciseId)?.toString()).filter(Boolean));
    const match = triSets.find((ts) => {
      const tsP1 = (ts.exerciseIds || []).map((ex) => (typeof ex === 'object' ? ex._id : ex)?.toString());
      if (tsP1.length !== 3 || p1Ids.length !== 3) return false;
      return tsP1.every((id, i) => id === p1Ids[i]);
    });
    setSelectedId(match ? match._id : '');
  }, [workout, triSets]);

  const handleChange = (e) => {
    const triSetId = e.target.value;
    const id = getWorkoutId(workoutId);
    if (!triSetId) return;
    if (!id && !(weekStartDate && dayOfWeek)) return;
    setSaving(true);
    const payload = { triSetId };
    if (weekStartDate) payload.weekStartDate = weekStartDate;
    if (dayOfWeek) payload.dayOfWeek = dayOfWeek;
    const urlId = id || '000000000000000000000000';
    api
      .patch(`/workouts/${urlId}/station1-monday-set`, payload)
      .then((res) => {
        onUpdate?.(res.data);
        setSelectedId(triSetId);
      })
      .catch((err) => alert(err.response?.data?.error || 'Failed to update'))
      .finally(() => setSaving(false));
  };

  const displayName = (ts) => {
    if (ts.concept && ts.concept.trim()) return ts.concept.trim();
    const p1 = (ts.exerciseIds || []).map((ex) => (typeof ex === 'object' ? ex.name : '')).filter(Boolean);
    return p1.length ? p1.join(' → ') : 'Tri-set';
  };

  const phase1 = workout?.station1?.phase1 || [];

  if (disabled) {
    return (
      <div className="station1-triset-selector monday-station1">
        <div className="past-week-phase">
          <div className="past-week-phase-label">Station 1</div>
          <ul className="past-week-list compact">{phase1.map((ex, idx) => <li key={idx}>{ex.name || ex.exerciseId?.name || '—'}</li>)}</ul>
        </div>
      </div>
    );
  }

  return (
    <div className="station1-triset-selector monday-station1">
      <div className="past-week-phase-label">Station 1 (3 exercises, same sequence)</div>
      <select
        className="editable-exercise-select triset-select"
        value={selectedId}
        onChange={handleChange}
        disabled={saving}
        title="Select a tri-set — all 3 exercises update together in order"
      >
        <option value="">Select tri-set…</option>
        {triSets.map((ts) => (
          <option key={ts._id} value={ts._id}>{displayName(ts)}</option>
        ))}
      </select>
      {saving && <span className="editable-saving">Saving…</span>}
      <div className="past-week-phase">
        <ul className="past-week-list compact editable-list">
          {phase1.map((ex, idx) => (
            <li key={idx}><strong>{String.fromCharCode(65 + idx)}.</strong> {ex.name || ex.exerciseId?.name || '—'}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
