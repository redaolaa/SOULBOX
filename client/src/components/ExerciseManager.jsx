import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';

const ExerciseManager = () => {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    station: 1,
    focus: 'Upper',
    dayType: 'Kickboxing',
    isStatic: false,
    staticCondition: null
  });
  const [filters, setFilters] = useState({
    station: 'all',
    focus: 'all',
    dayType: 'all'
  });
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [triSets, setTriSets] = useState([]);
  const [triSetExerciseOptions, setTriSetExerciseOptions] = useState([]);
  const [showTriSetForm, setShowTriSetForm] = useState(false);
  const [triSetForm, setTriSetForm] = useState({ focus: 'Mixed', concept: '', name: '', exerciseIds: ['', '', ''] });
  const [openTriSetSlot, setOpenTriSetSlot] = useState(null);
  const [triSetSlotSearch, setTriSetSlotSearch] = useState('');
  const [triSetNewExerciseName, setTriSetNewExerciseName] = useState('');
  const [triSetCreatingExercise, setTriSetCreatingExercise] = useState(false);
  const triSetDropdownRef = useRef(null);
  const [labSection, setLabSection] = useState('exercises'); // 'exercises' | 'trisets'
  const [triSetDayFilter, setTriSetDayFilter] = useState('Mixed'); // 'Mixed' = Monday, 'Lower' = Saturday
  const [triSetsSectionOpen, setTriSetsSectionOpen] = useState(false);
  const [exercisesSectionOpen, setExercisesSectionOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (triSetDropdownRef.current && !triSetDropdownRef.current.contains(e.target)) {
        setOpenTriSetSlot(null);
        setTriSetSlotSearch('');
      }
    };
    if (openTriSetSlot !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    } else {
      setTriSetSlotSearch('');
    }
  }, [openTriSetSlot]);

  useEffect(() => {
    loadExercises();
  }, []);

  useEffect(() => {
    const onExercisesUpdated = () => loadExercises();
    window.addEventListener('exercises-updated', onExercisesUpdated);
    return () => window.removeEventListener('exercises-updated', onExercisesUpdated);
  }, []);

  const loadTriSets = async () => {
    try {
      const res = await api.get('/trisets');
      const data = res.data;
      setTriSets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Exercise Lab: could not load tri-sets', err?.response?.status, err?.response?.data);
      setTriSets([]);
    }
  };

  useEffect(() => {
    loadTriSets();
  }, []);

  const loadTriSetExercises = async () => {
    const dayOfWeek = triSetForm.focus === 'Mixed' ? 'Monday' : 'Saturday';
    try {
      const res = await api.get(`/exercises/station1-for-day?dayOfWeek=${dayOfWeek}`);
      setTriSetExerciseOptions(res.data || []);
    } catch {
      setTriSetExerciseOptions([]);
    }
  };

  useEffect(() => {
    if (showTriSetForm) loadTriSetExercises();
  }, [showTriSetForm, triSetForm.focus]);

  const renderTriSetItem = (ts) => {
    const conceptStr = (ts.concept || ts.name || '').trim();
    const weekMatch = conceptStr.match(/Week\s*(\d+)/i);
    const weekLabel = weekMatch ? `Week ${weekMatch[1]}` : (conceptStr || 'Tri-set');
    const phase1Raw = ts.exerciseIds && ts.exerciseIds.length === 3 ? ts.exerciseIds : [];
    const phase1Names = [0, 1, 2].map((i) => {
      const ex = phase1Raw[i];
      return (typeof ex === 'object' && ex && ex.name != null) ? String(ex.name).trim() || '—' : '—';
    });
    const phase2Raw = ts.phase2ExerciseIds && ts.phase2ExerciseIds.length === 3 ? ts.phase2ExerciseIds : [];
    const phase2Names = [0, 1, 2].map((i) => {
      const ex = phase2Raw[i];
      return (typeof ex === 'object' && ex && ex.name != null) ? String(ex.name).trim() || '—' : '—';
    });
    const hasPhase2 = phase2Raw.length === 3;
    return (
      <li key={ts._id} className="triset-list-item triset-list-item-dropdown-style">
        <div className="triset-list-item-header">
          <strong className="triset-option-week">{weekLabel}</strong>
          <span className="triset-list-item-tag">{(ts.focus || '').toLowerCase()}</span>
        </div>
        <ol className="triset-list-exercises" aria-label="Phase 1">
          <li>A. {phase1Names[0]}</li>
          <li>B. {phase1Names[1]}</li>
          <li>C. {phase1Names[2]}</li>
        </ol>
        {hasPhase2 && (
          <>
            <div className="triset-list-phase-label">Phase 2</div>
            <ol className="triset-list-exercises" aria-label="Phase 2">
              <li>A. {phase2Names[0]}</li>
              <li>B. {phase2Names[1]}</li>
              <li>C. {phase2Names[2]}</li>
            </ol>
          </>
        )}
      </li>
    );
  };

  const loadExercises = async () => {
    setLoading(true);
    try {
      const response = await api.get('/exercises');
      setExercises(response.data);
    } catch (error) {
      console.error('Error loading exercises:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/exercises', formData);
      setShowForm(false);
      setFormData({
        name: '',
        station: 1,
        focus: 'Upper',
        dayType: 'Kickboxing',
        isStatic: false,
        staticCondition: null
      });
      loadExercises();
    } catch (error) {
      alert(error.response?.data?.error || 'Error creating exercise');
    }
  };

  const handleEditStart = (ex) => {
    setEditingId(ex._id);
    setEditFormData({
      name: ex.name || '',
      station: ex.station ?? 1,
      focus: ex.focus || 'Upper',
      dayType: ex.dayType || 'Kickboxing',
      isStatic: !!ex.isStatic,
      staticCondition: ex.staticCondition || null
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditFormData(null);
  };

  const handleEditSubmit = async (e, id) => {
    e.preventDefault();
    if (!editFormData) return;
    if (!confirm('Save changes to this exercise?')) return;
    const focusVal = editFormData.station === 1 ? (editFormData.focus || 'Upper') : null;
    try {
      await api.put(`/exercises/${id}`, {
        name: editFormData.name.trim(),
        station: editFormData.station,
        focus: focusVal,
        dayType: editFormData.dayType,
        isStatic: editFormData.isStatic,
        staticCondition: editFormData.staticCondition || null
      });
      setEditingId(null);
      setEditFormData(null);
      loadExercises();
    } catch (error) {
      alert(error.response?.data?.error || 'Error updating exercise');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this exercise? This cannot be undone.')) return;
    try {
      await api.delete(`/exercises/${id}`);
      loadExercises();
    } catch (error) {
      alert(error.response?.data?.error || 'Error deleting exercise');
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!bulkInput.trim()) {
      alert('Please enter at least one exercise name');
      return;
    }

    const exerciseNames = bulkInput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (exerciseNames.length === 0) {
      alert('Please enter at least one exercise name');
      return;
    }

    try {
      // Create all exercises with the same form data settings
      const promises = exerciseNames.map(name => 
        api.post('/exercises', {
          name,
          station: formData.station,
          focus: formData.focus,
          dayType: formData.dayType,
          isStatic: formData.isStatic,
          staticCondition: formData.staticCondition
        })
      );

      await Promise.all(promises);
      setBulkInput('');
      setShowBulkForm(false);
      loadExercises();
      alert(`Successfully added ${exerciseNames.length} exercise(s)!`);
    } catch (error) {
      alert(error.response?.data?.error || 'Error creating exercises');
    }
  };

  const filteredByFilters = exercises.filter(ex => {
    if (filters.station !== 'all' && ex.station !== parseInt(filters.station)) return false;
    if ((filters.station === 'all' || filters.station === '1') && filters.focus !== 'all' && ex.focus !== filters.focus) return false;
    if (filters.dayType !== 'all' && ex.dayType !== filters.dayType) return false;
    return true;
  });

  // Normalize name for dedupe: trim, lowercase, treat singular/plural same (e.g. "flutter kick" vs "flutter kicks")
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

  // Deduplicate by normalized name so each exercise appears once in the list
  const seenNames = new Set();
  const filteredExercises = filteredByFilters.filter(ex => {
    const key = normalizeNameForDedupe(ex.name);
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  const justRegistered = sessionStorage.getItem('justRegistered') === 'true';
  const showWelcome = justRegistered && !loading && exercises.length === 0;

  const triSetExerciseOptionsSorted = [...triSetExerciseOptions].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const handleCreateTriSetExercise = async (slotIdx, name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    setTriSetCreatingExercise(true);
    try {
      const res = await api.post('/exercises', {
        name: trimmed,
        station: 1,
        dayType: 'Technique',
        focus: triSetForm.focus
      });
      const newEx = res.data;
      const next = [...triSetForm.exerciseIds];
      next[slotIdx] = newEx._id;
      setTriSetForm((prev) => ({ ...prev, exerciseIds: next }));
      setTriSetExerciseOptions((prev) => [...prev, newEx]);
      setTriSetNewExerciseName('');
      setOpenTriSetSlot(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create exercise');
    } finally {
      setTriSetCreatingExercise(false);
    }
  };

  const handleTriSetSubmit = async (e) => {
    e.preventDefault();
    const ids = triSetForm.exerciseIds.filter(Boolean);
    if (ids.length !== 3) {
      alert('Select exactly 3 exercises (A, B, C).');
      return;
    }
    try {
      await api.post('/trisets', { focus: triSetForm.focus, concept: triSetForm.concept.trim() || undefined, name: triSetForm.name.trim() || undefined, exerciseIds: ids });
      setShowTriSetForm(false);
      setTriSetForm({ focus: 'Mixed', concept: '', name: '', exerciseIds: ['', '', ''] });
      loadTriSets();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create tri-set');
    }
  };

  return (
    <div className="exercise-manager">
      {showWelcome && (
        <div className="welcome-message">
          <h2>Welcome to SOULBOX! 👋</h2>
          <p>To get started, you'll need to add exercises to your library. You can add them one at a time or use bulk input to add multiple exercises at once.</p>
          <p><strong>Tip:</strong> Add exercises with Station, Focus, and Day Type — they appear in the dropdown when editing each day/section on the Calendar.</p>
        </div>
      )}

      <div className="manager-header">
        <h2>Exercise Lab</h2>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => setShowBulkForm(!showBulkForm)}>
            {showBulkForm ? 'Cancel Bulk' : 'Bulk Add'}
          </button>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Exercise'}
          </button>
        </div>
      </div>

      <div className="trisets-section collapsible-section">
        <button
          type="button"
          className="collapsible-section-header"
          onClick={() => setTriSetsSectionOpen((v) => !v)}
          aria-expanded={triSetsSectionOpen}
        >
          <span className="collapsible-section-title">Station 1 Tri-sets (Monday & Saturday)</span>
          <span className="collapsible-section-meta">{triSets.length} tri-sets</span>
          <span className="collapsible-section-chevron">{triSetsSectionOpen ? '▼' : '▶'}</span>
        </button>
        {triSetsSectionOpen && (
        <>
        <p className="form-help">Exercises shown are <strong>only from that day&apos;s Station 1 on the grid</strong> (Monday or Saturday). All 3 must share a concept and progress in sequence: <strong>A</strong> (simplest) → <strong>B</strong> → <strong>C</strong>.</p>
        <button type="button" className="btn-secondary" onClick={() => { setShowTriSetForm(!showTriSetForm); if (!showTriSetForm) { loadTriSets(); setTriSetForm((prev) => ({ ...prev, focus: triSetDayFilter })); } }}>
          {showTriSetForm ? 'Cancel' : '+ Add tri-set'}
        </button>
        {showTriSetForm && (
          <form className="exercise-form triset-form" onSubmit={handleTriSetSubmit}>
            <div className="triset-form-header">
              <h4 className="triset-form-title">Add {triSetForm.focus === 'Mixed' ? 'Monday' : 'Saturday'} tri-set</h4>
              <div className="form-group">
                <label>Day</label>
                <select value={triSetForm.focus} onChange={(e) => setTriSetForm({ ...triSetForm, focus: e.target.value })}>
                  <option value="Mixed">Monday (Station 1 from Monday grid)</option>
                  <option value="Lower">Saturday (Station 1 from Saturday grid)</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Concept <span className="label-hint">(e.g. Week 207: 1/ SWITCH/3 — shown as label in list)</span></label>
              <input type="text" value={triSetForm.concept} onChange={(e) => setTriSetForm({ ...triSetForm, concept: e.target.value })} placeholder="e.g. Week 207: 1/ SWITCH/3" required />
            </div>
            <div className="form-group">
              <label>Name (optional)</label>
              <input type="text" value={triSetForm.name} onChange={(e) => setTriSetForm({ ...triSetForm, name: e.target.value })} placeholder="e.g. 1/SLIP L series" />
            </div>
            <div className="triset-form-slots" ref={triSetDropdownRef}>
              <p className="form-help triset-form-slots-intro">Select 3 exercises in order: A (simplest) → B → C (same structure as list below)</p>
              {['A', 'B', 'C'].map((slot, idx) => {
                const selectedId = triSetForm.exerciseIds[idx] || '';
                const selectedEx = triSetExerciseOptionsSorted.find((e) => e._id === selectedId);
                return (
                  <div key={slot} className="form-group triset-slot-row">
                    <label>{(slot === 'A' ? 'A. (simplest)' : slot === 'B' ? 'B.' : 'C. (most complex)')}</label>
                    <div className="exercise-select-wrap" style={{ position: 'relative' }}>
                      <div
                        className={`editable-exercise-select editable-exercise-select-trigger ${openTriSetSlot === idx ? 'open' : ''}`}
                        onClick={() => setOpenTriSetSlot(openTriSetSlot === idx ? null : idx)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenTriSetSlot(openTriSetSlot === idx ? null : idx); } }}
                      >
                        {selectedEx ? selectedEx.name : (triSetExerciseOptionsSorted.length === 0 ? 'No exercises for this day yet…' : 'Select exercise')}
                      </div>
                      {openTriSetSlot === idx && (
                        <ul className="editable-exercise-dropdown" role="listbox">
                          <li className="editable-exercise-dropdown-search-wrap">
                            <input
                              type="text"
                              className="editable-exercise-dropdown-search"
                              placeholder="Search exercises…"
                              value={triSetSlotSearch}
                              onChange={(e) => setTriSetSlotSearch(e.target.value)}
                              onKeyDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Filter exercises"
                            />
                          </li>
                          <li className="triset-create-new-wrap">
                            <div className="triset-create-new-row">
                              <input
                                type="text"
                                className="triset-create-new-input"
                                placeholder="Or type new exercise name…"
                                value={triSetNewExerciseName}
                                onChange={(e) => setTriSetNewExerciseName(e.target.value)}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCreateTriSetExercise(idx, triSetNewExerciseName);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                disabled={triSetCreatingExercise}
                                aria-label="New exercise name"
                              />
                              <button
                                type="button"
                                className="btn-primary triset-create-new-btn"
                                onClick={(e) => { e.stopPropagation(); handleCreateTriSetExercise(idx, triSetNewExerciseName); }}
                                disabled={triSetCreatingExercise || !triSetNewExerciseName.trim()}
                              >
                                {triSetCreatingExercise ? 'Adding…' : 'Add new'}
                              </button>
                            </div>
                          </li>
                          <li>
                            <button type="button" className="editable-exercise-option empty" onClick={() => { setTriSetForm({ ...triSetForm, exerciseIds: triSetForm.exerciseIds.map((id, i) => (i === idx ? '' : id)) }); setOpenTriSetSlot(null); }}>
                              {triSetExerciseOptionsSorted.length === 0 ? 'Clear selection' : 'Clear selection'}
                            </button>
                          </li>
                          {(() => {
                            const q = (triSetSlotSearch || '').trim().toLowerCase().replace(/^[.\/]+/, '');
                            const filtered = q
                              ? triSetExerciseOptionsSorted.filter((e) => (e.name || '').toLowerCase().startsWith(q))
                              : triSetExerciseOptionsSorted;
                            return (
                              <>
                                {filtered.map((ex) => (
                                  <li key={ex._id}>
                                    <button
                                      type="button"
                                      className="editable-exercise-option"
                                      onClick={() => {
                                        const next = [...triSetForm.exerciseIds];
                                        next[idx] = ex._id;
                                        setTriSetForm({ ...triSetForm, exerciseIds: next });
                                        setOpenTriSetSlot(null);
                                        setTriSetSlotSearch('');
                                      }}
                                    >
                                      {ex.name}
                                    </button>
                                  </li>
                                ))}
                                {filtered.length === 0 && q && (
                                  <li className="editable-exercise-option empty">No matches</li>
                                )}
                              </>
                            );
                          })()}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button type="submit" className="btn-primary">Create tri-set</button>
          </form>
        )}
        <div className="triset-day-buttons">
          <button
            type="button"
            className={`triset-day-btn ${triSetDayFilter === 'Mixed' ? 'active' : ''}`}
            onClick={() => setTriSetDayFilter('Mixed')}
          >
            Tri-set Monday
          </button>
          <button
            type="button"
            className={`triset-day-btn ${triSetDayFilter === 'Lower' ? 'active' : ''}`}
            onClick={() => setTriSetDayFilter('Lower')}
          >
            Tri-set Saturday
          </button>
        </div>
        <div className="triset-folder">
          <div className="triset-folder-content">
            <button
              type="button"
              className="btn-primary triset-add-in-folder"
              onClick={() => {
                setTriSetForm((prev) => ({ ...prev, focus: triSetDayFilter }));
                setShowTriSetForm(true);
                loadTriSets();
              }}
            >
              + Add {triSetDayFilter === 'Mixed' ? 'Monday' : 'Saturday'} tri-set
            </button>
            {triSets.filter((ts) => ts.focus === triSetDayFilter).length > 0 ? (
              <div className="triset-list" data-triset-list="v2">
                <p className="triset-list-count">
                  {triSetDayFilter === 'Mixed' ? 'Monday' : 'Saturday'} tri-sets: {triSets.filter((ts) => ts.focus === triSetDayFilter).length}
                </p>
                <ul className="triset-list-ul">
                  {triSets.filter((ts) => ts.focus === triSetDayFilter).map((ts) => renderTriSetItem(ts))}
                </ul>
              </div>
            ) : (
              <p className="form-help">
                No {triSetDayFilter === 'Mixed' ? 'Monday' : 'Saturday'} tri-sets yet. Add one using the button above.
              </p>
            )}
          </div>
        </div>
        </>
        )}
      </div>

      {showBulkForm && (
        <form className="exercise-form bulk-form" onSubmit={handleBulkSubmit}>
          <h3>Bulk Add Exercises</h3>
          <p className="form-help">Enter one exercise name per line. All exercises will use the same settings below.</p>
          
          <div className="form-group">
            <label>Exercise Names (one per line)</label>
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="Shoulder Press&#10;Frontal Raises&#10;Infinity Circles&#10;Lateral Raises"
              rows={8}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Station</label>
              <select
                value={formData.station}
                onChange={(e) => setFormData({ ...formData, station: parseInt(e.target.value) })}
              >
                <option value={1}>Station 1</option>
                <option value={2}>Station 2</option>
                <option value={3}>Station 3</option>
              </select>
            </div>
            {formData.station === 1 && (
              <div className="form-group">
                <label>Focus</label>
                <select
                  value={formData.focus}
                  onChange={(e) => setFormData({ ...formData, focus: e.target.value })}
                >
                  <option value="Upper">Upper Body</option>
                  <option value="Lower">Lower Body</option>
                  <option value="Mixed">Mixed</option>
                  <option value="Full Body">Full Body</option>
                  <option value="Cardio">Cardio</option>
                  <option value="Abs">Abs</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Day Type</label>
              <select
                value={formData.dayType}
                onChange={(e) => setFormData({ ...formData, dayType: e.target.value })}
              >
                <option value="Kickboxing">Kickboxing</option>
                <option value="Boxing">Boxing</option>
                <option value="Technique">Technique</option>
                <option value="Conditioning">Conditioning</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.isStatic}
                onChange={(e) => setFormData({ ...formData, isStatic: e.target.checked })}
              />
              Static Exercise (e.g., Non-stop Sparring)
            </label>
          </div>

          {formData.isStatic && formData.station === 3 && (
            <div className="form-group">
              <label>Static Condition</label>
              <select
                value={formData.staticCondition || ''}
                onChange={(e) => setFormData({ ...formData, staticCondition: e.target.value || null })}
              >
                <option value="">None</option>
                <option value="kickboxing-station3-b">Kickboxing - Station 3 B</option>
                <option value="boxing-station3-b">Boxing - Station 3 B</option>
              </select>
            </div>
          )}

          <button type="submit" className="btn-primary">Add All Exercises</button>
        </form>
      )}

      {showForm && (
        <form className="exercise-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Exercise Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Station</label>
              <select
                value={formData.station}
                onChange={(e) => setFormData({ ...formData, station: parseInt(e.target.value) })}
              >
                <option value={1}>Station 1</option>
                <option value={2}>Station 2</option>
                <option value={3}>Station 3</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            {formData.station === 1 && (
              <div className="form-group">
                <label>Focus</label>
                <select
                  value={formData.focus}
                  onChange={(e) => setFormData({ ...formData, focus: e.target.value })}
                >
                  <option value="Upper">Upper Body</option>
                  <option value="Lower">Lower Body</option>
                  <option value="Mixed">Mixed</option>
                  <option value="Full Body">Full Body</option>
                  <option value="Cardio">Cardio</option>
                  <option value="Abs">Abs</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Day Type</label>
              <select
                value={formData.dayType}
                onChange={(e) => setFormData({ ...formData, dayType: e.target.value })}
              >
                <option value="Kickboxing">Kickboxing</option>
                <option value="Boxing">Boxing</option>
                <option value="Technique">Technique</option>
                <option value="Conditioning">Conditioning</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.isStatic}
                onChange={(e) => setFormData({ ...formData, isStatic: e.target.checked })}
              />
              Static Exercise (e.g., Non-stop Sparring)
            </label>
          </div>

          {formData.isStatic && formData.station === 3 && (
            <div className="form-group">
              <label>Static Condition</label>
              <select
                value={formData.staticCondition || ''}
                onChange={(e) => setFormData({ ...formData, staticCondition: e.target.value || null })}
              >
                <option value="">None</option>
                <option value="kickboxing-station3-b">Kickboxing - Station 3 B</option>
                <option value="boxing-station3-b">Boxing - Station 3 B</option>
              </select>
            </div>
          )}

          <button type="submit" className="btn-primary">Add Exercise</button>
        </form>
      )}

      <div className="exercises-section collapsible-section">
        <button
          type="button"
          className="collapsible-section-header"
          onClick={() => setExercisesSectionOpen((v) => !v)}
          aria-expanded={exercisesSectionOpen}
        >
          <span className="collapsible-section-title">Exercises</span>
          <span className="collapsible-section-meta">{filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''}</span>
          <span className="collapsible-section-chevron">{exercisesSectionOpen ? '▼' : '▶'}</span>
        </button>
        {exercisesSectionOpen && (
        <>
      <div className="filters">
        <select
          value={filters.station}
          onChange={(e) => setFilters({ ...filters, station: e.target.value })}
        >
          <option value="all">All Stations</option>
          <option value="1">Station 1</option>
          <option value="2">Station 2</option>
          <option value="3">Station 3</option>
        </select>
        {(filters.station === 'all' || filters.station === '1') && (
          <select
            value={filters.focus}
            onChange={(e) => setFilters({ ...filters, focus: e.target.value })}
          >
            <option value="all">All Focus</option>
            <option value="Upper">Upper Body</option>
            <option value="Lower">Lower Body</option>
            <option value="Mixed">Mixed</option>
            <option value="Full Body">Full Body</option>
            <option value="Cardio">Cardio</option>
            <option value="Abs">Abs</option>
          </select>
        )}
        <select
          value={filters.dayType}
          onChange={(e) => setFilters({ ...filters, dayType: e.target.value })}
        >
          <option value="all">All Types</option>
          <option value="Kickboxing">Kickboxing</option>
          <option value="Boxing">Boxing</option>
          <option value="Technique">Technique</option>
          <option value="Conditioning">Conditioning</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading exercises...</div>
      ) : (
        <div className="exercise-list">
          {filteredExercises.length === 0 ? (
            <div className="empty-state">
              <p>No exercises found. Add exercises in the Exercise Lab — they appear in dropdowns when editing workouts.</p>
              <p className="empty-hint">Add exercises here — they appear in the dropdown when editing workouts on the Calendar.</p>
            </div>
          ) : (
            <>
              <div className="exercise-stats">
                <p>Total: {filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''}</p>
              </div>
              {filteredExercises.map(ex => (
                <div key={ex._id} className="exercise-item">
                  {editingId === ex._id && editFormData ? (
                    <form
                      className="exercise-form exercise-edit-form"
                      onSubmit={(e) => handleEditSubmit(e, ex._id)}
                    >
                      <div className="form-row">
                        <div className="form-group">
                          <label>Exercise Name</label>
                          <input
                            type="text"
                            value={editFormData.name}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Station</label>
                          <select
                            value={editFormData.station}
                            onChange={(e) => setEditFormData({ ...editFormData, station: parseInt(e.target.value) })}
                          >
                            <option value={1}>Station 1</option>
                            <option value={2}>Station 2</option>
                            <option value={3}>Station 3</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-row">
                        {editFormData.station === 1 && (
                          <div className="form-group">
                            <label>Focus</label>
                            <select
                              value={editFormData.focus || 'Upper'}
                              onChange={(e) => setEditFormData({ ...editFormData, focus: e.target.value })}
                            >
                              <option value="Upper">Upper Body</option>
                              <option value="Lower">Lower Body</option>
                              <option value="Mixed">Mixed</option>
                              <option value="Full Body">Full Body</option>
                              <option value="Cardio">Cardio</option>
                              <option value="Abs">Abs</option>
                            </select>
                          </div>
                        )}
                        <div className="form-group">
                          <label>Day Type</label>
                          <select
                            value={editFormData.dayType}
                            onChange={(e) => setEditFormData({ ...editFormData, dayType: e.target.value })}
                          >
                            <option value="Kickboxing">Kickboxing</option>
                            <option value="Boxing">Boxing</option>
                            <option value="Technique">Technique</option>
                            <option value="Conditioning">Conditioning</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>
                          <input
                            type="checkbox"
                            checked={editFormData.isStatic}
                            onChange={(e) => setEditFormData({ ...editFormData, isStatic: e.target.checked })}
                          />
                          Static Exercise (e.g., Non-stop Sparring)
                        </label>
                      </div>
                      {editFormData.isStatic && editFormData.station === 3 && (
                        <div className="form-group">
                          <label>Static Condition</label>
                          <select
                            value={editFormData.staticCondition || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, staticCondition: e.target.value || null })}
                          >
                            <option value="">None</option>
                            <option value="kickboxing-station3-b">Kickboxing - Station 3 B</option>
                            <option value="boxing-station3-b">Boxing - Station 3 B</option>
                          </select>
                        </div>
                      )}
                      <div className="exercise-edit-actions">
                        <button type="button" className="btn-secondary" onClick={handleEditCancel}>
                          Cancel
                        </button>
                        <button type="submit" className="btn-primary">Save changes</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="exercise-info">
                        <h4>{ex.name}</h4>
                        <div className="exercise-tags">
                          <span className="tag">Station {ex.station}</span>
                          {ex.station === 1 && ex.focus && <span className="tag">{ex.focus}</span>}
                          <span className="tag">{ex.dayType}</span>
                          {ex.isStatic && <span className="tag static">Static</span>}
                        </div>
                        {ex.updatedAt && (
                          <div className="exercise-last-saved">
                            Last saved: {new Date(ex.updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </div>
                        )}
                      </div>
                      <div className="exercise-item-actions">
                        <button
                          type="button"
                          className="btn-secondary btn-small"
                          onClick={() => handleEditStart(ex)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-danger btn-small"
                          onClick={() => handleDelete(ex._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
        </>
        )}
      </div>
    </div>
  );
};

export default ExerciseManager;
