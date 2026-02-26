---
name: LLM Builder Company Website
overview: Add a fully standalone marketing website in `website/` at the workspace root using Next.js 14 and Tailwind CSS (NEXUSSCI-style). It does not use any part of llm-builder (no shared API or code). The site has its own auth and, when logged in, lets users download the packaged llm-builder (full package).
todos: []
isProject: false
---

# LLM Builder Company Website



## Scope

- **New folder:** [website/](website/) at the **workspace root** — **fully standalone** Next.js app (company/marketing site). No imports, API calls, or shared code with llm-builder.
- **No llm-builder dependency:** Website does not call the llm-builder backend, use its frontend, or read its docs/code. All copy and behavior are self-contained in the website.
- **Separate auth:** Firebase Authentication with **Google Sign-In**; user details stored in **Firebase** (Firestore). Website user accounts are independent of any llm-builder app users.
- **Download (logged-in only):** When authenticated, the user sees the **Docker command** (e.g. `docker pull ...` or `docker run ...`) to get/run the packaged llm-builder. The website only gates access to this content; it does not serve a file.

---

## Reference design (look and feel)

Use this image as the visual reference for the website’s look and feel (NEXUSSCI-style landing page: hero, waves, three cards, header with Log In / Sign Up).

Website reference design

- **Image file:** [llm-builder/docs/website-reference.png](llm-builder/docs/website-reference.png) (in repo for implementers).

---

## Design direction (from your sample)

- **Palette:** White and light gray backgrounds; light blue gradients/waves; vibrant blue for primary CTAs; dark blue for one feature card.
- **Layout:** Sticky header (logo, nav, Log In / Sign Up); large hero with headline and “Get Started”; three horizontal cards below (feature, stat, testimonial/review).
- **Elements:** Rounded corners on buttons and cards; abstract wave SVG or CSS for hero background; clear typography hierarchy; icons (user, arrow, play, plus, shield) where appropriate.

---

## Tech stack

- **Next.js 14** (App Router), **React 18**, **TypeScript**
- **Tailwind CSS** for styling
- **Auth & user storage:** **Firebase** — Firebase Authentication with **Google Sign-In**; user details (profile, etc.) stored in **Firestore**. No connection to llm-builder backend.

---

## Site structure and pages


| Route         | Purpose                                                                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`           | Landing: hero, value prop, three cards, CTA                                                                                                          |
| `/how-to-use` | How to use (standalone copy; no imports from llm-builder docs)                                                                                       |
| `/why-use`    | Why use: self-hosted, RAG, deployments, chat (standalone copy)                                                                                       |
| `/about`      | About the project/company                                                                                                                            |
| `/contact`    | Contact form; **store submissions in Firebase** (e.g. Firestore collection `contacts` or `inquiries`).                                               |
| `/register`   | Create account — Firebase (e.g. Google Sign-In; optional email/password)                                                                             |
| `/login`      | Log in — Firebase Google Sign-In (and optional email/password)                                                                                       |
| `/download`   | **Protected:** only when logged in; **show the Docker command** (e.g. `docker pull ...` / `docker run ...`). Redirect to login if not authenticated. |


**Auth flow:** Sign in with Google (and optionally email/password) via Firebase Auth; optionally sync user profile to Firestore. Protect `/download` with middleware or a guard that requires an authenticated Firebase user. No llm-builder API involved.

---

## Implementation outline

### 1. Bootstrap `website/`

- `npx create-next-app@14` in `website/` at the workspace root with TypeScript, Tailwind, App Router, no src dir.
- Set dev port to **3001** in `package.json` (`"dev": "next dev -p 3001"`) so it doesn’t clash with the main frontend.
- No references to llm-builder backend or frontend; no CORS or backend changes anywhere in the repo.

### 2. Global layout and design system

- **Layout:** Root layout with shared header (logo “LLM Builder”, nav: About, How to use, Why use, Contact; right: Log In, Sign Up — or “Account” / “Download” when logged in) and footer.
- **Tailwind:** Customize `tailwind.config` with a small palette (e.g. primary blue, light blue, gray) and shared rounded corners; optional SVG wave component or gradient for hero.
- **Components:** Reusable `Button`, `Card`, and optional `WaveBackground` for the hero.

### 3. Landing page (`/`)

- Hero: Headline (e.g. “Your AI partner for self-hosted RAG and chat”), optional subtext, “Get Started” CTA (links to register or app).
- Optional decorative wave/abstract background (SVG or CSS).
- Three cards: (1) Feature — e.g. “RAG, models, deployments” with CTA “Learn more”; (2) Stat — e.g. “Self-hosted” or similar; (3) Social proof — “See how to use” or “Reviews” with link.
- Match the sample’s structure and spacing; avoid exact copy of NEXUSSCI text.

### 4. Content pages

- **How to use:** Standalone copy describing how to use the product (start app, register, knowledge bases, models, deployments, chat). Written for the website only; no imports or reads from llm-builder docs.
- **Why use:** Standalone bullet points or short sections: self-hosted, privacy, RAG, model registry, deployments, chat.
- **About:** Short project/company description and goals.
- **Contact:** Contact form; **store submissions in Firebase** (Firestore). On submit, write to a collection (e.g. `contacts` or `inquiries`) with fields such as name, email, message, createdAt. Use Firestore client from the app (with security rules allowing authenticated or app write as needed).

### 5. Auth with Firebase (Google Sign-In, Firestore for user details)

- **Firebase setup:** Create a Firebase project; enable **Authentication** (Google provider and optionally Email/Password). Enable **Firestore** for user profile/details. Add Firebase config to the website via env (e.g. `NEXT_PUBLIC_FIREBASE_`*).
- **Libraries:** `firebase` (Firebase JS SDK) in the app for Auth and Firestore (`firebase/auth`, `firebase/firestore`).
- **Google Sign-In:** On `/login` and `/register`, offer "Sign in with Google"; use `signInWithPopup` or `signInWithRedirect`. On first sign-in, optionally create or update a Firestore document with user details (e.g. `users/{uid}`: displayName, email, photoURL, createdAt).
- **Optional:** Email/password sign-up on `/register` and sign-in on `/login` for users who prefer not to use Google.
- **Logout:** Call Firebase `signOut`; redirect to `/`.
- **Auth state:** Use `onAuthStateChanged` in a React context or provider; expose `user` and `isAuthenticated` for header and route protection. Persist auth state via Firebase's built-in persistence (e.g. `browserLocalPersistence`).
- **Protected routes:** Middleware or a guard that checks Firebase auth before allowing access to `/download`. Redirect unauthenticated users to `/login?next=/download`.
- **Register:** Form (email, password, full name) → website’s register endpoint; on success redirect to login or auto-login and then to `/download` or home.
- **Login:** Form (email, password) → website’s login; set session; redirect to `/download` or home.
- **Logout:** Clear session and redirect to `/`.
- **Auth state:** NextAuth session or a React context that reads session/cookie and exposes `user` and `isAuthenticated` for header and route protection. No calls to llm-builder.

### 6. Protected Download page

- **Route:** `/download`.
- **Guard:** If not authenticated (website auth), redirect to `/login` (e.g. with `?next=/download`).
- **Content when logged in:** **Show the Docker command** so the user can pull/run the packaged llm-builder. Display the command clearly (e.g. in a code block or copyable snippet), e.g. `docker pull <image>:<tag>` and/or `docker run ...`. The command text can come from env (e.g. `NEXT_PUBLIC_DOCKER_IMAGE`, `NEXT_PUBLIC_DOCKER_RUN_CMD`) or be hardcoded. No file download or ZIP; the page only reveals the command to authenticated users.

### 7. Header behavior

- Logged out: show “Log In”, “Sign Up”.
- Logged in: show “Download” (link to `/download`) and “Log out” (or account dropdown).
- Use the same header across all pages (root layout).

### 8. Responsiveness and polish

- Responsive nav (e.g. hamburger on small screens).
- Ensure buttons and cards match the intended look (rounded, clear hierarchy).
- Optional: subtle shadows and hover states for cards and CTAs.

---

## File and port summary

- **New only:** `website/` at the workspace root (full Next.js app: `app/`, `components/`, `lib/`, Firebase config and auth context, Tailwind config, etc.). No changes to any existing llm-builder files (no backend, no frontend, no docs).
- **Environment:** Firebase config in `.env.local` (e.g. `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`; Firestore optional if using same project).
- **Ports:** Website **3001**; no dependency on llm-builder ports.

---

## Optional later

- Packaging script or CI step that produces the Docker image (or llm-builder package) referenced in the Docker command.
- Firestore security rules for `contacts`/`inquiries` (e.g. allow create from client; restrict read to admin).
- Analytics or cookie consent if required.

