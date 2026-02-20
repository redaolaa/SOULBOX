# SOULBOX - Boxing Coach Exercise Management System

A full-stack web application to help boxing coaches manage and generate workout plans with automatic exercise rotation and 4-week non-repetition rules.

## Features

- **User Authentication**: Secure login/registration for coaches
- **Calendar View**: Weekly workout calendar with day-by-day management
- **Automatic Workout Generation**: Generates workouts based on day type and focus
- **4-Week Rule**: Exercises won't repeat for at least 4 weeks
- **Exercise Library**: Manage your exercise database with filtering
- **Static Exercises**: Handles consistent exercises (e.g., "Non-stop Sparring")
- **Multi-Station Workouts**: 
  - Station 1: Conditioning (Tri-Sets with Phase 1 & Phase 2)
  - Station 2: Bag Work (3 Combos)
  - Station 3: Technique (Partner Drills)

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Express.js
- **Database**: MongoDB
- **Authentication**: JWT

## Setup Instructions

### Prerequisites

- Node.js (v20.16.0 or higher)
- MongoDB (local or MongoDB Atlas)

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd SOULBOX
   ```

2. **Install server dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies:**
   ```bash
   cd ../client
   npm install
   ```

4. **Set up environment variables:**

   Create a `.env` file in the `server` directory:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/soulbox
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   ```

   For MongoDB Atlas, use:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/soulbox
   ```

### Running the Application

1. **Start the backend server:**
   ```bash
   cd server
   npm start
   ```
   Or with nodemon for development:
   ```bash
   npm install -g nodemon
   nodemon index.js
   ```

2. **Start the frontend (in a new terminal):**
   ```bash
   cd client
   npm run dev
   ```

3. **Access the application:**
   - Frontend: http://localhost:5173 (or the port Vite assigns)
   - Backend API: http://localhost:3000

## Usage Guide

### First Time Setup

1. **Register an Account:**
   - Click "Register" on the login page
   - Enter your username, email, password, and name
   - You'll be automatically logged in

2. **Add Exercises:**
   - Navigate to "Exercises" in the navbar
   - Click "+ Add Exercise"
   - Fill in the exercise details:
     - **Name**: Exercise name (e.g., "Shoulder Press")
     - **Station**: 1 (Conditioning), 2 (Bag Work), or 3 (Technique)
     - **Focus**: Upper Body, Lower Body, Mixed, or Full Body
     - **Day Type**: Kickboxing, Boxing, Technique, or Conditioning
     - **Static Exercise**: Check if it's a consistent exercise (e.g., "Non-stop Sparring")
     - **Static Condition**: For Station 3 static exercises, select the condition

3. **Generate Workouts:**
   - Go to "Calendar" view
   - Navigate to the week you want
   - Click "Generate" on individual days or "Generate Full Week" for all days
   - Click on a day card to view the full workout

### Day Configuration

The app automatically configures each day:

- **Sunday**: Kickboxing, Upper Body
- **Monday**: Technique, Mixed/Full Body
- **Tuesday**: Boxing, Upper Body
- **Wednesday**: Conditioning, Lower Body
- **Thursday**: Kickboxing, Mixed/Full Body
- **Friday**: Technique, Lower Body
- **Saturday**: Conditioning, Lower Body

### Exercise Rules

- **4-Week Rule**: Exercises won't be selected if used within the last 4 weeks
- **Static Exercises**: Station 3, Exercise B is always "Non-stop Sparring" on Kickboxing and Boxing days (if configured)
- **Station 1**: Has two phases (Phase 1 and Phase 2) that are different exercises
- **Filtering**: Exercises are filtered by day type and focus automatically

## Project Structure

```
SOULBOX/
├── server/
│   ├── models/
│   │   ├── User.js          # User/Coach model
│   │   ├── Exercise.js      # Exercise model
│   │   └── Workout.js       # Workout model
│   ├── index.js             # Express server & routes
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── Calendar.jsx
│   │   │   ├── WorkoutView.jsx
│   │   │   └── ExerciseManager.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── utils/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Exercises
- `GET /api/exercises` - Get all exercises (user's)
- `POST /api/exercises` - Create exercise
- `PUT /api/exercises/:id` - Update exercise
- `DELETE /api/exercises/:id` - Delete exercise

### Workouts
- `POST /api/workouts/generate` - Generate workout for a day
- `POST /api/workouts/generate-week` - Generate full week
- `GET /api/workouts/week` - Get workouts for a week
- `GET /api/workouts` - Get all workouts
- `GET /api/workouts/:id` - Get workout by ID
- `DELETE /api/workouts/:id` - Delete workout

## Tips for Beginners

1. **Start Small**: Add a few exercises first to test the system
2. **Test Workout Generation**: Generate a workout for one day first before generating a full week
3. **Check Exercise Library**: Make sure you have enough exercises in each category (Station 1, 2, 3) for each day type
4. **Static Exercises**: Remember to add "Non-stop Sparring" as a static exercise for Station 3, position B on Kickboxing and Boxing days

## Deployment

The app can be deployed as a single service (Node server serves the built React app). Use **MongoDB Atlas** for the database in production.

### Option A: Render (recommended)

1. **MongoDB Atlas**
   - Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas), then get the connection string (e.g. `mongodb+srv://...`).

2. **Render**
   - Go to [render.com](https://render.com) → New → Web Service.
   - Connect your repo (e.g. GitHub).
   - **Build command:** `npm run install:all && npm run build`  
     (or `npm ci` in root if you add a root `package-lock.json`, then `cd client && npm ci && npm run build`).
   - **Start command:** `cd server && npm start`  
     (or from repo root: `NODE_ENV=production node server/index.js` after building the client into `client/dist`).
   - **Environment variables** (in Render dashboard):
     - `NODE_ENV` = `production`
     - `MONGODB_URI` = your Atlas connection string
     - `JWT_SECRET` = a long random string (e.g. `openssl rand -base64 32`)
   - **Important:** So the server can serve the frontend, the client must be built in CI. Use:
     - **Build:** `npm run install:all && npm run build`  
     - **Start:** `NODE_ENV=production node server/index.js`  
     and set **Root Directory** to blank (repo root). If Render runs the start command from repo root, the server will find `client/dist` (built in the Build step).

   If Render runs the start command from repo root, use **Start command:** `npm run build && npm start` so the build runs on the same machine that serves. Otherwise use a two-step Build command that leaves `client/dist` in place, then Start: `npm start` (which runs `cd server && npm start`). Adjust so that when `node server/index.js` runs, the current working directory is the repo root (e.g. **Start command:** `cd server && node index.js` and ensure **Build command** runs from root and outputs to `client/dist`). Simplest: **Build:** `npm run install:all && npm run build` and **Start:** `cd server && node index.js`; then the server runs from `server/`, so `__dirname` is `server/` and `../client/dist` is correct.

3. Deploy. Your app URL will be something like `https://soulbox-xxx.onrender.com`.

### Option B: Railway

1. **MongoDB Atlas** (same as above).
2. **Railway:** [railway.app](https://railway.app) → New Project → Deploy from GitHub.
3. **Settings:** Add env vars `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`.
4. **Build:** Root directory = repo root. Build command: `npm run install:all && npm run build`. Start: `cd server && node index.js` (or use the root `npm start` if it runs from root and the server still sees `client/dist`).  
   If Railway runs start from root: **Start command:** `npm start` (runs `cd server && npm start`; the `cd server` is from root, so `client/dist` is at `./client/dist` relative to root; when Node runs `server/index.js`, `__dirname` is `.../server`, so `../client/dist` is correct).

### Option C: Docker

From the repo root:

```bash
docker build -t soulbox .
docker run -p 3000:3000 -e MONGODB_URI="your-atlas-uri" -e JWT_SECRET="your-secret" soulbox
```

Set `NODE_ENV=production` in the image (already set in Dockerfile). For production, use a proper secrets mechanism instead of `-e`.

### Production checklist

- [ ] MongoDB Atlas cluster created and connection string copied.
- [ ] `MONGODB_URI` and `JWT_SECRET` set in the host (Render/Railway/Docker); never commit `.env` with real secrets.
- [ ] Build step produces `client/dist`; start command runs the Node server so it can serve `../client/dist` (e.g. from `server/` with `node index.js`).

## Troubleshooting

- **MongoDB Connection Error**: Make sure MongoDB is running locally or your Atlas connection string is correct
- **Port Already in Use**: Change the PORT in `.env` or kill the process using port 3000
- **No Exercises Available**: Add more exercises to your library, especially for the day type you're trying to generate
- **CORS Errors**: Make sure the frontend proxy is configured correctly in `vite.config.js`

## Future Enhancements

- Shuffle button for workouts
- Exercise history tracking
- Export workouts to PDF
- Mobile app version
- Multiple coach support with shared exercises

## License

This project is for personal/educational use.
