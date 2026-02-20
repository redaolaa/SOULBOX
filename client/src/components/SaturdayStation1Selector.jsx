import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { getWorkoutId } from '../utils/workoutId';
import EditableExerciseSlot from './EditableExerciseSlot';

/**
 * Saturday Station 1: Phase 1 + Phase 2 linked (6 exercises). One tri-set fills both phases in sequence.
 */
export default function SaturdayStation1Selector({ workoutId, workout, weekStartDate, dayOfWeek, onUpdate, disabled = false }) {
  const [triSets, setTriSets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!workoutId || disabled) return;
    api.get('/trisets?focus=Lower')
      .then((res) => {
        const all = res.data || [];
        setTriSets(all.filter((ts) => ts.phase2ExerciseIds && ts.phase2ExerciseIds.length === 3));
      })
      .catch(() => setTriSets([]));
  }, [workoutId, disabled]);

  useEffect(() => {
    if (!workout?.station1 || triSets.length === 0) {
      setSelectedId('');
      return;
    }
    const p1 = workout.station1.phase1 || [];
    const p2 = workout.station1.phase2 || [];
    const p1Ids = p1.map((ex) => (ex.exerciseId?._id || ex.exerciseId)?.toString()).filter(Boolean);
    const p2Ids = p2.map((ex) => (ex.exerciseId?._id || ex.exerciseId)?.toString()).filter(Boolean);
    const match = triSets.find((ts) => {
      const tsP1 = (ts.exerciseIds || []).map((ex) => (typeof ex === 'object' ? ex._id : ex)?.toString());
      const tsP2 = (ts.phase2ExerciseIds || []).map((ex) => (typeof ex === 'object' ? ex._id : ex)?.toString());
      return tsP1.length === 3 && tsP2.length === 3 &&
        tsP1.every((id, i) => id === p1Ids[i]) && tsP2.every((id, i) => id === p2Ids[i]);
    });
    setSelectedId(match ? match._id : '');
  }, [workout, triSets]);

  const displayName = (ts) => {
    if (ts.concept && ts.concept.trim()) return ts.concept.trim();
    const p1 = (ts.exerciseIds || []).map((ex) => (typeof ex === 'object' ? ex.name : '')).filter(Boolean);
    return p1.length ? p1.join(' → ') : 'Tri-set';
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setDropdownSearch('');
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      searchInputRef.current?.focus();
      return () => document.removeEventListener('mousedown', handleClickOutside);
    } else {
      setDropdownSearch('');
    }
  }, [dropdownOpen]);

  const searchRaw = (dropdownSearch || '').trim().toLowerCase().replace(/^[.\/]+/, '');
  const filteredTriSets = searchRaw
    ? triSets.filter((ts) => displayName(ts).toLowerCase().startsWith(searchRaw))
    : triSets;

  const handleSelectTriSet = (triSetId) => {
    if (!triSetId) return;
    setDropdownOpen(false);
    setDropdownSearch('');
    setSaving(true);
    const id = getWorkoutId(workoutId);
    if (!id && !(weekStartDate && dayOfWeek)) return;
    const payload = { triSetId };
    if (weekStartDate) payload.weekStartDate = weekStartDate;
    if (dayOfWeek) payload.dayOfWeek = dayOfWeek;
    const urlId = id || '000000000000000000000000';
    api
      .patch(`/workouts/${urlId}/station1-saturday-set`, payload)
      .then((res) => {
        onUpdate?.(res.data);
        setSelectedId(triSetId);
      })
      .catch((err) => alert(err.response?.data?.error || 'Failed to update'))
      .finally(() => setSaving(false));
  };

  const selectedTriSet = triSets.find((ts) => ts._id === selectedId);
  const triggerLabel = selectedTriSet ? displayName(selectedTriSet) : 'Select tri-set…';

  const phase1 = workout?.station1?.phase1 || [];
  const phase2 = workout?.station1?.phase2 || [];

  if (disabled) {
    return (
      <div className="station1-triset-selector saturday-station1">
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

  return (
    <div className="station1-triset-selector saturday-station1" ref={dropdownRef}>
      <div className="past-week-phase-label">Station 1 (Phase 1 + Phase 2 — linked)</div>
      <div style={{ position: 'relative' }}>
        <div
          className={`editable-exercise-select editable-exercise-select-trigger triset-select ${dropdownOpen ? 'open' : ''}`}
          onClick={() => !saving && setDropdownOpen((v) => !v)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!saving) setDropdownOpen((v) => !v); } }}
          role="button"
          tabIndex={0}
          title="Select a tri-set — Phase 1 and Phase 2 update together in sequence"
        >
          {triggerLabel}
        </div>
        {dropdownOpen && (
          <ul className="editable-exercise-dropdown" role="listbox">
            <li className="editable-exercise-dropdown-search-wrap">
              <input
                ref={searchInputRef}
                type="text"
                className="editable-exercise-dropdown-search"
                placeholder="Search tri-sets…"
                value={dropdownSearch}
                onChange={(e) => setDropdownSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                aria-label="Filter tri-sets"
              />
            </li>
            <li>
              <button type="button" className="editable-exercise-option empty" onClick={() => setDropdownOpen(false)}>
                Select tri-set…
              </button>
            </li>
            {filteredTriSets.map((ts) => (
              <li key={ts._id}>
                <button
                  type="button"
                  className="editable-exercise-option"
                  onClick={() => handleSelectTriSet(ts._id)}
                >
                  {displayName(ts)}
                </button>
              </li>
            ))}
            {filteredTriSets.length === 0 && searchRaw && (
              <li className="editable-exercise-option empty">No matches</li>
            )}
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
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
