# Before MNAI (bmnai)

AI chat app powered by **MNAI 9** (xKiro `mistralai/mistral-large-4-0` via server proxy).

- `index.html` — app shell: sidebar, sign-in gate, offline notice, hero/new-chat, chat view
- `styles.css` — full styling, responsive breakpoints, animations
- `app.js` — Firebase auth, Firestore chat sync, MNAI 9 calls, markdown+table rendering
- `firebase-init.js` — Firebase web init (config is public-by-design)
- `api/chat.js` — Vercel serverless proxy to xKiro. Key comes from the
  `XKIRO_API_KEY` env var only — never in code.
- `adminp.html` / `adminp.js` — owner-only page (`/adminp`) to activate/deactivate
  the site and set the offline message. First signed-in user claims ownership.
- `firestore.rules` — publish in Firebase console (see below)
- `avatar.png` — default avatar

Live: https://bmnai.vercel.app · Admin: https://bmnai.vercel.app/adminp

## Owner setup (Firebase project `notfelixx-b7d92`)
1. Authentication → Sign-in method → enable **Google**
2. Authentication → Settings → Authorized domains → add `bmnai.vercel.app`
3. Firestore Database → Create database (production mode)
4. Firestore → Rules → paste `firestore.rules` → Publish

## Owner setup (Vercel project `bmnai`)
1. Settings → Environment Variables → add `XKIRO_API_KEY` (production)
2. Redeploy
