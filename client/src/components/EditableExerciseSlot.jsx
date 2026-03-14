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
  onRefreshWeek,
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
  const [dropdownOpenCount, setDropdownOpenCount] = useState(0); // force search input to remount empty each open
  const [inlineEditValue, setInlineEditValue] = useState(null); // when set, user is typing in the fixed name
  const [addError, setAddError] = useState(null); // brief message when add-new fails
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const inlineInputRef = useRef(null);

  useEffect(() => {
    const v = (value || '').trim();
    const o = (optimisticName || '').trim();
    if (o && v && v.toLowerCase() === o.toLowerCase()) {
      setOptimisticName(null);
    }
  }, [value, optimisticName]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setDropdownSearch('');
        setEditing(false);
      }
    };
    if (dropdownOpen) {
      setDropdownSearch('');
      setDropdownOpenCount((c) => c + 1); // remount search input so it's always empty
      const t = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      const el = searchInputRef.current;
      if (el) {
        el.focus();
      }
      return () => {
        clearTimeout(t);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    } else {
      setDropdownSearch('');
    }
  }, [dropdownOpen]);

  const fetchExercisesList = async () => {
    if (station === 1 && !dayType) {
      setExercises([]);
      return;
    }
    const params = new URLSearchParams({ station: String(station) });
    if (dayType) params.set('dayType', dayType);
    const res = await api.get(`/exercises?${params}`).catch(() => ({ data: [] }));
    const raw = res.data || [];
    const data = raw.filter((ex) => {
      if (Number(ex.station) !== Number(station)) return false;
      if (dayType && (ex.dayType || '').toString() !== (dayType || '').toString()) return false;
      return true;
    });
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

  useEffect(() => {
    if (!workoutId || disabled) return;
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
    fetchExercisesList();
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
        if (dayType) payload.dayType = dayType;
        if (filter) payload.filter = filter;
      }
      const urlId = id || '000000000000000000000000';
      const res = await api.patch(`/workouts/${urlId}/exercise`, payload);
      const data = res.data;
      const mergedDay = (data && data.dayOfWeek) ? String(data.dayOfWeek) : (dayOfWeek ? String(dayOfWeek) : null);
      if (data && mergedDay) {
        const normalized = { ...data, _id: data._id != null ? String(data._id) : data._id, dayOfWeek: mergedDay };
        const fillSlotName = (slot) => {
          if (slot && !slot.name && slot.exerciseId && slot.exerciseId.name) {
            return { ...slot, name: slot.exerciseId.name };
          }
          return slot;
        };
        if (normalized.station1 && normalized.station1.phase1 && Array.isArray(normalized.station1.phase1)) {
          normalized.station1 = {
            ...normalized.station1,
            phase1: normalized.station1.phase1.map(fillSlotName)
          };
        }
        if (normalized.station1 && normalized.station1.phase2 && Array.isArray(normalized.station1.phase2)) {
          normalized.station1.phase2 = normalized.station1.phase2.map(fillSlotName);
        }
        if (normalized.station2 && Array.isArray(normalized.station2)) {
          normalized.station2 = normalized.station2.map(fillSlotName);
        }
        if (normalized.station3 && Array.isArray(normalized.station3)) {
          normalized.station3 = normalized.station3.map(fillSlotName);
        }
        // When we just added by name, force this slot to show that name so parent state is correct
        const addedName = (exerciseName || '').trim();
        if (addedName && station === 1 && normalized.station1) {
          const ph = phase === 2 ? 'phase2' : 'phase1';
          const arr = normalized.station1[ph];
          if (Array.isArray(arr) && arr[slotIndex] != null) {
            arr[slotIndex] = { ...arr[slotIndex], name: addedName };
          }
        } else if (addedName && (station === 2 || station === 3)) {
          const key = station === 2 ? 'station2' : 'station3';
          const arr = normalized[key];
          if (Array.isArray(arr) && arr[slotIndex] != null) {
            arr[slotIndex] = { ...arr[slotIndex], name: addedName };
          }
        }
        if (import.meta.env?.DEV && exerciseName) {
          const slotName = station === 1 ? (normalized.station1?.[phase === 2 ? 'phase2' : 'phase1']?.[slotIndex]?.name) : normalized[station === 2 ? 'station2' : 'station3']?.[slotIndex]?.name;
          console.log('[EditableExerciseSlot] Add success', { mergedDay, slotName, sentName: (exerciseName || '').trim() });
        }
        onUpdate?.(normalized);
      }
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
    setAddError(null);
    setOptimisticName(name);
    try {
      await save(null, name);
      notifyExerciseLab();
      if (!Array.isArray(exerciseOptions) || exerciseOptions.length === 0) {
        fetchExercisesList();
      }
      if (typeof onRefreshWeek === 'function') {
        setTimeout(() => onRefreshWeek(), 400);
      }
    } catch (err) {
      setOptimisticName(null);
      if (err.response?.status === 404) onWorkoutNotFound?.();
      else {
        setAddError('Could not add exercise. Try again.');
        setTimeout(() => setAddError(null), 4000);
      }
    }
  };

  const closeConfirmModal = () => {
    setConfirmModal(null);
    setDropdownSearch('');
    setInlineEditValue(null);
    setDropdownOpen(false);
    setEditing(false);
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
  const commitInlineEdit = (val) => {
    const name = (val || '').trim();
    setInlineEditValue(null);
    if (!name) return;
    const currentName = (value || '').trim();
    if (name.toLowerCase() === currentName.toLowerCase()) return;
    const match = exercises.find((ex) => (ex.name || '').trim().toLowerCase() === name.toLowerCase());
    if (match) {
      selectExercise(match);
      return;
    }
    setConfirmModal({ typedName: name });
  };

  if (!editing) {
    return (
      <div className="editable-exercise-slot editable-exercise-slot-fixed">
        {slotLabel && <span className="editable-slot-label">{slotLabel}.</span>}
        <input
          ref={inlineInputRef}
          type="text"
          className="editable-exercise-fixed-name editable-exercise-inline-input"
          value={inlineEditValue !== null ? inlineEditValue : (displayName || '')}
          onChange={(e) => setInlineEditValue(e.target.value)}
          onFocus={() => setInlineEditValue(inlineEditValue !== null ? inlineEditValue : (displayName || ''))}
          onBlur={(e) => commitInlineEdit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitInlineEdit(inlineEditValue !== null ? inlineEditValue : (displayName || ''));
              inlineInputRef.current?.blur();
            }
          }}
          placeholder="Select or type exercise…"
          aria-label="Exercise name"
        />
        <span className="editable-slot-actions">
          <button
            type="button"
            className="editable-exercise-edit-btn"
            onClick={() => {
              setDropdownSearch('');
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
        {addError && <span className="editable-add-error" role="alert">{addError}</span>}
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
              if (!dropdownOpen) setDropdownSearch('');
              setDropdownOpen((v) => !v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!saving) {
                  if (!dropdownOpen) setDropdownSearch('');
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
                key={`search-${dropdownOpenCount}`}
                ref={searchInputRef}
                type="text"
                className="editable-exercise-dropdown-search"
                placeholder="Search or type a name…"
                value={dropdownOpenCount > 0 ? dropdownSearch : ''}
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
          onClick={(e) => e.target === e.currentTarget && closeConfirmModal()}
        >
          <div className="editable-exercise-confirm-modal" onClick={(e) => e.stopPropagation()}>
            {currentExerciseId ? (
              <>
                <p id="editable-exercise-confirm-title">Are you sure you want to add this new exercise?</p>
                <p className="editable-exercise-confirm-name">&quot;{confirmModal.typedName}&quot;</p>
                <div className="editable-exercise-confirm-actions">
                  <button type="button" className="btn-primary" onClick={handleConfirmAddNew}>
                    Add
                  </button>
                  <button type="button" className="btn-secondary" onClick={handleConfirmEdit}>
                    Edit existing instead
                  </button>
                  <button type="button" className="btn-secondary" onClick={closeConfirmModal}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p id="editable-exercise-confirm-title">Are you sure you want to add this new exercise?</p>
                <p className="editable-exercise-confirm-name">&quot;{confirmModal.typedName}&quot;</p>
                <div className="editable-exercise-confirm-actions">
                  <button type="button" className="btn-primary" onClick={handleConfirmAddNew}>
                    Add
                  </button>
                  <button type="button" className="btn-secondary" onClick={closeConfirmModal}>
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
