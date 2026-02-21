import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  onWorkoutNotFound,
  weekStartDate,
  dayOfWeek,
  exerciseOptions = null,
  currentExerciseId = null // when slot has an exercise, pass its _id so we can offer "edit" vs "add new"
}) {
  const [exercises, setExercises] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [optimisticName, setOptimisticName] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { typedName } for "Edit or add new?"
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setDropdownSearch('');
        setEditing(false);
      }
    };
    if (dropdownOpen) {
      // Delay listener so the click that opened the dropdown isn't treated as outside
      const t = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      const el = searchInputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
      return () => {
        clearTimeout(t);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    } else {
      setDropdownSearch('');
    }
  }, [dropdownOpen]);

  useEffect(() => {
    if (!workoutId || disabled) return;
    // When parent passes Phase 2 options (e.g. Monday tri-set Phase 2), use them as the dropdown list
    if (Array.isArray(exerciseOptions) && exerciseOptions.length > 0) {
      const list = exerciseOptions.map((ex) => ({
        _id: ex._id || ex.exerciseId?._id,
        name: ex.name || ex.exerciseId?.name || ''
      })).filter((ex) => ex._id && ex.name);
      setExercises(list);
      return;
    }
    if (station === 1 && !dayType) {
      setExercises([]);
      return;
    }

    const fetchExercises = async () => {
      // Station 1: request all exercises for this dayType (any focus — Upper, Lower, Mixed, Cardio, Abs, etc.) so users can assign any exercise to any day.
      // Station 2 & 3: station + dayType only
      const params = new URLSearchParams({ station: String(station) });
      if (dayType) params.set('dayType', dayType);
      // Do not send focus for Station 1 — server returns all Station 1 exercises for this dayType
      const res = await api.get(`/exercises?${params}`).catch(() => ({ data: [] }));
      const raw = res.data || [];
      const data = raw.filter((ex) => {
        if (Number(ex.station) !== Number(station)) return false;
        if (dayType && (ex.dayType || '').toString() !== (dayType || '').toString()) return false;
        return true;
      });

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
  }, [workoutId, station, dayType, filter, disabled, exerciseOptions]);

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
    setEditing(false);
    save(ex._id, null)
      .then(() => setOptimisticName(null)) // success: parent has new workout, clear so we use value from parent
      .catch(() => {}); // failure: keep showing selected exercise (don't revert)
  };

  const selectKeepCurrent = () => {
    setDropdownOpen(false);
    setEditing(false);
  };

  const notifyExerciseLab = () => {
    try {
      window.dispatchEvent(new CustomEvent('exercises-updated'));
    } catch (_) {}
  };

  const commitTypedName = (typedName) => {
    const name = (typedName || '').trim();
    if (!name) return;
    const currentName = (value || '').trim();
    if (name.toLowerCase() === currentName.toLowerCase()) {
      setDropdownOpen(false);
      setEditing(false);
      return;
    }
    // If typed name matches an exercise in the list, switch to it (same as clicking it)
    const match = exercises.find((ex) => (ex.name || '').trim().toLowerCase() === name.toLowerCase());
    if (match) {
      selectExercise(match);
      return;
    }
    // Otherwise: new name → show confirmation (edit existing exercise vs add new)
    setConfirmModal({ typedName: name });
  };

  const handleConfirmEdit = async () => {
    if (!confirmModal?.typedName || !currentExerciseId) return;
    const name = confirmModal.typedName.trim();
    setConfirmModal(null);
    setDropdownOpen(false);
    setEditing(false);
    setSaving(true);
    setOptimisticName(name);
    try {
      await api.put(`/exercises/${currentExerciseId}`, { name });
      await save(currentExerciseId, null);
      setOptimisticName(null);
      notifyExerciseLab();
    } catch (err) {
      setOptimisticName(null);
      if (import.meta.env?.DEV) console.error('Edit exercise failed', err);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmAddNew = async () => {
    if (!confirmModal?.typedName) return;
    const name = confirmModal.typedName.trim();
    setConfirmModal(null);
    setDropdownOpen(false);
    setEditing(false);
    setOptimisticName(name);
    save(null, name).then(() => { setOptimisticName(null); notifyExerciseLab(); }).catch(() => setOptimisticName(null));
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

  const searchRaw = (dropdownSearch || '').trim().toLowerCase().replace(/^[.\/]+/, '');
  const filteredExercises = searchRaw
    ? exercises.filter((ex) => (ex.name || '').toLowerCase().startsWith(searchRaw))
    : exercises;

  // Fixed view: show exercise name + small pen icon (no dropdown until pen is clicked)
  const penIcon = (
    <svg className="editable-pen-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
  if (!editing) {
    return (
      <div className="editable-exercise-slot editable-exercise-slot-fixed">
        {slotLabel && <span className="editable-slot-label">{slotLabel}.</span>}
        <span className="editable-exercise-fixed-name">{displayName || '—'}</span>
        <span className="editable-slot-actions">
          <button
            type="button"
            className="editable-exercise-edit-btn"
            onClick={() => {
              setDropdownSearch((value || '').trim());
              setDropdownOpen(true);
              setEditing(true);
            }}
            title="Edit exercise"
            aria-label="Edit exercise"
          >
            {penIcon}
          </button>
          {saving && <span className="editable-saving">Saving…</span>}
        </span>
      </div>
    );
  }

  return (
    <div className="editable-exercise-slot" ref={dropdownRef}>
      {slotLabel && <span className="editable-slot-label">{slotLabel}.</span>}
      <div className="editable-exercise-row">
        <div className="editable-exercise-dropdown-wrap" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <div
            className={`editable-exercise-select editable-exercise-select-trigger ${dropdownOpen ? 'open' : ''}`}
            onClick={() => {
              if (saving) return;
              if (!dropdownOpen) setDropdownSearch((value || '').trim());
              setDropdownOpen((v) => !v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!saving) {
                  if (!dropdownOpen) setDropdownSearch((value || '').trim());
                  setDropdownOpen((v) => !v);
                }
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
            <li className="editable-exercise-dropdown-search-wrap">
              <input
                ref={searchInputRef}
                type="text"
                className="editable-exercise-dropdown-search"
                placeholder="Search or type a name…"
                value={dropdownSearch}
                onChange={(e) => setDropdownSearch(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    const name = (dropdownSearch || '').trim();
                    if (name) commitTypedName(name);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label="Filter or type exercise name"
              />
            </li>
            <li>
              <button
                type="button"
                className="editable-exercise-option empty"
                onClick={() => { setDropdownOpen(false); setEditing(false); }}
              >
                Select exercise…
              </button>
            </li>
            {showCurrentAsOption && (currentName.toLowerCase().startsWith(searchRaw) || !searchRaw) && (
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
            {searchRaw.trim() && (
              <li>
                <button
                  type="button"
                  className="editable-exercise-option use-typed-name"
                  onClick={() => commitTypedName(dropdownSearch.trim())}
                >
                  Use &quot;{searchRaw.trim()}&quot; → Edit or add new
                </button>
              </li>
            )}
            {filteredExercises.map((ex) => (
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
            {filteredExercises.length === 0 && searchRaw && (
              <li className="editable-exercise-option empty">No matches</li>
            )}
            {filteredExercises.length === 0 && !searchRaw && station === 2 && (
              <li className="editable-exercise-option empty">No Station 2 exercises for this day. Add them in Exercise Lab.</li>
            )}
          </ul>
          )}
        </div>
        {saving && <span className="editable-saving">Saving…</span>}
      </div>

      {confirmModal && createPortal(
        <div
          className="editable-exercise-confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="editable-exercise-confirm-title"
          onClick={(e) => e.target === e.currentTarget && setConfirmModal(null)}
        >
          <div className="editable-exercise-confirm-modal" onClick={(e) => e.stopPropagation()}>
            {currentExerciseId ? (
              <>
                <p id="editable-exercise-confirm-title">Do you want to edit this exercise or add a new exercise?</p>
                <p className="editable-exercise-confirm-name">&quot;{confirmModal.typedName}&quot;</p>
                <div className="editable-exercise-confirm-actions">
                  <button type="button" className="btn-secondary" onClick={handleConfirmEdit}>
                    Edit existing
                  </button>
                  <button type="button" className="btn-primary" onClick={handleConfirmAddNew}>
                    Add new exercise
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setConfirmModal(null)}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p id="editable-exercise-confirm-title">Add new exercise?</p>
                <p className="editable-exercise-confirm-name">&quot;{confirmModal.typedName}&quot;</p>
                <div className="editable-exercise-confirm-actions">
                  <button type="button" className="btn-primary" onClick={handleConfirmAddNew}>
                    Add
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setConfirmModal(null)}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
