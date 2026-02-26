# LLM Builder Company Website

Standalone marketing website for LLM Builder: landing page, how-to-use, why-use, about, contact (Firebase), and protected download (Docker command) for logged-in users.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Firebase**

   - Create a [Firebase project](https://console.firebase.google.com).
   - Enable **Authentication** → **Google** (and optionally Email/Password).
   - Enable **Firestore** (for user profiles and contact form submissions).
   - Copy the project config and create `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

   Fill in:

   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

   Optional (for `/download`):

   - `NEXT_PUBLIC_DOCKER_IMAGE` – e.g. `your-registry/llm-builder:latest`
   - `NEXT_PUBLIC_DOCKER_RUN_CMD` – full `docker run ...` command

3. **Run**

   ```bash
   npm run dev
   ```

   Opens at **http://localhost:3001** (port 3001 to avoid clashing with the main LLM Builder app on 3000).

## Build

```bash
npm run build
npm start
```

## Pages

- `/` – Landing (hero, three cards)
- `/about` – About
- `/how-to-use` – How to use
- `/why-use` – Why use
- `/contact` – Contact form (submissions stored in Firestore `contacts`)
- `/register` – Create account (Google Sign-In)
- `/login` – Log in (Google Sign-In)
- `/download` – Protected; shows Docker command when logged in
