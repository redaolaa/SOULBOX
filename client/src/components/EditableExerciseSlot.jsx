import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { getWorkoutId } from '../utils/workoutId';

export default function EditableExerciseSlot({
  value,
  workoutId,
  station,
  phase,
  slotIndex,
  dayType,
  filter,
  onUpdate,
  disabled = false,
  slotLabel,
  canRegenerate = false,
  onWorkoutNotFound,
  weekStartDate,
  dayOfWeek
}) {
  const [exercises, setExercises] = useState([]);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [optimisticName, setOptimisticName] = useState(null); // show selected name immediately
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  useEffect(() => {
    if (!workoutId || disabled) return;

    const fetchExercises = async () => {
      // Station-specific: Station 1 only shows Station 1, Station 2 only Station 2, etc.
      // Station 1 ( Conditioning ): station + dayType + focus (Upper/Lower/Mixed)
      // Station 2 & 3 ( Bag Work / Technique ): station + dayType only
      const params = new URLSearchParams({ station: String(station) });
      if (dayType) params.set('dayType', dayType);
      if (station === 1 && filter) {
        const focusList = filter === 'Upper Body' ? ['Upper'] : filter === 'Lower Body' ? ['Lower'] : ['Mixed', 'Full Body'];
        focusList.forEach((f) => params.append('focus', f));
      }
      const res = await api.get(`/exercises?${params}`).catch(() => ({ data: [] }));
      const raw = res.data || [];
      const data = raw.filter((ex) => Number(ex.station) === Number(station));

      // Deduplicate by normalized name
      const normalizeNameForDedupe = (name) => {
        const key = (name || '').trim().toLowerCase();
        if (!key) return key;
        const words = key.split(/\s+/);
        const last = words[words.length - 1];
        const noPluralS = ['focus', 'cross', 'press', 'bus', 'plus', 'us', 'is', 'as'];
        if (last && last.length > 1 && last.endsWith('s') && !last.endsWith('ss') && !noPluralS.includes(last)) {
          words[words.length - 1] = last.slice(0, -1);
        }
        return words.join(' ');
      };
      const seen = new Set();
      const unique = data.filter((ex) => {
        const key = normalizeNameForDedupe(ex.name);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setExercises(unique.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    };

    fetchExercises();
  }, [workoutId, station, dayType, filter, disabled]);

  const save = async (exerciseId, exerciseName) => {
    const id = getWorkoutId(workoutId);
    if (!id && !(weekStartDate && dayOfWeek)) return Promise.reject();
    if (exerciseId === '' && !exerciseName) return Promise.reject();

    setSaving(true);
    try {
      const payload = {
        station,
        phase: station === 1 ? (phase || 1) : undefined,
        slotIndex
      };
      if (weekStartDate) payload.weekStartDate = weekStartDate;
      if (dayOfWeek) payload.dayOfWeek = dayOfWeek;
      if (exerciseId) {
        const exId = exerciseId && (exerciseId._id ?? exerciseId);
        payload.exerciseId = exId != null ? String(exId) : exerciseId;
      } else {
        payload.exerciseName = (exerciseName || '').trim();
      }
      const urlId = id || '000000000000000000000000';
      const res = await api.patch(`/workouts/${urlId}/exercise`, payload);
      onUpdate?.(res.data);
      return Promise.resolve();
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) onWorkoutNotFound?.();
      // Silently fail for this slot selection (we keep showing the chosen exercise)
      // so the user isn't interrupted by alert popups.
      if (import.meta.env?.DEV) {
        // Log details only in development for debugging.
        // eslint-disable-next-line no-console
        console.error('Failed to save exercise slot', {
          status,
          data: err.response?.data,
          url: err.config?.url,
        });
      }
      return Promise.reject(err);
    } finally {
      setSaving(false);
    }
  };

  const selectExercise = (ex) => {
    if (!ex) return;
    const name = (ex.name || '').trim();
    setOptimisticName(name);
    setDropdownOpen(false);
    save(ex._id, null)
      .then(() => setOptimisticName(null)) // success: parent has new workout, clear so we use value from parent
      .catch(() => {}); // failure: keep showing selected exercise (don't revert)
  };

  const selectKeepCurrent = () => {
    setDropdownOpen(false);
  };

  const regenerateSlot = async () => {
    // Never change Station 3 on Mon/Wed/Sat – always Non‑Stop Sparring
    if (
      station === 3 &&
      (dayOfWeek === 'Monday' || dayOfWeek === 'Wednesday' || dayOfWeek === 'Saturday')
    ) {
      return;
    }

    // Pick a new random exercise from the CURRENT list, different from the one shown
    if (!exercises.length) return;

    const currentName = (optimisticName || value || '').trim();
    const candidates = exercises.filter(
      (ex) => (ex.name || '').trim() && (ex.name || '').trim() !== currentName
    );
    if (!candidates.length) return; // nothing different to choose

    const next = candidates[Math.floor(Math.random() * candidates.length)];
    const name = (next.name || '').trim();

    setRegenerating(true);
    setOptimisticName(name); // show immediately
    try {
      await save(next._id, null);
      // on success, parent workout is updated; clear optimistic so we rely on parent value
      setOptimisticName(null);
    } catch {
      // keep optimisticName so the user still sees the new choice even if save failed
    } finally {
      setRegenerating(false);
    }
  };

  if (disabled) {
    return <span className="editable-exercise-value">{value || '—'}</span>;
  }

  const currentName = (value || '').trim();
  const currentInList = exercises.find((ex) => (ex.name || '').trim() === currentName);
  const showCurrentAsOption = currentName && !currentInList;

  // Show selected exercise immediately (optimistic), then value from server when save completes
  const displayName = optimisticName ?? (currentInList?.name ?? (showCurrentAsOption ? currentName : ''));
  const triggerLabel = displayName || 'Select exercise…';

  return (
    <div className="editable-exercise-slot" ref={dropdownRef}>
      {slotLabel && <span className="editable-slot-label">{slotLabel}.</span>}
      <div className="editable-exercise-row">
        <div className="editable-exercise-dropdown-wrap" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <div
            className={`editable-exercise-select editable-exercise-select-trigger ${dropdownOpen ? 'open' : ''}`}
            onClick={() => !saving && setDropdownOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!saving) setDropdownOpen((v) => !v);
              }
            }}
            role="button"
            tabIndex={0}
            title={`Exercises for Station ${station} (${dayType || ''} ${filter || ''})`}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
          >
            {triggerLabel}
          </div>
          {dropdownOpen && (
          <ul className="editable-exercise-dropdown" role="listbox">
            <li>
              <button
                type="button"
                className="editable-exercise-option empty"
                onClick={() => { setDropdownOpen(false); }}
              >
                Select exercise…
              </button>
            </li>
            {showCurrentAsOption && (
              <li>
                <button
                  type="button"
                  className="editable-exercise-option"
                  onClick={selectKeepCurrent}
                >
                  {currentName} (keep)
                </button>
              </li>
            )}
            {exercises.map((ex) => (
              <li key={ex._id}>
                <button
                  type="button"
                  className="editable-exercise-option"
                  onClick={() => selectExercise(ex)}
                >
                  {ex.name}
                </button>
              </li>
            ))}
          </ul>
          )}
        </div>
        {canRegenerate && (
          <button
            type="button"
            className="editable-exercise-refresh"
            onClick={regenerateSlot}
            disabled={saving || regenerating}
            title="Pick a new random exercise for this slot"
            aria-label="Regenerate exercise"
          >
            {regenerating ? '…' : '↻'}
          </button>
        )}
        {saving && <span className="editable-saving">Saving…</span>}
        {regenerating && !saving && <span className="editable-saving">Regenerating…</span>}
      </div>
    </div>
  );
}
