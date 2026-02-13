# Quick Start Guide

## Step 1: Start MongoDB

Make sure MongoDB is running on your system:
- **Local MongoDB**: Just make sure the service is running
- **MongoDB Atlas**: Copy your connection string

## Step 2: Configure Environment

Create a `.env` file in the `server` folder:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/soulbox
JWT_SECRET=change-this-to-a-random-secret-key
```

## Step 3: Start the Backend

```bash
cd server
npm start
```

You should see: `Server running on http://localhost:3000`

## Step 4: Start the Frontend

Open a new terminal:

```bash
cd client
npm run dev
```

You should see: `Local: http://localhost:5173`

## Step 5: Use the App

1. Open http://localhost:5173 in your browser
2. Click "Register" to create an account
3. Add exercises in the "Exercises" tab
4. Go to "Calendar" and generate workouts!

## Adding Your First Exercises

Here are some example exercises to get you started:

### Station 1 (Conditioning) - Upper Body
- Shoulder Press
- Frontal Raises
- Infinity Circles
- Lateral Raises
- Reverse Flys
- Weighted 1,2s

### Station 1 (Conditioning) - Lower Body
- Squats
- Lunges
- Leg Press
- Calf Raises
- Deadlifts
- Box Jumps

### Station 2 (Bag Work)
- 1,2,2XKNEE
- 1,2, L Low kick, 3, FAKE low kick, spinning back fist
- Low body, high kick
- Jab-Cross-Hook
- Uppercut combinations

### Station 3 (Technique)
- Partner att/def bodykick/throw, spinning fast
- Partner light sparring
- Sidekick technique
- **Non-stop Sparring** (mark as Static for Kickboxing/Boxing days)

## Tips

- Add at least 10-15 exercises per station/day type combination for best results
- The 4-week rule means exercises won't repeat for 4 weeks
- Static exercises (like "Non-stop Sparring") will always appear in the same position
- You can regenerate individual days or entire weeks
