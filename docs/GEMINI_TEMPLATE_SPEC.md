# SOULBOX workout import – template spec for Gemini

Use this spec so Gemini can convert your Programming Sheet into the exact format the app expects. **Give Gemini this document + your current Excel/CSV**, and ask it to output a new CSV that follows this format.

---

## 1. Output format: one CSV file

- **One header row**, then **one data row per exercise** (no merged cells, no “two days per row”).
- **Comma-separated (CSV)**. If a cell contains a comma, wrap the whole cell in double quotes.
- **Encoding:** UTF-8.
- **File name:** e.g. `WEEK-199-flat.csv` or `WEEK-YYYY-MM-DD-flat.csv`.

---

## 2. Column definitions (exact names and rules)

| Column | Required | Values | Notes |
|--------|----------|--------|--------|
| **weekStartDate** | Yes | Date of the **Sunday** that starts the week, e.g. `2026-01-04` | Same for every row in that week. |
| **dayOfWeek** | Yes | Exactly: `Sunday`, `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Saturday` | No Friday. |
| **dayType** | Yes | Exactly: `Kickboxing`, `Boxing`, `Technique`, `Conditioning` | Use the mapping in section 3. |
| **station** | Yes | `1`, `2`, or `3` | Number only. |
| **phase** | For station 1 only | `1` or `2` | For station 2 and 3 leave **empty**. |
| **slot** | Yes | `A`, `B`, or `C` | Position within the station (1st, 2nd, 3rd). |
| **exerciseName** | Yes | Any text | The exercise name. Use `[FILL]` if the cell is empty. |
| **focus** | Yes | Exactly: `Upper`, `Lower`, or `Mixed` | Use the mapping in section 3. |
| **isStatic** | Yes | `TRUE` or `FALSE` | See section 4 for when to use TRUE. |
| **staticCondition** | Only if isStatic=TRUE | See section 4 | Otherwise leave **empty**. |

---

## 3. Day → dayType and focus (fixed mapping)

**Use this table for every row.** Do not infer from the sheet; the app expects these exact values.

| dayOfWeek | dayType      | focus  |
|-----------|--------------|--------|
| Sunday    | Kickboxing   | Upper  |
| Monday    | Technique    | Mixed  |
| Tuesday   | Boxing       | Upper  |
| Wednesday | Conditioning | Lower  |
| Thursday  | Kickboxing   | Mixed  |
| Saturday  | Technique    | Lower  |

---

## 4. Special rule: “Nonstop sparring” for Station 3

- **When:** Station 3 on **Monday**, **Wednesday**, and **Saturday**.
- **What to write:**  
  - **exerciseName:** exactly `Nonstop sparring`  
  - **isStatic:** `TRUE`  
  - **staticCondition:**  
    - Monday → `technique-station3`  
    - Wednesday → `conditioning-station3`  
    - Saturday → `technique-station3`  
- **How many rows:** **3 rows** for that day’s Station 3, one per slot (A, B, C), all with the same exerciseName, isStatic, and staticCondition.

For **all other** Station 3 rows (Sunday, Tuesday, Thursday), use the actual exercise names from the sheet and set **isStatic** = `FALSE` and **staticCondition** = empty.

---

## 5. Structure of a week (72 rows per week)

- **6 days:** Sunday, Monday, Tuesday, Wednesday, Thursday, Saturday.
- **Per day:** 12 exercises:
  - **Station 1 Phase 1:** 3 rows (slots A, B, C), phase = `1`
  - **Station 1 Phase 2:** 3 rows (slots A, B, C), phase = `2`
  - **Station 2:** 3 rows (slots A, B, C), phase = empty
  - **Station 3:** 3 rows (slots A, B, C), phase = empty
- **Total:** 6 × 12 = **72 rows** per week (plus the header row).

If the original sheet has a blank cell, still output a row and put **exerciseName** = `[FILL]`.

---

## 6. Example header and first rows

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
2026-01-04,Monday,Technique,1,1,A,ATT/DEF,Mixed,FALSE,
…
2026-01-04,Monday,Technique,3,,A,Nonstop sparring,Mixed,TRUE,technique-station3
2026-01-04,Monday,Technique,3,,B,Nonstop sparring,Mixed,TRUE,technique-station3
2026-01-04,Monday,Technique,3,,C,Nonstop sparring,Mixed,TRUE,technique-station3
```

(If an exercise name contains commas, wrap it in double quotes in the CSV, e.g. `"5X HIGH KNEES, 5X SPRINTS"`.)

---

## 7. What to ask Gemini

You can say something like:

- *“I’m attaching our current Programming Sheet Excel/CSV (one week). Convert it into the exact CSV format described in the attached spec (GEMINI_TEMPLATE_SPEC.md). Use the column names, dayType and focus mapping, and Nonstop sparring rules from the spec. Output a single CSV with one header row and 72 data rows per week, with empty cells as [FILL]. Give me the result as a downloadable CSV or paste the contents.”*

If you have **multiple weeks** in one sheet:

- *“Same spec, but I have multiple weeks in this sheet. Output one CSV that contains all weeks: same columns, 72 rows per week, each row with the correct weekStartDate for that week.”*

---

## 8. After Gemini gives you the CSV

1. Save it as e.g. `WEEK-199-flat.csv` (or one file per week).
2. From the project’s `server` folder run:
   ```bash
   npm run import-workouts -- "/path/to/WEEK-199-flat.csv" "ola-reda@hotmail.co.uk"
   ```
3. The app will create/update exercises and workouts for that week; no extra converter script is needed.
