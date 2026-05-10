# Code IDE

> A cloud-native, multi-language online code editor with real-time execution, AI assistance, community snippet sharing, and a freemium monetisation layer — all in a single Next.js application.

---

## Problem & Solution

Developers iterating on ideas or learning new languages are constantly context-switching between editors, REPLs, documentation, and community resources. CodeCraft AI collapses that surface into one experience: write code, execute it instantly against a sandboxed remote runtime, get AI-driven guidance without leaving the editor, and publish or discover reusable snippets — all gated behind a simple authentication + pro-tier model that keeps the platform sustainable.

---

## Architecture & Data Flow

```
┌─────────────────────────────────────────────────────┐
│                   Next.js 15 App                    │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │  Monaco IDE   │  │ AI Asst.  │  │  Snippets   │  │
│  │  (EditorPanel)│  │ (/ai-asst)│  │ (/snippets) │  │
│  └──────┬───────┘  └─────┬──────┘  └──────┬──────┘  │
│         │ Zustand store  │                 │         │
│         └────────────────┘                │         │
│                │                          │         │
│    ┌───────────▼──────────────────────────▼───────┐ │
│    │         /api/execute  (Next.js Route Handler) │ │
│    └──────────────────────┬───────────────────────┘ │
└───────────────────────────│─────────────────────────┘
                            │ server-side proxy
                     ┌──────▼──────┐
                     │  JDoodle API │  (sandboxed execution)
                     └─────────────┘

┌─────────────────────────────────────────────────────┐
│                  Convex Backend                     │
│  ┌───────────┐  ┌────────────┐  ┌────────────────┐  │
│  │  users.ts │  │snippets.ts │  │codeExecutions  │  │
│  │  syncUser │  │ CRUD+Stars │  │ saveExecution  │  │
│  │ upgradePro│  │ Comments   │  │  getUserStats  │  │
│  └─────┬─────┘  └─────┬──────┘  └───────┬────────┘  │
│        │              │                  │           │
│  ┌─────▼──────────────▼──────────────────▼────────┐ │
│  │            Convex Document DB                   │ │
│  │  users | snippets | snippetComments | stars |   │ │
│  │  codeExecutions                                 │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │   http.ts  (Convex HTTP router)              │   │
│  │  POST /clerk-webhook  → syncUser             │   │
│  │  POST /lemon-squeezy-webhook → upgradeToPro  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘

External services
  Clerk  ────────►  Auth + webhook (svix-verified) → Convex
  LemonSqueezy ──►  Payment webhook → upgradeToPro mutation
```

---

## How Components Correlate

**Zustand as the single source of truth for the editor session.**  
`useCodeEditorStore` holds the live Monaco instance, current language, theme, font size, and the last execution result. All three panels — `EditorPanel`, `OutputPanel`, and `RunButton` — subscribe to the same store slice, which means the output panel never polls; it reacts reactively the moment `runCode()` resolves. Crucially, `setCode()` also writes back to `localStorage` keyed by language, so switching languages doesn't erase work-in-progress. This same `code` field is read by the AI Assistant page after a route change, letting the AI see the current editor content without prop drilling or a shared URL.

**Next.js `/api/execute` as a security proxy.**  
The JDoodle credentials (`clientId`/`clientSecret`) are server-side-only env vars, never exposed to the browser. The route handler acts as a thin proxy: it receives the user's code and language, injects the credentials server-side, and forwards the response. This is why execution lives in a Next.js Route Handler rather than being called from Convex — Convex actions are great for data, but the JDoodle call belongs closest to the secret storage.

**Convex for persistence and real-time social features.**  
After a successful execution, `saveExecution` (a Convex mutation) is called; it first checks `isPro` before allowing non-JavaScript runs — making pro-gating a server-side invariant rather than a UI concern. Snippets use three related tables (`snippets`, `snippetComments`, `stars`) with compound indexes (`by_user_id_and_snippet_id`) to make toggle-star O(1). Cascade deletion of comments and stars on snippet delete is handled transactionally inside the mutation, avoiding orphaned records.

**Clerk + Convex webhook pipeline for identity sync.**  
Clerk is the auth provider; Convex owns the application-level user record (with `isPro`). The bridge is a svix-verified webhook: on `user.created`, Clerk POSTs to Convex's HTTP router, which calls `syncUser` to insert the user with `isPro: false`. This decoupled approach means the Next.js app never needs to manually create users — Clerk events drive Convex state asynchronously.

**LemonSqueezy closes the monetisation loop.**  
On `order_created`, LemonSqueezy POSTs a webhook to Convex's HTTP router. After signature verification (via a Convex internal action), `upgradeToPro` patches the user's record. From that point forward, every `saveExecution` mutation enforces the pro language gate server-side. The UI reflects `isPro` by querying the same Convex user record, giving instant consistency with no extra API call.

---

## Key Features

- **Multi-language sandbox** — 10 languages (Python, JavaScript, TypeScript, Java, Go, Rust, C++, C#, Ruby, Swift) executed via JDoodle, with per-language default code and Monaco syntax highlighting.
- **Persistent editor state** — language, theme, font size, and per-language code drafts survive page refreshes through `localStorage`, hydrated into Zustand on mount.
- **AI Assistant integration** — authenticated users navigate to `/ai-assistant` carrying their current editor code (via the shared Zustand store) for context-aware AI help.
- **Community snippet hub** — create, star, comment on, and delete public code snippets with real-time-reactive Convex queries and compound-indexed social graphs.
- **Freemium gate** — free tier is limited to JavaScript; all other languages require a Pro subscription enforced at the Convex mutation layer, not just the client.
- **Webhook-driven identity & payment** — Clerk and LemonSqueezy events propagate into Convex via verified webhooks, keeping user state consistent without polling.
- **Dark-first, animated UI** — Monaco themes, Framer Motion micro-animations, and Tailwind glassmorphism components throughout.

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 RC, Tailwind CSS 3, Framer Motion |
| Code Editor | Monaco Editor (`@monaco-editor/react`) |
| State Management | Zustand 5 |
| Backend / DB | Convex (real-time document store + serverless functions) |
| Authentication | Clerk (`@clerk/nextjs`) |
| Webhook Verification | Svix |
| Code Execution | JDoodle API (remote sandbox) |
| Payments | LemonSqueezy |
| Notifications | react-hot-toast |
| Markdown Rendering | react-markdown + remark-gfm + react-syntax-highlighter |

---

## Project Structure

```
Code IDE/
├── convex/                    # Serverless backend (Convex)
│   ├── schema.ts              # Data model: users, snippets, stars, comments, executions
│   ├── users.ts               # syncUser, getUser, upgradeToPro mutations/queries
│   ├── snippets.ts            # Full CRUD + star/comment operations
│   ├── codeExecutions.ts      # saveExecution (pro-gated), getUserStats
│   ├── http.ts                # Webhook router: /clerk-webhook, /lemon-squeezy-webhook
│   ├── lemonSqueezy.ts        # Webhook signature verification (internal action)
│   └── auth.config.ts         # Clerk JWT config for Convex auth
│
└── src/
    ├── middleware.ts           # Clerk auth middleware (runs on every route)
    ├── store/
    │   └── useCodeEditorStore.ts   # Global editor state (Zustand)
    ├── types/                  # Shared TypeScript interfaces
    ├── hooks/
    │   └── useMounted.ts       # SSR hydration guard
    └── app/
        ├── layout.tsx          # Root layout (ConvexProvider, ClerkProvider, Toaster)
        ├── api/
        │   └── execute/
        │       └── route.ts    # Server-side JDoodle proxy (hides API credentials)
        ├── (root)/             # Main IDE page
        │   ├── _constants/     # LANGUAGE_CONFIG, Monaco theme definitions
        │   └── _components/    # EditorPanel, OutputPanel, RunButton, LanguageSelector, ThemeSelector
        ├── ai-assistant/
        │   └── page.tsx        # AI chat page (reads code from Zustand store)
        ├── snippets/           # Community snippets gallery + detail view
        ├── pricing/            # Pro tier pricing page
        └── profile/            # User profile + execution history
```
