import { useState, useMemo } from 'react';
import api from '../utils/api';

const FOCUS_OPTIONS = [
  { value: 'Upper', label: 'Upper' },
  { value: 'Lower', label: 'Lower' },
  { value: 'Mixed', label: 'Mixed' },
  { value: 'Full Body', label: 'Full Body' },
  { value: 'Cardio', label: 'Cardio' },
  { value: 'Abs', label: 'Abs' }
];

export default function ExerciseFocusBulk({ exercises, onRefresh, loading }) {
  const [search, setSearch] = useState('');
  const [focusFilter, setFocusFilter] = useState('all');
  const [selected, setSelected] = useState(() => new Set());
  const [assignFocus, setAssignFocus] = useState('Abs');
  const [applying, setApplying] = useState(false);

  const station1List = useMemo(
    () => exercises.filter((ex) => Number(ex.station) === 1),
    [exercises]
  );

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return station1List.filter((ex) => {
      if (q && !(String(ex.name || '').toLowerCase().includes(q))) return false;
      if (focusFilter === 'all') return true;
      if (focusFilter === 'unset') {
        return ex.focus == null || String(ex.focus).trim() === '';
      }
      return ex.focus === focusFilter;
    });
  }, [station1List, search, focusFilter]);

  const toggle = (id) => {
    const key = String(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected(new Set(filtered.map((e) => String(e._id))));
  };

  const clearSelection = () => setSelected(new Set());

  const applyBulk = async () => {
    const ids = [...selected];
    if (ids.length === 0) {
      window.alert('Select at least one exercise.');
      return;
    }
    const focusLabel =
      assignFocus === '__clear__' ? 'clear focus (unset)' : `set focus to “${assignFocus}”`;
    if (!window.confirm(`Apply to ${ids.length} exercise(s): ${focusLabel}?`)) return;
    setApplying(true);
    try {
      const body =
        assignFocus === '__clear__'
          ? { exerciseIds: ids, focus: null }
          : { exerciseIds: ids, focus: assignFocus };
      const res = await api.patch('/exercises/bulk-focus', body);
      const { modifiedCount, skippedNonStation1, notFound } = res.data;
      let msg = `Updated ${modifiedCount} exercise(s).`;
      if (skippedNonStation1) msg += ` Skipped (not Station 1): ${skippedNonStation1}.`;
      if (notFound) msg += ` Not found / invalid id: ${notFound}.`;
      window.alert(msg);
      clearSelection();
      onRefresh?.();
    } catch (err) {
      window.alert(err.response?.data?.error || 'Bulk update failed');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="focus-bulk-panel">
      <p className="form-help focus-bulk-intro">
        Focus applies to <strong>Station 1</strong> only (Upper, Lower, Mixed, Full Body, Cardio, Abs).
        Filter the list, tick exercises, choose a focus, then apply — or use <strong>Select all visible</strong> after
        filtering (e.g. show only Abs, then reassign).
      </p>

      <div className="focus-bulk-toolbar">
        <div className="form-group focus-bulk-search">
          <label htmlFor="focus-bulk-search">Search name</label>
          <input
            id="focus-bulk-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name…"
            autoComplete="off"
          />
        </div>
        <div className="form-group">
          <label htmlFor="focus-bulk-filter">Show focus</label>
          <select
            id="focus-bulk-filter"
            value={focusFilter}
            onChange={(e) => setFocusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="unset">None / unset</option>
            {FOCUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="focus-bulk-assign">Assign to selected</label>
          <select
            id="focus-bulk-assign"
            value={assignFocus}
            onChange={(e) => setAssignFocus(e.target.value)}
          >
            {FOCUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            <option value="__clear__">Clear focus (unset)</option>
          </select>
        </div>
      </div>

      <div className="focus-bulk-actions">
        <button type="button" className="btn-secondary btn-small" onClick={selectAllVisible} disabled={loading || filtered.length === 0}>
          Select all visible ({filtered.length})
        </button>
        <button type="button" className="btn-secondary btn-small" onClick={clearSelection} disabled={selected.size === 0}>
          Clear selection
        </button>
        <button type="button" className="btn-primary btn-small" onClick={applyBulk} disabled={applying || selected.size === 0}>
          {applying ? 'Applying…' : `Apply to ${selected.size} selected`}
        </button>
      </div>

      {loading ? (
        <p className="focus-bulk-loading">Loading…</p>
      ) : station1List.length === 0 ? (
        <p className="form-help">No Station 1 exercises yet. Add some in the list below.</p>
      ) : (
        <div className="focus-bulk-table-wrap">
          <table className="focus-bulk-table">
            <thead>
              <tr>
                <th scope="col" className="focus-bulk-col-check" />
                <th scope="col">Exercise</th>
                <th scope="col">Current focus</th>
                <th scope="col">Day type</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ex) => {
                const id = String(ex._id);
                const checked = selected.has(id);
                return (
                  <tr key={id} className={checked ? 'focus-bulk-row-selected' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(ex._id)}
                        aria-label={`Select ${ex.name}`}
                      />
                    </td>
                    <td className="focus-bulk-name">{ex.name || '—'}</td>
                    <td>{ex.focus || '—'}</td>
                    <td>{ex.dayType || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="form-help focus-bulk-empty">No exercises match this filter.</p>
          )}
        </div>
      )}
    </div>
  );
}
