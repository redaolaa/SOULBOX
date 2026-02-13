# SOULBOX – CSV import spec for Gemini

**Download this file and your Programming Sheet, then upload both to Gemini.**  
Copy the "What to tell Gemini" block below into the chat and send.

---

## What to tell Gemini

```
I'm attaching:
1. My Programming Sheet (Excel or CSV) for one week of workouts.
2. This spec file (SOULBOX_Import_Spec_For_Gemini.md).

Convert my Programming Sheet into the exact CSV format described in this spec.

Rules:
- Output a single CSV with this exact header row:
  weekStartDate,dayOfWeek,dayType,station,phase,slot,exerciseName,focus,isStatic,staticCondition
- One row per exercise. 72 data rows per week (6 days × 12 exercises per day). Use the day → dayType and focus table from the spec; do not guess.
- Monday, Wednesday, Saturday, Station 3 only: exerciseName = "Nonstop sparring", isStatic = TRUE, staticCondition = technique-station3 (Mon/Sat) or conditioning-station3 (Wed). Output 3 rows (slots A, B, C) for each.
- Any empty cell → exerciseName = [FILL].
- weekStartDate = the Sunday of that week (e.g. 2026-01-04). Same for all 72 rows. I'll tell you the date if the sheet doesn't show it.
- If a cell contains a comma, wrap it in double quotes in the CSV.

Give me the full CSV (paste the contents or a downloadable file).
```

---

## Full spec (for Gemini)

### 1. Output format

- One header row, then one data row per exercise. Comma-separated (CSV). UTF-8. If a cell contains a comma, wrap it in double quotes.

### 2. Columns (exact names)

| Column | Required | Values |
|--------|----------|--------|
| weekStartDate | Yes | Sunday of the week, e.g. 2026-01-04. Same for all rows in that week. |
| dayOfWeek | Yes | Sunday, Monday, Tuesday, Wednesday, Thursday, Saturday (no Friday) |
| dayType | Yes | Kickboxing, Boxing, Technique, Conditioning — use table below |
| station | Yes | 1, 2, or 3 |
| phase | Station 1 only | 1 or 2. For station 2 and 3 leave empty. |
| slot | Yes | A, B, or C |
| exerciseName | Yes | Exercise text. Use [FILL] if empty. |
| focus | Yes | Upper, Lower, or Mixed — use table below |
| isStatic | Yes | TRUE or FALSE. TRUE only for Mon/Wed/Sat Station 3 (Nonstop sparring). |
| staticCondition | If isStatic=TRUE | technique-station3 (Mon/Sat) or conditioning-station3 (Wed). Otherwise empty. |

### 3. Day → dayType and focus (use exactly)

| dayOfWeek | dayType | focus |
|-----------|---------|--------|
| Sunday | Kickboxing | Upper |
| Monday | Technique | Mixed |
| Tuesday | Boxing | Upper |
| Wednesday | Conditioning | Lower |
| Thursday | Kickboxing | Mixed |
| Saturday | Technique | Lower |

### 4. Nonstop sparring (Station 3 only)

- **Days:** Monday, Wednesday, Saturday.
- **For each:** 3 rows (slots A, B, C) with exerciseName = `Nonstop sparring`, isStatic = `TRUE`, staticCondition = `technique-station3` (Monday/Saturday) or `conditioning-station3` (Wednesday).
- All other Station 3 rows: use actual exercise names, isStatic = FALSE, staticCondition = empty.

### 5. Structure per week

- 6 days × 12 exercises = 72 rows per week.
- Per day: Station 1 Phase 1 (3), Station 1 Phase 2 (3), Station 2 (3), Station 3 (3). Each group has slots A, B, C.

### 6. Example (header + first rows)

```csv
weekStartDate,dayOfWeek,dayType,station,phase,slot,exerciseName,focus,isStatic,staticCondition
2026-01-04,Sunday,Kickboxing,1,1,A,R ISOLATION BICEP CURLS,Upper,FALSE,
2026-01-04,Sunday,Kickboxing,1,1,B,5X HIGH KNEES 5X SPRINTS,Upper,FALSE,
2026-01-04,Sunday,Kickboxing,1,1,C,CHEST FLYS,Upper,FALSE,
2026-01-04,Sunday,Kickboxing,1,2,A,L ISOLATION BICEP CURLS,Upper,FALSE,
2026-01-04,Sunday,Kickboxing,1,2,B,SIT-UP TO 1 2,Upper,FALSE,
2026-01-04,Sunday,Kickboxing,1,2,C,PULLOVERS,Upper,FALSE,
2026-01-04,Sunday,Kickboxing,2,,A,1 2 FRONT KICK SIDEKICK,Upper,FALSE,
2026-01-04,Sunday,Kickboxing,2,,B,1 2 STEP BK SPINNING KICK,Upper,FALSE,
2026-01-04,Sunday,Kickboxing,2,,C,FREESTYLE,Upper,FALSE,
2026-01-04,Sunday,Kickboxing,3,,A,ATT/DEF,Upper,FALSE,
2026-01-04,Sunday,Kickboxing,3,,B,LIGHT SPARRING,Upper,FALSE,
2026-01-04,Sunday,Kickboxing,3,,C,HIP STRETCH,Upper,FALSE,
2026-01-04,Monday,Technique,3,,A,Nonstop sparring,Mixed,TRUE,technique-station3
2026-01-04,Monday,Technique,3,,B,Nonstop sparring,Mixed,TRUE,technique-station3
2026-01-04,Monday,Technique,3,,C,Nonstop sparring,Mixed,TRUE,technique-station3
```

---

## After you get the CSV from Gemini

1. Save it as e.g. `WEEK-199-flat.csv`.
2. In terminal, from the project `server` folder:
   ```bash
   npm run import-workouts -- "/path/to/WEEK-199-flat.csv" "ola-reda@hotmail.co.uk"
   ```
