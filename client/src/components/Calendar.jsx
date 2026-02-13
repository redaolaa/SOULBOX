import { useState, useEffect } from 'react';
import api from '../utils/api';
import { getWorkoutId } from '../utils/workoutId';
import WorkoutView from './WorkoutView';
import EditableExerciseSlot from './EditableExerciseSlot';
import MondayStation1Selector from './MondayStation1Selector';
import SaturdayStation1Selector from './SaturdayStation1Selector';

const DAY_CONFIG = {
  Sunday: { dayType: 'Kickboxing', filter: 'Upper Body' },
  Monday: { dayType: 'Technique', filter: 'Mixed/Full Body' },
  Tuesday: { dayType: 'Boxing', filter: 'Upper Body' },
  Wednesday: { dayType: 'Conditioning', filter: 'Lower Body' },
  Thursday: { dayType: 'Kickboxing', filter: 'Mixed/Full Body' },
  Saturday: { dayType: 'Technique', filter: 'Lower Body' }
};

const DAY_OFFSET = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

const Calendar = () => {
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [monthViewDate, setMonthViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [workouts, setWorkouts] = useState({});
  const [workoutsByDate, setWorkoutsByDate] = useState({}); // for month view: dateStr -> workout
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  const collapseNonstopStation3 = (station3) => {
    const getName = (ex) => String(ex?.name || ex?.exerciseId?.name || '').trim();
    const names = (station3 || []).map(getName).filter(Boolean);
    if (names.length !== 3) return null;
    const normalized = names.map((n) => n.toLowerCase());
    const allSame = normalized.every((n) => n === normalized[0]);
    // Treat \"Non-Stop Sparring\" / \"Nonstop Sparring\" (with or without hyphen/space) as the same
    const normalizeLabel = (n) => n.replace(/[-\s]/g, '');
    const base = normalizeLabel(normalized[0]);
    if (allSame && base.includes('nonstopsparring')) return names[0];
    return null;
  };

  const formatExerciseName = (raw) => {
    if (!raw) return '';
    const str = String(raw).toLowerCase();
    return str.replace(/\b\w/g, (c) => c.toUpperCase());
  };

  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  // Program week number: week beginning Jan 11 2026 = Week 200, count backwards/forwards
  function getProgramWeekNumber(weekStartDate) {
    const anchor = new Date(2026, 0, 11); // Jan 11, 2026 (week beginning = Sunday)
    anchor.setHours(0, 0, 0, 0);
    const ws = new Date(weekStartDate);
    ws.setHours(0, 0, 0, 0);
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    return 200 + Math.round((ws.getTime() - anchor.getTime()) / msPerWeek);
  }

  useEffect(() => {
    loadWorkouts();
  }, [weekStart]);

  // When in month view, load workouts for all weeks overlapping the displayed month
  useEffect(() => {
    if (viewMode !== 'month') return;
    let cancelled = false;
    const year = monthViewDate.getFullYear();
    const month = monthViewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeek = getWeekStart(firstDay);
    const endWeek = getWeekStart(lastDay);
    const weekStarts = [];
    for (let d = new Date(startWeek); d <= endWeek; d.setDate(d.getDate() + 7)) {
      weekStarts.push(new Date(d.getTime()));
    }
    (async () => {
      setLoading(true);
      const byDate = {};
      try {
        const toLocalDateStr = (d) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        for (const ws of weekStarts) {
          const weekStartStr = toLocalDateStr(ws);
          const response = await api.get(`/workouts/week?weekStartDate=${weekStartStr}`);
          response.data.forEach((workout) => {
            const date = new Date(ws);
            date.setDate(date.getDate() + (DAY_OFFSET[workout.dayOfWeek] ?? 0));
            const dateStr = toLocalDateStr(date);
            byDate[dateStr] = workout;
          });
        }
        if (!cancelled) setWorkoutsByDate(byDate);
      } catch (error) {
        if (!cancelled) console.error('Error loading month workouts:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [viewMode, monthViewDate]);

  const loadWorkouts = async () => {
    setLoading(true);
    try {
      const weekStartStr = weekStart.toISOString().split('T')[0];
      const response = await api.get(`/workouts/week?weekStartDate=${weekStartStr}`);
      const workoutsMap = {};
      response.data.forEach(workout => {
        workoutsMap[workout.dayOfWeek] = workout;
      });
      setWorkouts(workoutsMap);
    } catch (error) {
      console.error('Error loading workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateWorkout = async (dayOfWeek) => {
    setLoading(true);
    try {
      const weekStartStr = weekStart.toISOString().split('T')[0];
      const response = await api.post('/workouts/generate', {
        dayOfWeek,
        weekStartDate: weekStartStr
      });
      setWorkouts({ ...workouts, [dayOfWeek]: response.data });
      setSelectedDay(dayOfWeek);
    } catch (error) {
      alert(error.response?.data?.error || 'Error generating workout');
    } finally {
      setLoading(false);
    }
  };

  const generateWeek = async () => {
    if (!confirm('Generate workouts for the entire week? This will create workouts for all days.')) {
      return;
    }
    setLoading(true);
    try {
      const weekStartStr = weekStart.toISOString().split('T')[0];
      const response = await api.post('/workouts/generate-week', {
        weekStartDate: weekStartStr
      });
      const workoutsMap = {};
      response.data.forEach(workout => {
        workoutsMap[workout.dayOfWeek] = workout;
      });
      setWorkouts(workoutsMap);
    } catch (error) {
      alert(error.response?.data?.error || 'Error generating workouts');
    } finally {
      setLoading(false);
    }
  };

  const navigateWeek = (direction) => {
    const newWeekStart = new Date(weekStart);
    newWeekStart.setDate(newWeekStart.getDate() + (direction * 7));
    setWeekStart(newWeekStart);
    setSelectedDay(null);
  };

  const navigateMonth = (direction) => {
    const next = new Date(monthViewDate);
    next.setMonth(next.getMonth() + direction);
    setMonthViewDate(next);
  };

  const goToWeekFromDate = (date) => {
    setWeekStart(getWeekStart(new Date(date)));
    setViewMode('week');
    setSelectedDay(null);
  };

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'];

  const isPastWeek = (() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekStartStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
    return weekStartStart < todayStart;
  })();

  // Month grid: build array of weeks (each week = 7 days, empty cells for padding)
  const monthGrid = (() => {
    if (viewMode !== 'month') return null;
    const year = monthViewDate.getFullYear();
    const month = monthViewDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = first.getDay();
    const daysInMonth = last.getDate();
    const totalCells = startPad + daysInMonth;
    const rows = Math.ceil(totalCells / 7);
    const grid = [];
    let day = 1;
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < 7; c++) {
        const cellIndex = r * 7 + c;
        if (cellIndex < startPad || day > daysInMonth) {
          row.push({ date: null, dateStr: null, workout: null });
        } else {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          row.push({ date: day, dateStr, workout: workoutsByDate[dateStr] ?? null });
          day++;
        }
      }
      grid.push(row);
    }
    return grid;
  })();

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-view-toggle">
          <button
            type="button"
            className={`btn-toggle ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => setViewMode('week')}
          >
            Week
          </button>
          <button
            type="button"
            className={`btn-toggle ${viewMode === 'month' ? 'active' : ''}`}
            onClick={() => setViewMode('month')}
          >
            Month
          </button>
        </div>

        {viewMode === 'week' && (
          <>
            <span className="week-number-label">Week {getProgramWeekNumber(weekStart)}</span>
            <button onClick={() => navigateWeek(-1)} className="btn-secondary">← Previous</button>
            <h2>
              Week of {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </h2>
            <button onClick={() => navigateWeek(1)} className="btn-secondary">Next →</button>
          </>
        )}

        {viewMode === 'month' && (
          <>
            <button onClick={() => navigateMonth(-1)} className="btn-secondary">← Previous</button>
            <h2>
              {monthViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <button onClick={() => navigateMonth(1)} className="btn-secondary">Next →</button>
          </>
        )}
      </div>

      {viewMode === 'week' && !isPastWeek && (
        <div className="week-actions">
          <div className="week-actions-main">
            <button onClick={generateWeek} className="btn-primary btn-generate-week" disabled={loading}>
              {loading ? 'Generating...' : 'Generate Full Week'}
            </button>
            <span className="week-actions-hint">Or generate individual days below</span>
          </div>
        </div>
      )}

      {viewMode === 'month' && (
        <div className="month-calendar">
          <div className="month-weekday-headers">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
              <div key={label} className="month-weekday-header">{label}</div>
            ))}
          </div>
          {loading ? (
            <div className="month-loading">Loading…</div>
          ) : (
            monthGrid?.map((row, ri) => (
              <div key={ri} className="month-row">
                {row.map((cell, ci) => (
                  <div
                    key={ci}
                    className={`month-cell ${cell.date ? 'has-date' : 'empty'} ${cell.workout ? 'has-workout' : ''}`}
                    onClick={() => cell.dateStr && goToWeekFromDate(cell.dateStr)}
                    role={cell.dateStr ? 'button' : undefined}
                    tabIndex={cell.dateStr ? 0 : undefined}
                    onKeyDown={(e) => cell.dateStr && (e.key === 'Enter' || e.key === ' ') && goToWeekFromDate(cell.dateStr)}
                  >
                    {cell.date != null && <span className="month-day-num">{cell.date}</span>}
                    {cell.workout && <span className="month-workout-dot" title="Saved workout" />}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {viewMode === 'week' && (
      <div className="week-grid">
        {days.map(day => {
          const config = DAY_CONFIG[day];
          const workout = workouts[day];
          const weekStartStr = weekStart.toISOString().split('T')[0];
          return (
            <div
              key={day}
              className={`day-card ${selectedDay === day ? 'selected' : ''} ${workout ? 'has-workout' : ''}`}
              onClick={() => setSelectedDay(selectedDay === day ? null : day)}
            >
              <h3>{day}</h3>
              <div className="day-info">
                <span className="day-type">{config.dayType}</span>
                <span className="day-filter">{config.filter}</span>
              </div>
              {workout ? (
                <div className="workout-preview">
                  <div className="workout-preview-header">
                    <span className="workout-chip">Saved workout</span>
                    {!isPastWeek && (
                      <button
                        className="btn-small"
                        onClick={(e) => {
                          e.stopPropagation();
                          generateWorkout(day);
                        }}
                        disabled={loading}
                      >
                        Regenerate
                      </button>
                    )}
                  </div>

                  {selectedDay === day && (
                    <div className="day-expanded" onClick={(e) => e.stopPropagation()}>
                      {!isPastWeek && (
                        <button
                          className="btn-small btn-primary btn-regenerate-expanded"
                          onClick={(e) => {
                            e.stopPropagation();
                            generateWorkout(day);
                          }}
                          disabled={loading}
                        >
                          Regenerate this day
                        </button>
                      )}
                      <div className="past-week-station">
                        <div className="past-week-station-title">Station 1 · Conditioning (Tri‑Sets)</div>
                        <div className="past-week-station-body">
                          {day === 'Monday' && !isPastWeek && getWorkoutId(workout) ? (
                            <MondayStation1Selector
                              workoutId={getWorkoutId(workout)}
                              workout={workout}
                              weekStartDate={weekStartStr}
                              dayOfWeek={day}
                              onUpdate={(updated) => setWorkouts((prev) => ({ ...prev, [day]: updated }))}
                              disabled={false}
                            />
                          ) : day === 'Saturday' && !isPastWeek && getWorkoutId(workout) ? (
                            <SaturdayStation1Selector
                              workoutId={getWorkoutId(workout)}
                              workout={workout}
                              weekStartDate={weekStartStr}
                              dayOfWeek={day}
                              onUpdate={(updated) => setWorkouts((prev) => ({ ...prev, [day]: updated }))}
                              disabled={false}
                            />
                          ) : (
                            <>
                              <div className="past-week-phase">
                                <div className="past-week-phase-label">Phase 1</div>
                                <ul className="past-week-list compact editable-list">
                                  {(workout.station1?.phase1 || []).map((ex, idx) => (
                                    <li key={idx}>
                                      {!isPastWeek && (getWorkoutId(workout) || weekStartStr) ? (
                                        <EditableExerciseSlot
                                          value={ex.name || ex.exerciseId?.name}
                                          workoutId={getWorkoutId(workout)}
                                          station={1}
                                          phase={1}
                                          slotIndex={idx}
                                          dayType={workout.dayType}
                                          filter={workout.filter}
                                          weekStartDate={weekStartStr}
                                          dayOfWeek={day}
                                          onUpdate={(updated) => setWorkouts((prev) => ({ ...prev, [day]: updated }))}
                                          slotLabel={String.fromCharCode(65 + idx)}
                                          canRegenerate={day !== 'Monday' && day !== 'Saturday'}
                                          onWorkoutNotFound={loadWorkouts}
                                        />
                                      ) : (
                                        <>{formatExerciseName(ex.name || ex.exerciseId?.name)}</>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="past-week-phase">
                                <div className="past-week-phase-label">Phase 2</div>
                                <ul className="past-week-list compact editable-list">
                                  {(workout.station1?.phase2 || []).map((ex, idx) => (
                                    <li key={idx}>
                                      {!isPastWeek && (getWorkoutId(workout) || weekStartStr) ? (
                                        <EditableExerciseSlot
                                          value={ex.name || ex.exerciseId?.name}
                                          workoutId={getWorkoutId(workout)}
                                          station={1}
                                          phase={2}
                                          slotIndex={idx}
                                          dayType={workout.dayType}
                                          filter={workout.filter}
                                          weekStartDate={weekStartStr}
                                          dayOfWeek={day}
                                          onUpdate={(updated) => setWorkouts((prev) => ({ ...prev, [day]: updated }))}
                                          slotLabel={String.fromCharCode(65 + idx)}
                                          canRegenerate={day !== 'Monday' && day !== 'Saturday'}
                                          onWorkoutNotFound={loadWorkouts}
                                        />
                                      ) : (
                                        <>{formatExerciseName(ex.name || ex.exerciseId?.name)}</>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="past-week-station">
                        <div className="past-week-station-title">Station 2 · Bag Work</div>
                        <ul className="past-week-list compact editable-list">
                          {(workout.station2 || []).map((ex, idx) => (
                            <li key={idx}>
                              {!isPastWeek && (getWorkoutId(workout) || weekStartStr) ? (
                                <EditableExerciseSlot
                                  value={ex.name || ex.exerciseId?.name}
                                  workoutId={getWorkoutId(workout)}
                                  station={2}
                                  slotIndex={idx}
                                  dayType={workout.dayType}
                                  filter={workout.filter}
                                  weekStartDate={weekStartStr}
                                  dayOfWeek={day}
                                  onUpdate={(updated) => setWorkouts((prev) => ({ ...prev, [day]: updated }))}
                                  slotLabel={String.fromCharCode(65 + idx)}
                                  canRegenerate
                                  onWorkoutNotFound={loadWorkouts}
                                />
                              ) : (
                                <>
                                  <strong>{String.fromCharCode(65 + idx)}.</strong>{' '}
                                  {formatExerciseName(ex.name || ex.exerciseId?.name)}
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="past-week-station">
                        <div className="past-week-station-title">Station 3 · Technique</div>
                        <ul className="past-week-list compact editable-list">
                          {(() => {
                            const isNonstopDay = day === 'Monday' || day === 'Wednesday' || day === 'Saturday';
                            if (isNonstopDay) {
                              // Always show a single, fixed Non-Stop Sparring line on Mon/Wed/Sat (no editing, no refresh)
                              return (
                                <li>
                                  <strong>A.</strong> {formatExerciseName('Non-Stop Sparring')}
                                </li>
                              );
                            }
                            return (workout.station3 || []).map((ex, idx) => (
                              <li key={idx}>
                                {!isPastWeek && (getWorkoutId(workout) || weekStartStr) ? (
                                  <EditableExerciseSlot
                                    value={ex.name || ex.exerciseId?.name}
                                    workoutId={getWorkoutId(workout)}
                                    station={3}
                                    slotIndex={idx}
                                    dayType={workout.dayType}
                                    filter={workout.filter}
                                    weekStartDate={weekStartStr}
                                    dayOfWeek={day}
                                    onUpdate={(updated) => setWorkouts((prev) => ({ ...prev, [day]: updated }))}
                                    slotLabel={String.fromCharCode(65 + idx)}
                                    canRegenerate={day !== 'Monday' && day !== 'Wednesday' && day !== 'Saturday'}
                                    onWorkoutNotFound={loadWorkouts}
                                  />
                                ) : (
                                  <>
                                    <strong>{String.fromCharCode(65 + idx)}.</strong>{' '}
                                    {formatExerciseName(ex.name || ex.exerciseId?.name)}
                                  </>
                                )}
                              </li>
                            ));
                          })()}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                !isPastWeek && (
                  <button
                    className="btn-small btn-primary btn-generate-day"
                    onClick={(e) => {
                      e.stopPropagation();
                      generateWorkout(day);
                    }}
                    disabled={loading}
                  >
                    Generate
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* Inline expansion now replaces the modal + week detail grid */}
    </div>
  );
};

export default Calendar;
