# Second Look

An artist puts together a selection of works, sends one link to a mentor, and gets back keep / maybe / cut on every piece, a note on each, and the order the mentor would show them in.

Built with Claude. React + Vite front end, Supabase for the database and image storage, hosted on Vercel.

---

## Putting it live (about 20 minutes, one time)

### 1. Set up the database in Supabase
1. In your Supabase project, open **SQL Editor** (left sidebar) → **New query**.
2. Open `supabase/setup.sql` from this folder, copy everything, paste it in, and press **Run**.
   You should see "Success. No rows returned."
3. Go to **Project Settings → API** (or **Data API**) and keep two things handy:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string starting with `eyJ`, or `sb_publishable_`)

### 2. Put the code on GitHub
1. Unzip this folder.
2. In your empty GitHub repository, click **uploading an existing file**.
3. Drag in **everything inside** the `second-look` folder (not the folder itself), including `package.json`, `index.html`, `src`, `public` and `supabase`.
4. Press **Commit changes**.

### 3. Deploy on Vercel
1. In Vercel: **Add New → Project** → pick your repository → **Import**.
2. Vercel detects **Vite** automatically. Leave the build settings alone.
3. Open **Environment Variables** and add two:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your anon public key |

4. Press **Deploy**. In about a minute you'll get a link like `second-look.vercel.app`.

If you add or change environment variables later, go to **Deployments → ⋯ → Redeploy**.

### 4. Check it
1. Open your site, start a selection, and upload two or three images.
2. Copy the review link and open it in a private/incognito window, as the mentor would.
3. Mark the works, add notes, press **Send feedback**.
4. Back on the artist page, open the **Feedback** tab.

---

## How privacy works
- There are no accounts. Each selection has two long random links: one for the artist (can edit), one for the mentor (can review only).
- Nobody can list or browse selections. The database tables are locked; every read and write goes through a function that checks the link first.
- The artist doesn't see the mentor's notes until the mentor presses **Send**.
- Images are stored at random addresses. Anyone who has an image's exact address can view it, the same as most image hosting.

## Running it on your own computer (optional)
```
npm install
cp .env.example .env    # then paste your Supabase URL and key into .env
npm run dev
```
