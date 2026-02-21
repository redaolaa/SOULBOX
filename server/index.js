require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const BlockedDay = require('./models/BlockedDay');
const Exercise = require('./models/Exercise');
const TriSet = require('./models/TriSet');
const User = require('./models/User');
const Workout = require('./models/Workout');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
// Only serve server/public in development; in production we serve the React app from client/dist
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static('public'));
}

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soulbox')
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// ========== AUTHENTICATION ROUTES ==========

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, name } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = new User({ username, email, password, name });
    await user.save();

    const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET);
    res.status(201).json({ token, user: { id: user._id, username: user.username, email: user.email, name: user.name } });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user._id, username: user.username, email: user.email, name: user.name } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Change password (requires current password)
app.patch('/api/auth/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const valid = await user.comparePassword(currentPassword);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== EXERCISE ROUTES ==========

// Get exercises for user. Used by calendar dropdowns: only returns exercises for that category.
// Use native collection so Mongoose never validates focus (avoids error when DB has focus: Abs/Cardio and schema was cached without them).
// - Station 1: station + dayType + optional focus
// - Station 2/3: station + dayType only
app.get('/api/exercises', authenticateToken, async (req, res) => {
  try {
    const userIdObj = req.user.userId instanceof mongoose.Types.ObjectId ? req.user.userId : new mongoose.Types.ObjectId(req.user.userId);
    const query = { userId: userIdObj };
    const station = req.query.station != null ? Number(req.query.station) : null;
    const dayType = req.query.dayType;

    // No station = return all exercises (e.g. Exercise Lab list). Uses native collection so focus: Abs/Cardio never validated.
    if (station == null || ![1, 2, 3].includes(station)) {
      const rawList = await Exercise.collection.find(query).sort({ name: 1 }).toArray();
      const exercises = rawList.map((d) => ({
        ...d,
        _id: d._id.toString(),
        id: d._id.toString(),
        userId: d.userId ? d.userId.toString() : d.userId
      }));
      return res.json(exercises);
    }
    query.station = station;

    if (station === 2 || station === 3) {
      if (!dayType) return res.json([]);
      query.dayType = dayType;
    }
    if (station === 1) {
      if (!dayType) return res.json([]);
      query.dayType = dayType;
      const focusParam = req.query.focus;
      if (focusParam != null && focusParam !== '' && focusParam !== 'all') {
        const focusList = Array.isArray(focusParam) ? focusParam : [focusParam];
        query.focus = focusList.length === 1 ? focusList[0] : { $in: focusList };
      }
    }

    const rawList = await Exercise.collection.find(query).sort({ name: 1 }).toArray();
    const exercises = rawList.map((d) => ({
      ...d,
      _id: d._id.toString(),
      id: d._id.toString(),
      userId: d.userId ? d.userId.toString() : d.userId
    }));
    res.json(exercises);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get exercises for Monday or Saturday Station 1 tri-sets (only Station 1, Technique, from that day's grid)
app.get('/api/exercises/station1-for-day', authenticateToken, async (req, res) => {
  try {
    const { dayOfWeek } = req.query;
    if (!dayOfWeek || !['Monday', 'Saturday'].includes(dayOfWeek)) {
      return res.status(400).json({ error: 'Provide dayOfWeek: Monday or Saturday' });
    }
    const focus = dayOfWeek === 'Monday' ? 'Mixed' : 'Lower';
    const focusList = focus === 'Mixed' ? ['Mixed', 'Full Body'] : ['Lower'];

    const workouts = await Workout.find({ userId: req.user.userId, dayOfWeek }).select('station1');
    const exerciseIds = new Set();
    for (const w of workouts) {
      const phase1 = w.station1?.phase1 || [];
      phase1.forEach((slot) => {
        if (slot?.exerciseId) exerciseIds.add(slot.exerciseId.toString());
      });
    }

    const userIdObj = req.user.userId instanceof mongoose.Types.ObjectId ? req.user.userId : new mongoose.Types.ObjectId(req.user.userId);
    const focusListObjIds = exerciseIds.size > 0 ? [...exerciseIds].map((id) => new mongoose.Types.ObjectId(id)) : [];
    const q = exerciseIds.size > 0
      ? { _id: { $in: focusListObjIds }, userId: userIdObj, station: 1, dayType: 'Technique', focus: { $in: focusList } }
      : { userId: userIdObj, station: 1, dayType: 'Technique', focus: { $in: focusList } };
    const rawList = await Exercise.collection.find(q).sort({ name: 1 }).toArray();
    const exercises = rawList.map((d) => ({ ...d, _id: d._id.toString(), id: d._id.toString(), userId: d.userId ? d.userId.toString() : d.userId }));
    res.json(exercises);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get exercise by ID (native collection — avoid Mongoose validating focus: Abs/Cardio)
app.get('/api/exercises/:id', authenticateToken, async (req, res) => {
  try {
    const id = new mongoose.Types.ObjectId(req.params.id);
    const userIdObj = req.user.userId instanceof mongoose.Types.ObjectId ? req.user.userId : new mongoose.Types.ObjectId(req.user.userId);
    const raw = await Exercise.collection.findOne({ _id: id, userId: userIdObj });
    if (!raw) return res.status(404).json({ error: 'Exercise not found' });
    const doc = { ...raw, _id: raw._id.toString(), id: raw._id.toString(), userId: raw.userId ? raw.userId.toString() : raw.userId };
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Allowed focus values for Station 1 (any string allowed; these are normalized)
const EXERCISE_FOCUS_VALUES = ['Upper', 'Lower', 'Mixed', 'Full Body', 'Cardio', 'Abs'];

// Insert exercise via native collection to avoid any Mongoose focus enum validation (Cardio/Abs).
async function insertExerciseRaw(userId, doc) {
  const now = new Date();
  const raw = {
    userId: userId instanceof mongoose.Types.ObjectId ? userId : new mongoose.Types.ObjectId(userId),
    name: String(doc.name || '').trim(),
    station: Number(doc.station) || 1,
    focus: doc.focus ?? null,
    dayType: doc.dayType && ['Boxing', 'Kickboxing', 'Technique', 'Conditioning'].includes(doc.dayType) ? doc.dayType : 'Kickboxing',
    isStatic: Boolean(doc.isStatic),
    staticCondition: doc.staticCondition || null,
    createdAt: now,
    updatedAt: now
  };
  const result = await Exercise.collection.insertOne(raw);
  const inserted = await Exercise.collection.findOne({ _id: result.insertedId });
  if (!inserted) return null;
  // Return doc with _id for server (exerciseId: ex._id); callers that need a full doc get plain object
  return {
    ...inserted,
    _id: inserted._id,
    userId: inserted.userId
  };
}

// Create new exercise. Focus (Upper/Lower/Mixed/Full Body/Cardio/Abs) only for Station 1.
app.post('/api/exercises', authenticateToken, async (req, res) => {
  try {
    const { name, station, focus, dayType, isStatic, staticCondition } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Exercise name is required' });
    }
    const stationNum = station != null ? Number(station) : 1;
    const focusVal = (stationNum === 1 && focus != null && EXERCISE_FOCUS_VALUES.includes(focus))
      ? focus
      : (stationNum === 1 ? 'Upper' : null);
    const exercise = await insertExerciseRaw(req.user.userId, {
      name: String(name).trim(),
      station: stationNum,
      focus: focusVal,
      dayType: dayType != null && ['Boxing', 'Kickboxing', 'Technique', 'Conditioning'].includes(dayType) ? dayType : 'Kickboxing',
      isStatic: Boolean(isStatic),
      staticCondition: staticCondition || null
    });
    const out = exercise ? { ...exercise, _id: exercise._id.toString(), id: exercise._id.toString(), userId: exercise.userId ? exercise.userId.toString() : exercise.userId } : null;
    res.status(201).json(out);
  } catch (error) {
    const message = error.name === 'ValidationError' && error.errors
      ? Object.values(error.errors).map((e) => e.message).join(' ')
      : error.message;
    res.status(400).json({ error: message });
  }
});

// Update exercise (only allow name, station, focus, dayType, isStatic, staticCondition).
// Do not update lastUsed — that is set only when an exercise is placed in a workout, so editing
// in the Exercise Lab does not change when the exercise was used or its placement on the calendar.
const EXERCISE_UPDATE_FIELDS = ['name', 'station', 'focus', 'dayType', 'isStatic', 'staticCondition'];
app.put('/api/exercises/:id', authenticateToken, async (req, res) => {
  try {
    const id = new mongoose.Types.ObjectId(req.params.id);
    const userIdObj = req.user.userId instanceof mongoose.Types.ObjectId ? req.user.userId : new mongoose.Types.ObjectId(req.user.userId);
    // Use native collection for read too — avoids Mongoose validating existing doc (e.g. focus: Abs) if schema was ever cached with enum
    const existingRaw = await Exercise.collection.findOne({ _id: id, userId: userIdObj });
    if (!existingRaw) return res.status(404).json({ error: 'Exercise not found' });
    const existingStation = existingRaw.station != null ? Number(existingRaw.station) : 1;

    const update = {};
    for (const key of EXERCISE_UPDATE_FIELDS) {
      if (req.body[key] === undefined) continue;
      if (key === 'name') update.name = String(req.body[key]).trim();
      else if (key === 'station') {
        const stationNum = Number(req.body[key]);
        update.station = stationNum;
        if (stationNum === 2 || stationNum === 3) update.focus = null;
      }
      else if (key === 'focus') {
        const st = req.body.station != null ? Number(req.body.station) : existingStation;
        if (st === 2 || st === 3) update.focus = null;
        else if (req.body[key] != null && String(req.body[key]).trim() !== '') {
          const raw = String(req.body[key]).trim();
          const canonical = EXERCISE_FOCUS_VALUES.find((f) => f === raw || f.toLowerCase() === raw.toLowerCase());
          update.focus = canonical !== undefined ? canonical : raw;
        }
      }
      else if (key === 'isStatic') update.isStatic = Boolean(req.body[key]);
      else if (key === 'staticCondition') update.staticCondition = req.body[key] || null;
      else update[key] = req.body[key];
    }
    const toJsonDoc = (raw) => {
      if (!raw) return null;
      const d = { ...raw };
      if (d._id) { d._id = d._id.toString(); d.id = d._id; }
      if (d.userId) d.userId = d.userId.toString();
      return d;
    };
    if (Object.keys(update).length === 0) {
      return res.json(toJsonDoc(existingRaw));
    }
    const result = await Exercise.collection.updateOne(
      { _id: id, userId: userIdObj },
      { $set: { ...update, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Exercise not found' });
    const raw = await Exercise.collection.findOne({ _id: id, userId: userIdObj });
    const doc = toJsonDoc(raw);
    if (!doc) return res.status(404).json({ error: 'Exercise not found' });
    res.json(doc);
  } catch (error) {
    const message = error.name === 'ValidationError' && error.errors
      ? Object.values(error.errors).map((e) => e.message).join(' ')
      : error.message;
    res.status(400).json({ error: message });
  }
});

// Delete exercise
app.delete('/api/exercises/:id', authenticateToken, async (req, res) => {
  try {
    const exercise = await Exercise.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }
    res.json({ message: 'Exercise deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== TRISET ROUTES (Station 1 linked sets for Monday/Saturday) ==========

// Helper: normalize exercise ref to { _id, name } for reliable client display
function exerciseRefToName(ref) {
  if (!ref) return { _id: null, name: '—' };
  const id = ref._id || ref;
  const name = (typeof ref === 'object' && ref && ref.name != null) ? String(ref.name).trim() : '—';
  return { _id: id, name: name || '—' };
}

// Get tri-sets (optional: dayType, focus). For Monday (focus=Mixed), ensure built-in "ATT/DEF + Phase 2 progression" is included and first.
app.get('/api/trisets', authenticateToken, async (req, res) => {
  try {
    const query = { userId: req.user.userId };
    if (req.query.dayType) query.dayType = req.query.dayType;
    if (req.query.focus) query.focus = req.query.focus;
    let triSets = await TriSet.find(query).populate('exerciseIds phase2ExerciseIds').sort({ name: 1 });
    if (req.query.focus === 'Mixed') {
      const defaultMonday = await getOrCreateMondayDefaultTriSet(req.user.userId);
      if (defaultMonday) {
        const idStr = defaultMonday._id.toString();
        triSets = triSets.filter((ts) => ts._id.toString() !== idStr);
        triSets.unshift(defaultMonday);
      }
    }
    // Send explicit { _id, name } per exercise so Exercise Lab always gets names
    const payload = triSets.map((ts) => {
      try {
        const p1 = (ts.exerciseIds && ts.exerciseIds.length === 3)
          ? ts.exerciseIds.map(exerciseRefToName)
          : [];
        const p2 = (ts.phase2ExerciseIds && ts.phase2ExerciseIds.length === 3)
          ? ts.phase2ExerciseIds.map(exerciseRefToName)
          : [];
        return {
          _id: ts._id,
          concept: ts.concept != null ? String(ts.concept) : '',
          name: ts.name != null ? String(ts.name) : '',
          focus: ts.focus != null ? String(ts.focus) : '',
          exerciseIds: p1,
          phase2ExerciseIds: p2
        };
      } catch (e) {
        return {
          _id: ts._id,
          concept: ts.concept != null ? String(ts.concept) : '',
          name: ts.name != null ? String(ts.name) : '',
          focus: ts.focus != null ? String(ts.focus) : '',
          exerciseIds: [],
          phase2ExerciseIds: []
        };
      }
    });
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create tri-set (body: { focus, concept?, name?, exerciseIds: [idA, idB, idC] } — grid order A, B, C)
app.post('/api/trisets', authenticateToken, async (req, res) => {
  try {
    const { focus, concept, name, exerciseIds } = req.body;
    if (!focus || !exerciseIds || !Array.isArray(exerciseIds) || exerciseIds.length !== 3) {
      return res.status(400).json({ error: 'Provide focus and exactly 3 exerciseIds in grid order (A, B, C)' });
    }
    const focusVal = focus === 'Mixed' || focus === 'Lower' ? focus : 'Mixed';
    const validFocus = focusVal === 'Mixed' ? ['Mixed', 'Full Body'] : ['Lower'];
    const userIdObj = req.user.userId instanceof mongoose.Types.ObjectId ? req.user.userId : new mongoose.Types.ObjectId(req.user.userId);
    const ids = exerciseIds.map((id) => new mongoose.Types.ObjectId(id));
    const rawList = await Exercise.collection.find({ _id: { $in: ids }, userId: userIdObj }).toArray();
    if (rawList.length !== 3) {
      return res.status(400).json({ error: 'All 3 exercises must exist and belong to you' });
    }
    for (const ex of rawList) {
      if (ex.station !== 1 || ex.dayType !== 'Technique') {
        return res.status(400).json({ error: `Exercise "${ex.name}" must be Station 1, Technique (found Station ${ex.station}, ${ex.dayType})` });
      }
      if (!validFocus.includes(ex.focus)) {
        return res.status(400).json({ error: `Exercise "${ex.name}" must have focus ${focusVal} for this tri-set (found ${ex.focus})` });
      }
    }
    const triSet = new TriSet({
      userId: req.user.userId,
      dayType: 'Technique',
      focus: focusVal,
      name: (name && String(name).trim()) || '',
      concept: (concept && String(concept).trim()) || '',
      exerciseIds
    });
    await triSet.save();
    await triSet.populate('exerciseIds');
    res.status(201).json(triSet);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ========== WORKOUT GENERATION LOGIC ==========

// Day configuration (filter values must be in Workout schema enum)
const DAY_CONFIG = {
  Sunday: { dayType: 'Kickboxing', filter: 'Upper Body' },
  Monday: { dayType: 'Technique', filter: 'Mixed/Full Body' },
  Tuesday: { dayType: 'Boxing', filter: 'Upper Body' },
  Wednesday: { dayType: 'Conditioning', filter: 'Lower Body' },
  Thursday: { dayType: 'Kickboxing', filter: 'Mixed/Full Body' },
  Saturday: { dayType: 'Technique', filter: 'Lower Body' }
};

// Map workout filter (calendar/day) to exercise focus for Station 1
function filterToFocus(filter) {
  if (!filter) return 'Mixed';
  const f = String(filter).trim();
  if (f === 'Upper Body') return 'Upper';
  if (f === 'Lower Body') return 'Lower';
  if (f === 'Mixed/Full Body') return 'Mixed';
  if (f === 'Full Body' || f === 'Cardio' || f === 'Abs') return f;
  return 'Mixed';
}

// Helper function to check if exercise was used in last 4 weeks
const isAvailable = (exercise, fourWeeksAgo) => {
  if (!exercise.lastUsed) return true;
  return new Date(exercise.lastUsed) < fourWeeksAgo;
};

// Helper function to get static exercises
const getStaticExercise = async (userId, dayType, station, position) => {
  if (station === 3 && position === 1 && (dayType === 'Kickboxing' || dayType === 'Boxing')) {
    const staticCondition = dayType === 'Kickboxing' ? 'kickboxing-station3-b' : 'boxing-station3-b';
    const staticExercise = await Exercise.findOne({
      userId,
      isStatic: true,
      staticCondition,
      station: 3
    });
    return staticExercise;
  }
  return null;
};

// Station 3 on Monday, Wednesday, Saturday is always "Non-Stop Sparring". Create if missing so generation never fails.
const getOrCreateNonStopSparringExercise = async (userId) => {
  const userIdObj = userId instanceof mongoose.Types.ObjectId ? userId : new mongoose.Types.ObjectId(userId);
  let ex = await Exercise.collection.findOne({
    userId: userIdObj,
    station: 3,
    name: { $regex: /non-stop sparring/i }
  });
  if (ex) {
    return { _id: ex._id, name: ex.name, userId: ex.userId };
  }
  ex = await insertExerciseRaw(userId, {
    name: 'Non-Stop Sparring',
    station: 3,
    dayType: 'Technique',
    focus: null,
    isStatic: false,
    staticCondition: null
  });
  if (ex) return ex;
  ex = await Exercise.collection.findOne({
    userId: userIdObj,
    station: 3,
    name: { $regex: /non-stop sparring/i }
  });
  return ex ? { _id: ex._id, name: ex.name, userId: ex.userId } : null;
};

// Get or create an exercise by name for Station 1 (Technique, Mixed). Used for Monday fixed sequence.
const getOrCreateExerciseByName = async (userId, name, station = 1, dayType = 'Technique', focus = 'Mixed') => {
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  let ex = await Exercise.findOne({
    userId,
    station,
    dayType,
    focus,
    name: { $regex: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
  });
  if (!ex) {
    ex = await insertExerciseRaw(userId, { name: trimmed, station, dayType, focus });
  }
  return ex;
};

// Monday Station 1 fixed sequence (from WEEK199-MonToSat-flat / table): Phase 1 = ATT/DEF x3; Phase 2 = progression A,B,C
const MONDAY_STATION1_PHASE1_NAMES = ['ATT/DEF', 'ATT/DEF', 'ATT/DEF'];
const MONDAY_STATION1_PHASE2_NAMES = [
  '1, BLK / SLIP R, 2',
  '1, BLK, 2, BLK / SLIP R, 2, PARRY, 4',
  '1, BLK, 2, BLK, 3/…, PARRY, 4, WV R'
];
const MONDAY_DEFAULT_TRISET_CONCEPT = 'ATT/DEF + Phase 2 progression';

// Get or create the built-in Monday Station 1 tri-set (Phase 1 = ATT/DEF x3, Phase 2 = progression). Used for dropdown grouping.
const getOrCreateMondayDefaultTriSet = async (userId) => {
  const existing = await TriSet.findOne({
    userId,
    focus: 'Mixed',
    concept: MONDAY_DEFAULT_TRISET_CONCEPT
  }).populate('exerciseIds phase2ExerciseIds');
  if (existing && existing.exerciseIds?.length === 3 && existing.phase2ExerciseIds?.length === 3) {
    return existing;
  }
  const attDef = await getOrCreateExerciseByName(userId, 'ATT/DEF', 1, 'Technique', 'Mixed');
  if (!attDef) return null;
  const phase2Ids = [];
  for (const name of MONDAY_STATION1_PHASE2_NAMES) {
    const ex = await getOrCreateExerciseByName(userId, name, 1, 'Technique', 'Mixed');
    if (ex) phase2Ids.push(ex._id);
  }
  if (phase2Ids.length !== 3) return null;
  if (existing) {
    existing.exerciseIds = [attDef._id, attDef._id, attDef._id];
    existing.phase2ExerciseIds = phase2Ids;
    await existing.save();
    await existing.populate('exerciseIds phase2ExerciseIds');
    return existing;
  }
  const triSet = new TriSet({
    userId,
    dayType: 'Technique',
    focus: 'Mixed',
    concept: MONDAY_DEFAULT_TRISET_CONCEPT,
    name: 'Monday default',
    exerciseIds: [attDef._id, attDef._id, attDef._id],
    phase2ExerciseIds: phase2Ids
  });
  await triSet.save();
  await triSet.populate('exerciseIds phase2ExerciseIds');
  return triSet;
};

// Select random exercises with 4-week rule
const selectExercises = async (userId, options, count, excludeIds = []) => {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const query = {
    userId,
    ...options,
    _id: { $nin: excludeIds }
  };

  let availableExercises = await Exercise.find(query);
  
  // Filter by 4-week rule
  availableExercises = availableExercises.filter(ex => isAvailable(ex, fourWeeksAgo));
  
  // If not enough available, use any that match criteria
  if (availableExercises.length < count) {
    availableExercises = await Exercise.find(query);
  }

  // Shuffle and select
  const shuffled = availableExercises.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Station 1: Monday = one phase (3 exercises); Saturday = Phase 1 + Phase 2 (linked, 6 exercises)
const selectTriSetsForStation1 = async (userId, focus, excludeTriSetIds = []) => {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const query = { userId, dayType: 'Technique', focus, _id: { $nin: excludeTriSetIds } };
  let triSets = await TriSet.find(query).populate('exerciseIds phase2ExerciseIds');
  triSets = triSets.filter(ts => ts.exerciseIds && ts.exerciseIds.length === 3);
  // Monday (Mixed) and Saturday (Lower): use full 6-exercise tri-sets (Phase 1 + Phase 2)
  if (focus === 'Lower' || focus === 'Mixed') {
    triSets = triSets.filter(ts => ts.phase2ExerciseIds && ts.phase2ExerciseIds.length === 3);
  }
  if (triSets.length === 0) return null;
  const available = triSets.filter(ts => !ts.lastUsed || new Date(ts.lastUsed) < fourWeeksAgo);
  const pool = available.length >= 2 ? available : triSets;
  const shuffled = pool.sort(() => 0.5 - Math.random());
  return shuffled[0];
};

// Generate workout for a specific day
const generateWorkout = async (userId, dayOfWeek, weekStartDate) => {
  const config = DAY_CONFIG[dayOfWeek];
  if (!config) {
    throw new Error(`Invalid day: ${dayOfWeek}`);
  }

  const { dayType, filter } = config;
  const usedExerciseIds = [];
  const focusForStation1 = filter === 'Upper Body' ? 'Upper' : filter === 'Lower Body' ? 'Lower' : 'Mixed';

  // Station 1: Monday & Saturday = tri-set sequence (Phase 1 + Phase 2); other days = 3 random
  let station1Phase1;
  let station1Phase2;
  const isMondayTechnique = dayOfWeek === 'Monday' && dayType === 'Technique';
  const isSaturdayTechnique = dayOfWeek === 'Saturday' && dayType === 'Technique';

  if (isMondayTechnique) {
    // Phase 1: always ATT/DEF, ATT/DEF, ATT/DEF (like previous weeks)
    const attDef = await getOrCreateExerciseByName(userId, 'ATT/DEF', 1, 'Technique', 'Mixed');
    if (!attDef) throw new Error('Could not get or create ATT/DEF for Monday Station 1.');
    station1Phase1 = [
      { _id: attDef._id, name: attDef.name },
      { _id: attDef._id, name: attDef.name },
      { _id: attDef._id, name: attDef.name }
    ];
    station1Phase1.forEach(ex => usedExerciseIds.push(ex._id));
    // Phase 2: from a tri-set sequence (pick one Mixed tri-set with Phase 2, or use default ATT/DEF + progression)
    let triSet1 = await selectTriSetsForStation1(userId, 'Mixed', []);
    if (!triSet1 || !triSet1.phase2ExerciseIds || triSet1.phase2ExerciseIds.length !== 3) {
      triSet1 = await getOrCreateMondayDefaultTriSet(userId);
    }
    if (triSet1 && triSet1.phase2ExerciseIds && triSet1.phase2ExerciseIds.length === 3) {
      station1Phase2 = [
        { _id: triSet1.phase2ExerciseIds[0]._id, name: triSet1.phase2ExerciseIds[0].name },
        { _id: triSet1.phase2ExerciseIds[1]._id, name: triSet1.phase2ExerciseIds[1].name },
        { _id: triSet1.phase2ExerciseIds[2]._id, name: triSet1.phase2ExerciseIds[2].name }
      ];
      station1Phase2.forEach(ex => usedExerciseIds.push(ex._id));
      await TriSet.findByIdAndUpdate(triSet1._id, { lastUsed: new Date() });
    } else {
      station1Phase2 = [];
      for (const name of MONDAY_STATION1_PHASE2_NAMES) {
        const ex = await getOrCreateExerciseByName(userId, name, 1, 'Technique', 'Mixed');
        if (ex) {
          station1Phase2.push({ _id: ex._id, name: ex.name });
          usedExerciseIds.push(ex._id);
        }
      }
      while (station1Phase2.length < 3) {
        station1Phase2.push({ _id: attDef._id, name: attDef.name });
      }
    }
  } else if (isSaturdayTechnique) {
    const triSetFocus = 'Lower';
    const triSet1 = await selectTriSetsForStation1(userId, triSetFocus, []);
    if (!triSet1 || !triSet1.exerciseIds || triSet1.exerciseIds.length !== 3) {
      throw new Error(`No tri-sets for Saturday (${triSetFocus}). Create tri-sets in Exercise Lab first.`);
    }
    station1Phase1 = [
      { _id: triSet1.exerciseIds[0]._id, name: triSet1.exerciseIds[0].name },
      { _id: triSet1.exerciseIds[1]._id, name: triSet1.exerciseIds[1].name },
      { _id: triSet1.exerciseIds[2]._id, name: triSet1.exerciseIds[2].name }
    ];
    station1Phase1.forEach(ex => usedExerciseIds.push(ex._id));
    if (triSet1.phase2ExerciseIds && triSet1.phase2ExerciseIds.length === 3) {
      station1Phase2 = [
        { _id: triSet1.phase2ExerciseIds[0]._id, name: triSet1.phase2ExerciseIds[0].name },
        { _id: triSet1.phase2ExerciseIds[1]._id, name: triSet1.phase2ExerciseIds[1].name },
        { _id: triSet1.phase2ExerciseIds[2]._id, name: triSet1.phase2ExerciseIds[2].name }
      ];
      station1Phase2.forEach(ex => usedExerciseIds.push(ex._id));
    } else {
      station1Phase2 = [];
    }
    await TriSet.findByIdAndUpdate(triSet1._id, { lastUsed: new Date() });
  } else {
    const p1 = await selectExercises(userId, { station: 1, dayType, focus: focusForStation1 }, 3);
    station1Phase1 = p1.map(ex => ({ _id: ex._id, name: ex.name }));
    station1Phase1.forEach(ex => usedExerciseIds.push(ex._id));
    const p2 = await selectExercises(userId, { station: 1, dayType, focus: focusForStation1 }, 3, station1Phase1.map(ex => ex._id));
    station1Phase2 = p2.map(ex => ({ _id: ex._id, name: ex.name }));
    station1Phase2.forEach(ex => usedExerciseIds.push(ex._id));
  }

  // Station 2 - 3 combos
  const station2 = await selectExercises(
    userId,
    { station: 2, dayType },
    3,
    usedExerciseIds
  );
  station2.forEach(ex => usedExerciseIds.push(ex._id));

  // Station 3 - 3 partner drills (Mon/Wed/Sat: always Non-Stop Sparring)
  const station3 = [];
  const nonStopSparringDays = ['Monday', 'Wednesday', 'Saturday'];
  const nonStopSparring = nonStopSparringDays.includes(dayOfWeek)
    ? await getOrCreateNonStopSparringExercise(userId)
    : null;

  if (nonStopSparring) {
    station3.push(nonStopSparring, nonStopSparring, nonStopSparring);
    usedExerciseIds.push(nonStopSparring._id);
  } else if (nonStopSparringDays.includes(dayOfWeek)) {
    throw new Error('Station 3 on Monday, Wednesday, and Saturday is always Non-Stop Sparring. Add an exercise named "Non-Stop Sparring" for Station 3 in Exercise Lab.');
  } else {
    // Check for static exercise at position B (index 1)
    const staticExercise = await getStaticExercise(userId, dayType, 3, 1);
    if (staticExercise) {
      const station3Others = await selectExercises(
        userId,
        { station: 3, dayType, _id: { $ne: staticExercise._id } },
        2,
        usedExerciseIds
      );
      station3.push(station3Others[0], staticExercise, station3Others[1]);
      station3Others.forEach(ex => usedExerciseIds.push(ex._id));
      usedExerciseIds.push(staticExercise._id);
    } else {
      const station3Exercises = await selectExercises(
        userId,
        { station: 3, dayType },
        3,
        usedExerciseIds
      );
      station3.push(...station3Exercises);
      station3Exercises.forEach(ex => usedExerciseIds.push(ex._id));
    }
  }

  // Create workout
  const workout = new Workout({
    userId,
    dayOfWeek,
    dayType,
    filter,
    weekStartDate,
    station1: {
      phase1: station1Phase1.map(ex => ({ exerciseId: ex._id, name: ex.name })),
      phase2: station1Phase2.map(ex => ({ exerciseId: ex._id, name: ex.name }))
    },
    station2: station2.map(ex => ({ exerciseId: ex._id, name: ex.name })),
    station3: station3.map(ex => ({ exerciseId: ex._id, name: ex.name }))
  });

  await workout.save();

  // Update lastUsed for all exercises
  const allExerciseIds = [
    ...station1Phase1.map(ex => ex._id),
    ...station1Phase2.map(ex => ex._id),
    ...station2.map(ex => ex._id),
    ...station3.map(ex => ex._id)
  ];
  await Exercise.updateMany(
    { _id: { $in: allExerciseIds } },
    { lastUsed: new Date() }
  );

  return workout;
};

// ========== WORKOUT ROUTES ==========

// Generate workout for a day
app.post('/api/workouts/generate', authenticateToken, async (req, res) => {
  try {
    const { dayOfWeek, weekStartDate } = req.body;
    const workout = await generateWorkout(req.user.userId, dayOfWeek, new Date(weekStartDate));
    const populated = await Workout.findById(workout._id).populate('station1.phase1.exerciseId station1.phase2.exerciseId station2.exerciseId station3.exerciseId');
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Generate full week (replaces any existing workouts for that week)
app.post('/api/workouts/generate-week', authenticateToken, async (req, res) => {
  try {
    const { weekStartDate } = req.body;
    const startDate = new Date(weekStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    await Workout.deleteMany({
      userId: req.user.userId,
      weekStartDate: { $gte: startDate, $lt: endDate }
    });

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'];
    const workouts = [];

    for (const day of days) {
      try {
        const workout = await generateWorkout(req.user.userId, day, new Date(weekStartDate));
        workouts.push(workout);
      } catch (error) {
        console.error(`Error generating workout for ${day}:`, error);
      }
    }

    const populated = await Workout.find({ _id: { $in: workouts.map(w => w._id) } })
      .populate('station1.phase1.exerciseId station1.phase2.exerciseId station2.exerciseId station3.exerciseId')
      .sort({ dayOfWeek: 1 });

    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get workouts for a week (returns _id as string so client always has a valid id)
app.get('/api/workouts/week', authenticateToken, async (req, res) => {
  try {
    const { weekStartDate } = req.query;
    if (!weekStartDate) {
      return res.status(400).json({ error: 'weekStartDate required' });
    }
    const startDate = new Date(weekStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const userId = req.user.userId;
    const workouts = await Workout.find({
      userId,
      weekStartDate: { $gte: startDate, $lt: endDate }
    })
    .populate('station1.phase1.exerciseId station1.phase2.exerciseId station2.exerciseId station3.exerciseId')
    .sort({ dayOfWeek: 1 })
    .lean();

    const normalized = workouts.map((w) => ({
      ...w,
      _id: w._id ? String(w._id) : w._id
    }));
    res.json(normalized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all workouts
app.get('/api/workouts', authenticateToken, async (req, res) => {
  try {
    const workouts = await Workout.find({ userId: req.user.userId })
      .populate('station1.phase1.exerciseId station1.phase2.exerciseId station2.exerciseId station3.exerciseId')
      .sort({ weekStartDate: -1, dayOfWeek: 1 });
    res.json(workouts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get blocked days for a week
app.get('/api/blocked-days/week', authenticateToken, async (req, res) => {
  try {
    const { weekStartDate } = req.query;
    if (!weekStartDate) return res.status(400).json({ error: 'weekStartDate required' });
    const start = new Date(weekStartDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const list = await BlockedDay.find({
      userId: req.user.userId,
      weekStartDate: { $gte: start, $lt: end }
    }).lean();
    res.json(list.map((b) => b.dayOfWeek));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Block a day (rest day)
app.post('/api/blocked-days', authenticateToken, async (req, res) => {
  try {
    const { weekStartDate, dayOfWeek } = req.body;
    if (!weekStartDate || !dayOfWeek) return res.status(400).json({ error: 'weekStartDate and dayOfWeek required' });
    const validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'];
    if (!validDays.includes(dayOfWeek)) return res.status(400).json({ error: 'Invalid dayOfWeek' });
    const doc = await BlockedDay.findOneAndUpdate(
      { userId: req.user.userId, weekStartDate: new Date(weekStartDate), dayOfWeek },
      { $setOnInsert: { userId: req.user.userId, weekStartDate: new Date(weekStartDate), dayOfWeek } },
      { upsert: true, new: true }
    );
    res.json({ dayOfWeek: doc.dayOfWeek });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unblock a day
app.delete('/api/blocked-days', authenticateToken, async (req, res) => {
  try {
    const { weekStartDate, dayOfWeek } = req.query;
    if (!weekStartDate || !dayOfWeek) return res.status(400).json({ error: 'weekStartDate and dayOfWeek required' });
    await BlockedDay.deleteOne({
      userId: req.user.userId,
      weekStartDate: new Date(weekStartDate),
      dayOfWeek
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get workout by ID
app.get('/api/workouts/:id', authenticateToken, async (req, res) => {
  try {
    const workout = await Workout.findOne({ _id: req.params.id, userId: req.user.userId })
      .populate('station1.phase1.exerciseId station1.phase2.exerciseId station2.exerciseId station3.exerciseId');
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    res.json(workout);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set Monday Station 1 from a tri-set (Phase 1 always set; Phase 2 set if tri-set has phase2ExerciseIds)
app.patch('/api/workouts/:id/station1-monday-set', authenticateToken, async (req, res) => {
  try {
    let workout = await Workout.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!workout && req.body.dayOfWeek === 'Monday' && req.body.weekStartDate) {
      const start = new Date(req.body.weekStartDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      if (!Number.isNaN(start.getTime())) {
        workout = await Workout.findOne({
          userId: req.user.userId,
          dayOfWeek: 'Monday',
          weekStartDate: { $gte: start, $lt: end }
        });
      }
    }
    if (!workout) return res.status(404).json({ error: 'Workout not found' });
    if (workout.dayOfWeek !== 'Monday') return res.status(400).json({ error: 'Only for Monday workouts' });
    const { triSetId } = req.body;
    if (!triSetId) return res.status(400).json({ error: 'Provide triSetId' });
    const triSet = await TriSet.findOne({ _id: triSetId, userId: req.user.userId, focus: 'Mixed' }).populate('exerciseIds phase2ExerciseIds');
    if (!triSet || !triSet.exerciseIds || triSet.exerciseIds.length !== 3) return res.status(400).json({ error: 'Tri-set not found' });
    if (!workout.station1) workout.station1 = { phase1: [], phase2: [] };
    const p1 = workout.station1.phase1;
    if (!Array.isArray(p1)) workout.station1.phase1 = [];
    while (p1.length < 3) p1.push({});
    for (let i = 0; i < 3; i++) {
      const ex = triSet.exerciseIds[i];
      if (ex && ex._id) p1[i] = { exerciseId: ex._id, name: ex.name };
    }
    if (triSet.phase2ExerciseIds && triSet.phase2ExerciseIds.length === 3) {
      let p2 = workout.station1.phase2;
      if (!Array.isArray(p2)) workout.station1.phase2 = p2 = [];
      while (p2.length < 3) p2.push({});
      for (let i = 0; i < 3; i++) {
        const ex = triSet.phase2ExerciseIds[i];
        if (ex && ex._id) p2[i] = { exerciseId: ex._id, name: ex.name };
      }
    } else {
      workout.station1.phase2 = [];
    }
    await workout.save();
    const populated = await Workout.findById(workout._id).populate('station1.phase1.exerciseId station1.phase2.exerciseId station2.exerciseId station3.exerciseId');
    res.json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Set Saturday Station 1 from a tri-set (Phase 1 + Phase 2 together — linked group)
app.patch('/api/workouts/:id/station1-saturday-set', authenticateToken, async (req, res) => {
  try {
    let workout = await Workout.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!workout && req.body.dayOfWeek === 'Saturday' && req.body.weekStartDate) {
      const start = new Date(req.body.weekStartDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      if (!Number.isNaN(start.getTime())) {
        workout = await Workout.findOne({
          userId: req.user.userId,
          dayOfWeek: 'Saturday',
          weekStartDate: { $gte: start, $lt: end }
        });
      }
    }
    if (!workout) return res.status(404).json({ error: 'Workout not found' });
    if (workout.dayOfWeek !== 'Saturday') return res.status(400).json({ error: 'Only for Saturday workouts' });
    const { triSetId } = req.body;
    if (!triSetId) return res.status(400).json({ error: 'Provide triSetId' });
    const triSet = await TriSet.findOne({ _id: triSetId, userId: req.user.userId, focus: 'Lower' }).populate('exerciseIds phase2ExerciseIds');
    if (!triSet || !triSet.exerciseIds || triSet.exerciseIds.length !== 3) return res.status(400).json({ error: 'Tri-set not found' });
    if (!triSet.phase2ExerciseIds || triSet.phase2ExerciseIds.length !== 3) return res.status(400).json({ error: 'Tri-set must have Phase 2 for Saturday' });
    const p1 = workout.station1.phase1;
    let p2 = workout.station1.phase2;
    if (!p1 || p1.length < 3) return res.status(400).json({ error: 'Invalid station1 phase1' });
    if (!p2) workout.station1.phase2 = p2 = [];
    while (p2.length < 3) p2.push({});
    for (let i = 0; i < 3; i++) {
      const ex = triSet.exerciseIds[i];
      if (ex && ex._id) p1[i] = { exerciseId: ex._id, name: ex.name };
    }
    for (let i = 0; i < 3; i++) {
      const ex = triSet.phase2ExerciseIds[i];
      if (ex && ex._id) p2[i] = { exerciseId: ex._id, name: ex.name };
    }
    await workout.save();
    const populated = await Workout.findById(workout._id).populate('station1.phase1.exerciseId station1.phase2.exerciseId station2.exerciseId station3.exerciseId');
    res.json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Set Station 1 Phase from a tri-set (other days: single phase)
app.patch('/api/workouts/:id/station1-phase', authenticateToken, async (req, res) => {
  try {
    const workout = await Workout.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    const { phase, triSetId } = req.body;
    if (!triSetId || (phase !== 1 && phase !== 2)) {
      return res.status(400).json({ error: 'Provide phase (1 or 2) and triSetId' });
    }
    const triSet = await TriSet.findOne({ _id: triSetId, userId: req.user.userId }).populate('exerciseIds');
    if (!triSet || !triSet.exerciseIds || triSet.exerciseIds.length !== 3) {
      return res.status(400).json({ error: 'Tri-set not found or must have 3 exercises' });
    }
    const ph = phase === 2 ? 'phase2' : 'phase1';
    const arr = workout.station1[ph];
    if (!arr || arr.length < 3) {
      return res.status(400).json({ error: 'Invalid station1 phase' });
    }
    // Grid order: slot 0=A, 1=B, 2=C — apply in exact tri-set sequence
    for (let i = 0; i < 3 && i < triSet.exerciseIds.length; i++) {
      const ex = triSet.exerciseIds[i];
      if (ex && ex._id) arr[i] = { exerciseId: ex._id, name: ex.name };
    }
    await workout.save();
    const populated = await Workout.findById(workout._id)
      .populate('station1.phase1.exerciseId station1.phase2.exerciseId station2.exerciseId station3.exerciseId');
    res.json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Regenerate a single exercise slot (pick a new random exercise for that slot, same category)
app.patch('/api/workouts/:id/regenerate-slot', authenticateToken, async (req, res) => {
  try {
    let id = (req.params.id || '').toString().trim();
    const tokenUserId = req.user.userId;
    let workout = null;
    if (id && id !== 'undefined' && mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      workout = await Workout.findById(id);
    }
    // Fallback: find by week + day when id not found (same week range as GET /workouts/week)
    if (!workout && req.body.dayOfWeek && req.body.weekStartDate) {
      const start = new Date(req.body.weekStartDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      if (!Number.isNaN(start.getTime())) {
        workout = await Workout.findOne({
          userId: tokenUserId,
          dayOfWeek: req.body.dayOfWeek,
          weekStartDate: { $gte: start, $lt: end }
        });
      }
    }
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found. Try refreshing the week.' });
    }
    const userId = workout.userId;
    const { station, phase, slotIndex } = req.body;
    const st = Number(station);
    const slot = Number(slotIndex);
    if (Number.isNaN(st) || st < 1 || st > 3 || Number.isNaN(slot) || slot < 0 || slot > 2) {
      return res.status(400).json({ error: 'Invalid station or slotIndex' });
    }
    const dayOfWeek = workout.dayOfWeek;
    const nonStopSparringDays = ['Monday', 'Wednesday', 'Saturday'];
    if (st === 3 && nonStopSparringDays.includes(dayOfWeek)) {
      return res.status(400).json({ error: 'Station 3 on Monday, Wednesday, and Saturday is always Non-Stop Sparring' });
    }

    const usedIds = [];
    const phase1 = workout.station1?.phase1 || [];
    const phase2 = workout.station1?.phase2 || [];
    phase1.forEach((s) => { if (s?.exerciseId) usedIds.push(s.exerciseId); });
    phase2.forEach((s) => { if (s?.exerciseId) usedIds.push(s.exerciseId); });
    (workout.station2 || []).forEach((s) => { if (s?.exerciseId) usedIds.push(s.exerciseId); });
    (workout.station3 || []).forEach((s) => { if (s?.exerciseId) usedIds.push(s.exerciseId); });

    const dayType = workout.dayType;
    const focusForStation1 = filterToFocus(workout.filter);
    let newEx;

    if (st === 1) {
      newEx = (await selectExercises(userId, { station: 1, dayType, focus: focusForStation1 }, 1, usedIds))[0];
      if (!newEx) return res.status(400).json({ error: 'No alternative exercise for this slot' });
      const ph = phase === 2 ? 'phase2' : 'phase1';
      const arr = workout.station1[ph];
      if (!arr || arr.length < 3) return res.status(400).json({ error: 'Invalid station1 phase' });
      arr[slot] = { exerciseId: newEx._id, name: newEx.name };
      workout.markModified('station1');
    } else if (st === 2) {
      newEx = (await selectExercises(userId, { station: 2, dayType }, 1, usedIds))[0];
      if (!newEx) return res.status(400).json({ error: 'No alternative exercise for this slot' });
      if (!Array.isArray(workout.station2)) workout.station2 = [];
      while (workout.station2.length <= slot) workout.station2.push({});
      workout.station2[slot] = { exerciseId: newEx._id, name: newEx.name };
      workout.markModified('station2');
    } else {
      newEx = (await selectExercises(userId, { station: 3, dayType }, 1, usedIds))[0];
      if (!newEx) return res.status(400).json({ error: 'No alternative exercise for this slot' });
      if (!Array.isArray(workout.station3)) workout.station3 = [];
      while (workout.station3.length <= slot) workout.station3.push({});
      workout.station3[slot] = { exerciseId: newEx._id, name: newEx.name };
      workout.markModified('station3');
    }

    await Exercise.updateOne({ _id: newEx._id }, { lastUsed: new Date() });
    await workout.save();

    const populated = await Workout.findById(workout._id)
      .populate('station1.phase1.exerciseId station1.phase2.exerciseId station2.exerciseId station3.exerciseId');
    res.json(populated);
  } catch (error) {
    console.error('PATCH /workouts/:id/regenerate-slot error:', error);
    res.status(400).json({ error: error.message || 'Failed to regenerate slot' });
  }
});

// Update a single exercise slot in a workout
app.patch('/api/workouts/:id/exercise', authenticateToken, async (req, res) => {
  try {
    let id = (req.params.id || '').toString().trim();
    const tokenUserId = req.user.userId;
    let workout = null;
    if (id && id !== 'undefined' && mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      workout = await Workout.findById(id);
    }
    // Fallback: find by week + day when id not found (same week range as GET /workouts/week)
    if (!workout && req.body.dayOfWeek && req.body.weekStartDate) {
      const start = new Date(req.body.weekStartDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      if (!Number.isNaN(start.getTime())) {
        workout = await Workout.findOne({
          userId: tokenUserId,
          dayOfWeek: req.body.dayOfWeek,
          weekStartDate: { $gte: start, $lt: end }
        });
      }
    }
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found. Try refreshing the week.' });
    }
    if (String(workout.userId) !== String(tokenUserId)) {
      return res.status(403).json({ error: "You don't have access to this workout. Try logging in again." });
    }
    const { phase, slotIndex, exerciseId, exerciseName } = req.body;
    const station = Number(req.body.station);
    if (Number.isNaN(station) || station < 1 || station > 3) {
      return res.status(400).json({ error: 'Invalid station (1, 2, or 3)' });
    }
    const slot = Number(slotIndex);
    if (Number.isNaN(slot) || slot < 0 || slot > 2) {
      return res.status(400).json({ error: 'Invalid slotIndex (0, 1, or 2)' });
    }
    if (!exerciseId && (!exerciseName || !String(exerciseName).trim())) {
      return res.status(400).json({ error: 'Provide exerciseId or exerciseName' });
    }

    if (station === 1) {
      if (!workout.station1) workout.station1 = { phase1: [], phase2: [] };
      const ph = phase === 2 ? 'phase2' : 'phase1';
      if (!Array.isArray(workout.station1[ph])) workout.station1[ph] = [];
      const arr = workout.station1[ph];
      while (arr.length < 3) arr.push({ name: '[FILL]', exerciseId: null });
      if (exerciseId) {
        const ex = await Exercise.findOne({ _id: exerciseId, userId: req.user.userId });
        if (!ex) return res.status(400).json({ error: 'Exercise not found' });
        arr[slot] = { exerciseId: ex._id, name: ex.name };
        await Exercise.updateOne({ _id: ex._id }, { lastUsed: new Date() });
      } else {
        const focus = filterToFocus(workout.filter);
        let ex = await Exercise.findOne({
          userId: req.user.userId,
          name: String(exerciseName).trim(),
          station: 1,
          dayType: workout.dayType
        });
        if (!ex) {
          ex = await insertExerciseRaw(req.user.userId, {
            name: String(exerciseName).trim(),
            station: 1,
            dayType: workout.dayType,
            focus
          });
        }
        arr[slot] = { exerciseId: ex._id, name: ex.name };
        await Exercise.updateOne({ _id: ex._id }, { lastUsed: new Date() });
      }
      workout.markModified('station1');
    } else {
      const key = station === 2 ? 'station2' : 'station3';
      if (!Array.isArray(workout[key])) workout[key] = [];
      const arr = workout[key];
      while (arr.length <= slot) arr.push({});
      if (exerciseId) {
        const ex = await Exercise.findOne({ _id: exerciseId, userId: req.user.userId });
        if (!ex) return res.status(400).json({ error: 'Exercise not found' });
        arr[slot] = { exerciseId: ex._id, name: ex.name };
        await Exercise.updateOne({ _id: ex._id }, { lastUsed: new Date() });
      } else {
        const focus = station === 1 ? filterToFocus(workout.filter) : null;
        let ex = await Exercise.findOne({
          userId: req.user.userId,
          name: String(exerciseName).trim(),
          station,
          dayType: workout.dayType
        });
        if (!ex) {
          ex = await insertExerciseRaw(req.user.userId, {
            name: String(exerciseName).trim(),
            station,
            dayType: workout.dayType,
            focus
          });
        }
        arr[slot] = { exerciseId: ex._id, name: ex.name };
        await Exercise.updateOne({ _id: ex._id }, { lastUsed: new Date() });
      }
      workout.markModified(key);
    }

    await workout.save();

    const populated = await Workout.findById(workout._id)
      .populate('station1.phase1.exerciseId station1.phase2.exerciseId station2.exerciseId station3.exerciseId');
    res.json(populated);
  } catch (error) {
    console.error('PATCH /workouts/:id/exercise error:', error);
    const message = error.name === 'CastError' ? 'Invalid workout or exercise ID' : (error.message || 'Failed to update exercise');
    res.status(400).json({ error: message });
  }
});

// Delete workout
app.delete('/api/workouts/:id', authenticateToken, async (req, res) => {
  try {
    const workout = await Workout.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    res.json({ message: 'Workout deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unmatched API routes → JSON 404 (so client never gets HTML)
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// Production: serve React build and SPA fallback
if (process.env.NODE_ENV === 'production') {
  const fs = require('fs');
  const clientDist = path.join(__dirname, '../client/dist');
  if (fs.existsSync(clientDist)) {
    // Serve static files first (JS, CSS, images). index: false so we don't serve index for /
    app.use(express.static(clientDist, { index: false }));
    // SPA fallback: serve index.html only for page-like paths (not /api, not /assets/xxx.js)
    app.get('/{*path}', (req, res) => {
      const p = req.path;
      if (p.startsWith('/api') || p.startsWith('/assets') || /\.[a-z0-9]+$/i.test(p)) {
        return res.status(404).send('Not found');
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    console.warn('Production: client/dist not found. Serve client separately or fix build.');
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
