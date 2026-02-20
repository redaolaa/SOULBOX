import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { getWorkoutId } from '../utils/workoutId';
import EditableExerciseSlot from './EditableExerciseSlot';

/**
 * Monday Station 1: Phase 1 (ATT/DEF sequence) + Phase 2 (progression). Optional tri-set replaces Phase 1.
 */
export default function MondayStation1Selector({ workoutId, workout, weekStartDate, weekNumber, dayOfWeek, onUpdate, disabled = false }) {
  const [triSets, setTriSets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  const displayName = (ts) => {
    if (ts.concept && ts.concept.trim()) return ts.concept.trim();
    const p1 = (ts.exerciseIds || []).map((ex) => (typeof ex === 'object' ? ex.name : '')).filter(Boolean);
    return p1.length ? p1.join(' → ') : 'Tri-set';
  };

  // Week label for this tri-set (from concept/name e.g. "Week 151: 1/ SWITCH/3" -> "Week 151")
  const getTriSetWeekLabel = (ts) => {
    const str = (ts?.concept || ts?.name || '').trim();
    const match = str.match(/Week\s*(\d+)/i);
    return match ? `Week ${match[1]}` : (str || 'Tri-set');
  };

  // Phase 2: all 3 exercises as [{ letter: 'A', name }, ...] for easy A. B. C. display
  const phase2List = (ts) => {
    const p2 = ts.phase2ExerciseIds || [];
    if (p2.length !== 3) return [];
    return p2.map((ex, i) => ({
      letter: String.fromCharCode(65 + i),
      name: typeof ex === 'object' ? (ex.name || '') : ''
    })).filter((item) => item.name);
  };
  const phase2Display = (ts) => phase2List(ts).map(({ letter, name }) => `${letter}. ${name}`).join(' · ');

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const filteredTriSets = triSets;

  const phase1 = workout?.station1?.phase1 || [];
  const phase2 = workout?.station1?.phase2 || [];

  if (disabled) {
    return (
      <div className="station1-triset-selector monday-station1">
        <div className="past-week-phase">
          <div className="past-week-phase-label">Phase 1</div>
          <ul className="past-week-list compact">{phase1.map((ex, idx) => <li key={idx}>{ex.name || ex.exerciseId?.name || '—'}</li>)}</ul>
        </div>
        <div className="past-week-phase">
          <div className="past-week-phase-label">Phase 2</div>
          <ul className="past-week-list compact">{phase2.map((ex, idx) => <li key={idx}>{ex.name || ex.exerciseId?.name || '—'}</li>)}</ul>
        </div>
      </div>
    );
  }

  const handleSelectTriSet = (triSetId) => {
    if (!triSetId) return;
    setDropdownOpen(false);
    setSaving(true);
    const id = getWorkoutId(workoutId);
    if (!id && !(weekStartDate && dayOfWeek)) return;
    const payload = { triSetId };
    if (weekStartDate) payload.weekStartDate = weekStartDate;
    if (dayOfWeek) payload.dayOfWeek = dayOfWeek;
    const urlId = id || '000000000000000000000000';
    api
      .patch(`/workouts/${urlId}/station1-monday-set`, payload)
      .then((res) => {
        const updatedWorkout = res.data;
        if (updatedWorkout) onUpdate?.(updatedWorkout);
        setSelectedId(triSetId);
      })
      .catch((err) => alert(err.response?.data?.error || 'Failed to update'))
      .finally(() => setSaving(false));
  };

  const selectedTriSet = triSets.find((ts) => ts._id === selectedId);
  const triggerPhase2List = selectedTriSet ? phase2List(selectedTriSet) : [];
  // Phase 2 dropdown: show all 3 exercises for this week — from selected tri-set when it has Phase 2, else from this week's workout Phase 2
  const phase2FromTriSet = (selectedTriSet?.phase2ExerciseIds && selectedTriSet.phase2ExerciseIds.length === 3)
    ? selectedTriSet.phase2ExerciseIds
    : [];
  const phase2FromWorkout = (phase2.length === 3 && phase2.every((ex) => (ex?.exerciseId?._id ?? ex?.exerciseId) && (ex?.name || ex?.exerciseId?.name)))
    ? phase2.map((ex) => ({ _id: ex.exerciseId?._id ?? ex.exerciseId, name: ex.name || ex.exerciseId?.name || '' }))
    : [];
  const phase2Options = phase2FromTriSet.length === 3 ? phase2FromTriSet : phase2FromWorkout;

  const weekLabel = weekNumber != null ? `Week ${weekNumber}` : '';
  const selectedWeekLabel = selectedTriSet ? getTriSetWeekLabel(selectedTriSet) : weekLabel;

  return (
    <div className="station1-triset-selector monday-station1" ref={dropdownRef}>
      <div className="past-week-phase-label">Station 1 · Select tri-set</div>
      <div style={{ position: 'relative' }}>
        <div
          className={`editable-exercise-select editable-exercise-select-trigger triset-select ${dropdownOpen ? 'open' : ''}`}
          onClick={() => !saving && setDropdownOpen((v) => !v)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!saving) setDropdownOpen((v) => !v); } }}
          role="button"
          tabIndex={0}
          title="Select a tri-set — A, B, C update together"
        >
          {selectedTriSet && triggerPhase2List.length === 3 ? (
            <span className="triset-trigger-content">
              <span className="triset-trigger-week">{selectedWeekLabel}</span>
              <span className="triset-trigger-phase2">
                {triggerPhase2List.map(({ letter, name }, idx) => (
                  <span key={letter}>
                    {idx > 0 && <span className="triset-phase2-divider" />}
                    <span className="triset-phase2-line">{letter}. {name}</span>
                  </span>
                ))}
              </span>
            </span>
          ) : (
            'Select tri-set…'
          )}
        </div>
        {dropdownOpen && (
          <ul className="editable-exercise-dropdown triset-dropdown-simple" role="listbox">
            {filteredTriSets.map((ts) => {
              const p2List = phase2List(ts);
              return (
                <li key={ts._id}>
                  <button
                    type="button"
                    className="editable-exercise-option triset-option"
                    onClick={() => handleSelectTriSet(ts._id)}
                  >
                    <span className="triset-option-week">{getTriSetWeekLabel(ts)}</span>
                    {p2List.length === 3 ? (
                      <span className="triset-option-phase2">
                        {p2List.map(({ letter, name }, idx) => (
                          <span key={letter}>
                            {idx > 0 && <span className="triset-phase2-divider" />}
                            <span className="triset-phase2-line">{letter}. {name}</span>
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="triset-phase2-line">—</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {saving && <span className="editable-saving">Saving…</span>}
      <div className="past-week-phase">
        <div className="past-week-phase-label">Phase 1</div>
        <ul className="past-week-list compact editable-list">
          {[0, 1, 2].map((idx) => {
            const ex = phase1[idx] || {};
            const value = ex.name || ex.exerciseId?.name || '';
            return (
              <li key={idx}>
                <EditableExerciseSlot
                  value={value}
                  workoutId={workoutId}
                  station={1}
                  phase={1}
                  slotIndex={idx}
                  dayType={workout?.dayType}
                  filter={workout?.filter}
                  weekStartDate={weekStartDate}
                  dayOfWeek={dayOfWeek}
                  onUpdate={onUpdate}
                  slotLabel={String.fromCharCode(65 + idx)}
                />
              </li>
            );
          })}
        </ul>
      </div>
      <div className="past-week-phase">
        <div className="past-week-phase-label">Phase 2</div>
        <ul className="past-week-list compact editable-list">
          {[0, 1, 2].map((idx) => {
            const ex = phase2[idx] || {};
            const value = ex.name || ex.exerciseId?.name || '';
            return (
              <li key={idx}>
                <EditableExerciseSlot
                  value={value}
                  workoutId={workoutId}
                  station={1}
                  phase={2}
                  slotIndex={idx}
                  dayType={workout?.dayType}
                  filter={workout?.filter}
                  weekStartDate={weekStartDate}
                  dayOfWeek={dayOfWeek}
                  onUpdate={onUpdate}
                  slotLabel={String.fromCharCode(65 + idx)}
                  exerciseOptions={phase2Options}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
