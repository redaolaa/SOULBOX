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
  const [triSets, setTriSets] = useState([]);
  const [triSetExerciseOptions, setTriSetExerciseOptions] = useState([]);
  const [showTriSetForm, setShowTriSetForm] = useState(false);
  const [triSetForm, setTriSetForm] = useState({ focus: 'Mixed', concept: '', name: '', exerciseIds: ['', '', ''] });
  const [openTriSetSlot, setOpenTriSetSlot] = useState(null);
  const triSetDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (triSetDropdownRef.current && !triSetDropdownRef.current.contains(e.target)) setOpenTriSetSlot(null);
    };
    if (openTriSetSlot !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openTriSetSlot]);

  useEffect(() => {
    loadExercises();
  }, []);

  const loadTriSets = async () => {
    try {
      const res = await api.get('/trisets');
      setTriSets(res.data || []);
    } catch {
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

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this exercise?')) return;
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
    if (filters.focus !== 'all' && ex.focus !== filters.focus) return false;
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

      <div className="trisets-section">
        <h3>Station 1 Tri-sets (Monday & Saturday)</h3>
        <p className="form-help">Exercises shown are <strong>only from that day&apos;s Station 1 on the grid</strong> (Monday or Saturday). All 3 must share a concept and progress in sequence: <strong>A</strong> (simplest) → <strong>B</strong> → <strong>C</strong>.</p>
        <button type="button" className="btn-secondary" onClick={() => { setShowTriSetForm(!showTriSetForm); if (!showTriSetForm) loadTriSets(); }}>
          {showTriSetForm ? 'Cancel' : '+ Add tri-set'}
        </button>
        {showTriSetForm && (
          <form className="exercise-form triset-form" onSubmit={handleTriSetSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Day</label>
                <select value={triSetForm.focus} onChange={(e) => setTriSetForm({ ...triSetForm, focus: e.target.value })}>
                  <option value="Mixed">Monday (Station 1 from Monday grid)</option>
                  <option value="Lower">Saturday (Station 1 from Saturday grid)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Concept <span className="label-hint">(what ties the 3 together)</span></label>
                <input type="text" value={triSetForm.concept} onChange={(e) => setTriSetForm({ ...triSetForm, concept: e.target.value })} placeholder="e.g. SLIP L progression" required />
              </div>
              <div className="form-group">
                <label>Name (optional)</label>
                <input type="text" value={triSetForm.name} onChange={(e) => setTriSetForm({ ...triSetForm, name: e.target.value })} placeholder="e.g. 1/SLIP L series" />
              </div>
            </div>
            <div className="form-row" ref={triSetDropdownRef}>
              {['A', 'B', 'C'].map((slot, idx) => {
                const selectedId = triSetForm.exerciseIds[idx] || '';
                const selectedEx = triSetExerciseOptionsSorted.find((e) => e._id === selectedId);
                return (
                  <div key={slot} className="form-group">
                    <label>Slot {slot} {idx === 0 ? '(simplest)' : idx === 1 ? '(adds)' : '(most complex)'}</label>
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
                          <li>
                            <button type="button" className="editable-exercise-option empty" onClick={() => { setTriSetForm({ ...triSetForm, exerciseIds: triSetForm.exerciseIds.map((id, i) => (i === idx ? '' : id)) }); setOpenTriSetSlot(null); }}>
                              {triSetExerciseOptionsSorted.length === 0 ? 'No exercises for this day yet — add Monday/Saturday Station 1 on the Calendar first' : 'Select exercise'}
                            </button>
                          </li>
                          {triSetExerciseOptionsSorted.map((ex) => (
                            <li key={ex._id}>
                              <button
                                type="button"
                                className="editable-exercise-option"
                                onClick={() => {
                                  const next = [...triSetForm.exerciseIds];
                                  next[idx] = ex._id;
                                  setTriSetForm({ ...triSetForm, exerciseIds: next });
                                  setOpenTriSetSlot(null);
                                }}
                              >
                                {ex.name}
                              </button>
                            </li>
                          ))}
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
        {triSets.length > 0 && (
          <div className="triset-list">
            <p>Tri-sets: {triSets.length}</p>
            <ul>
              {triSets.map((ts) => (
                <li key={ts._id}>
                  {ts.concept || ts.name || (ts.exerciseIds && ts.exerciseIds.map((ex) => (typeof ex === 'object' ? ex.name : ex)).filter(Boolean).join(' → '))} <span className="tag">{(ts.focus || '').toLowerCase()}</span>
                </li>
              ))}
            </ul>
          </div>
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
              </select>
            </div>
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
              </select>
            </div>
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
        <select
          value={filters.focus}
          onChange={(e) => setFilters({ ...filters, focus: e.target.value })}
        >
          <option value="all">All Focus</option>
          <option value="Upper">Upper Body</option>
          <option value="Lower">Lower Body</option>
          <option value="Mixed">Mixed</option>
          <option value="Full Body">Full Body</option>
        </select>
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
                  <div className="exercise-info">
                    <h4>{ex.name}</h4>
                    <div className="exercise-tags">
                      <span className="tag">Station {ex.station}</span>
                      <span className="tag">{ex.focus}</span>
                      <span className="tag">{ex.dayType}</span>
                      {ex.isStatic && <span className="tag static">Static</span>}
                    </div>
                  </div>
                  <button
                    className="btn-danger btn-small"
                    onClick={() => handleDelete(ex._id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ExerciseManager;
