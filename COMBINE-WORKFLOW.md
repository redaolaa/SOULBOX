# Combine local + Render (shebtini) later

**Workflow:** You work locally. Shebtini works on the Render app. When you want to combine their data, use one of the scripts below.

---

## Option 1 – Combine into Render (add your new stuff to her account)

Use when you want her Render account to have any **new exercises** you added locally, **without** removing or changing what she already has.

```bash
cd server
MONGODB_URI_ATLAS="mongodb+srv://soulboxuser:Soulbox123!@cluster0.mhqm0ll.mongodb.net/soulbox?appName=Cluster0" node scripts/mergeLocalTrialIntoAtlas.js shebtinitrial@trial.com
```

- Her existing data on Atlas is **not** changed.
- Exercises from your **local trial** user that she doesn’t already have (same name + station + day type) are **added** to her account.

---

## Option 2 – Combine into local (get her current state)

Use when you want your **local trial** user to be a full copy of what she has on Render (including her edits). This **replaces** local trial’s data with her Atlas data.

```bash
cd server
MONGODB_URI_ATLAS="mongodb+srv://soulboxuser:Soulbox123!@cluster0.mhqm0ll.mongodb.net/soulbox?appName=Cluster0" node scripts/copyAtlasUserToLocal.js shebtinitrial@trial.com
```

- Local trial user gets: her exercises, workouts, and tri-sets from Atlas.
- Replace the `MONGODB_URI_ATLAS` value with your real Atlas connection string if it’s different.

---

## Quick reference

| Goal | Script |
|------|--------|
| Add your local trial’s new exercises to her Render account (keep her edits) | `mergeLocalTrialIntoAtlas.js shebtinitrial@trial.com` |
| Replace local trial with her current Render data | `copyAtlasUserToLocal.js shebtinitrial@trial.com` |
