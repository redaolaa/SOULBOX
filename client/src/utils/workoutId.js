/**
 * Get a string workout ID from a workout object or id (handles MongoDB _id in any shape).
 * Use for building API URLs so the server always receives a string id.
 */
export function getWorkoutId(workoutOrId) {
  if (workoutOrId == null) return '';
  const raw = typeof workoutOrId === 'object' && workoutOrId !== null && !(workoutOrId instanceof Date)
    ? (workoutOrId._id ?? workoutOrId.$oid ?? workoutOrId.id ?? workoutOrId)
    : workoutOrId;
  if (raw == null) return '';
  const str = typeof raw === 'string' ? raw : (raw.toString?.() ?? String(raw));
  if (typeof str !== 'string' || str === '' || str === '[object Object]' || str === 'undefined') return '';
  return str;
}
