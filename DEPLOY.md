# Deploy SOULBOX so others can use it

Once deployed, anyone can open the link in their browser (phone or laptop). Follow these steps.

---

## 1. Create a free MongoDB database (Atlas)

1. Go to **https://www.mongodb.com/cloud/atlas** and sign up (free).
2. Create a **free cluster** (M0).
3. Create a database user: **Database Access** → Add New User → username + password (save them).
4. Allow access: **Network Access** → Add IP Address → **Allow Access from Anywhere** (`0.0.0.0/0`).
5. Get the connection string: **Database** → **Connect** → **Connect your application** → copy the URI.  
   It looks like: `mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/`  
   Replace `USERNAME` and `PASSWORD` with your DB user. Add a database name:  
   `mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/soulbox`  
   **Save this** — you’ll paste it into Render.

---

## 2. Deploy the app on Render

1. Go to **https://render.com** and sign up (use “Sign up with GitHub” and choose your account).
2. **New +** → **Web Service**.
3. Connect the **redaolaa/SOULBOX** repo (authorize Render if asked).
4. Use these settings:

   | Field | Value |
   |-------|--------|
   | **Name** | `soulbox` (or any name) |
   | **Region** | Choose closest to you |
   | **Root Directory** | *(leave blank)* |
   | **Runtime** | Node |
   | **Build Command** | `npm run install:all && npm run build` |
   | **Start Command** | `cd server && node index.js` |

5. Click **Advanced** and add **Environment Variables**:

   | Key | Value |
   |-----|--------|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | *(paste your Atlas URI, e.g. `mongodb+srv://...mongodb.net/soulbox`)* |
   | `JWT_SECRET` | *(any long random string, e.g. run in Terminal: `openssl rand -base64 32` and paste the result)* |

6. Click **Create Web Service**. Render will build and deploy (first time can take a few minutes).

7. When it’s done, you’ll see a URL like **https://soulbox-xxxx.onrender.com**. That’s your app.

---

## 3. Share the link

- Send **https://soulbox-xxxx.onrender.com** to whoever should use it.
- They open it in their browser (Chrome, Safari, etc.) on their laptop or phone — no install needed.
- They can **Register** to create an account and use the app.

---

## Notes

- **Free tier:** Render free services spin down after ~15 min of no use; the first visit after that may take 30–60 seconds to wake up.
- **Data:** All data is stored in your MongoDB Atlas database. The trial user you created locally is only on your laptop; production starts with an empty DB until people register.
- **Custom domain (optional):** In Render, go to your service → **Settings** → **Custom Domain** to add your own URL.
