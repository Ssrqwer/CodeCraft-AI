# 💻 CodeCraft AI — Code IDE

> A cloud-native, multi-language online IDE with real-time sandboxed execution, AI assistance, community snippet sharing, and a freemium monetisation layer — all in a single Next.js application.

---

## 🎯 Problem & Solution

Developers iterating on ideas or learning new languages are constantly context-switching between editors, REPLs, documentation, and community resources. CodeCraft AI collapses that entire surface into one experience — write code, execute it instantly in a sandboxed runtime, get AI-driven guidance without leaving the editor, and publish or discover reusable snippets. A clean auth + pro-tier model keeps the platform sustainable, with all business rules enforced server-side.

---

## 🏗️ Architecture & Data Flow

```
┌─────────────────────────────────────────────────────┐
│                   Next.js 15 App                    │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │  Monaco IDE  │  │ AI Asst.  │  │  Snippets   │  │
│  │ (EditorPanel)│  │(/ai-asst) │  │ (/snippets) │  │
│  └──────┬───────┘  └─────┬─────┘  └──────┬──────┘  │
│         │   Zustand store │               │         │
│         └─────────────────┘               │         │
│                 │                         │         │
│    ┌────────────▼─────────────────────────▼───────┐ │
│    │      /api/execute  (Next.js Route Handler)    │ │
│    │    server-side proxy — credentials hidden     │ │
│    └─────────────────────┬─────────────────────────┘ │
└─────────────────────────-│──────────────────────────┘
                           │ HTTP
                    ┌──────▼──────┐
                    │ JDoodle API │  (sandboxed execution)
                    └─────────────┘

┌─────────────────────────────────────────────────────┐
│                  Convex Backend                     │
│  ┌───────────┐  ┌────────────┐  ┌────────────────┐  │
│  │ users.ts  │  │snippets.ts │  │codeExecutions  │  │
│  │ syncUser  │  │ CRUD+Stars │  │ saveExecution  │  │
│  │upgradePro │  │  Comments  │  │ getUserStats   │  │
│  └─────┬─────┘  └─────┬──────┘  └───────┬────────┘  │
│        │              │                  │           │
│  ┌─────▼──────────────▼──────────────────▼────────┐ │
│  │                Convex Document DB               │ │
│  │  users | snippets | snippetComments | stars |   │ │
│  │  codeExecutions                                 │ │
│  └─────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────┐   │
│  │  http.ts  (Convex HTTP router)               │   │
│  │  POST /clerk-webhook  → syncUser             │   │
│  │  POST /lemon-squeezy-webhook → upgradeToPro  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘

External services
  Clerk        ──►  Auth + svix-verified webhook → syncUser
  LemonSqueezy ──►  Payment webhook → upgradeToPro mutation
```

---

## 🔗 How Components Correlate

**🗂️ Zustand — single source of truth for the editor session**
`useCodeEditorStore` holds the live Monaco instance, language, theme, font size, and the last execution result. `EditorPanel`, `OutputPanel`, and `RunButton` all subscribe to the same store slice — the output panel never polls, it reacts the moment `runCode()` resolves. `setCode()` also writes to `localStorage` keyed by language, so switching languages never erases work-in-progress. That same `code` field is read by the AI Assistant page on route change — no prop drilling, no shared URL.

**🔒 `/api/execute` as a security proxy**
JDoodle credentials (`clientId`/`clientSecret`) are server-side-only env vars, never sent to the browser. The route handler injects them server-side and proxies the response. Execution intentionally lives in a Next.js Route Handler rather than Convex — Convex actions excel at data, but secrets belong closest to the secret store.

**⚡ Convex — persistence, real-time queries, and business rule enforcement**
After a successful run, `saveExecution` checks `isPro` before allowing non-JavaScript executions — making the pro-gate a server-side invariant, not a UI concern. Snippets use three related tables with compound indexes (`by_user_id_and_snippet_id`) making toggle-star O(1). Cascade deletion of comments and stars on snippet delete is handled transactionally inside the mutation — no orphaned records.

**🪝 Clerk + Convex webhook pipeline**
Clerk is the auth provider; Convex owns the application user record (including `isPro`). On `user.created`, Clerk sends a svix-verified POST to Convex's HTTP router, which calls `syncUser` with `isPro: false`. The Next.js app never manually creates users — Clerk events drive Convex state asynchronously.

**💳 LemonSqueezy closes the monetisation loop**
On `order_created`, LemonSqueezy POSTs to Convex's HTTP router. After signature verification, `upgradeToPro` patches the user record. Every subsequent `saveExecution` call enforces the gate server-side, and the UI reflects the change instantly by querying the same Convex record — no extra API call needed.

---

## ✨ Key Features

- 🌐 **Multi-language sandbox** — 10 languages (Python, JavaScript, TypeScript, Java, Go, Rust, C++, C#, Ruby, Swift) via JDoodle, with per-language default code and Monaco syntax highlighting
- 💾 **Persistent editor state** — language, theme, font size, and per-language code drafts survive refreshes via `localStorage`, hydrated into Zustand on mount
- 🤖 **AI Assistant integration** — authenticated users navigate to `/ai-assistant` carrying their current editor code via the shared Zustand store for zero-friction context handoff
- 🌍 **Community snippet hub** — create, star, comment on, and delete public snippets with real-time Convex queries and compound-indexed social graphs
- 🔐 **Freemium gate** — free tier locked to JavaScript; all other languages require Pro, enforced at the Convex mutation layer not the client
- 🪝 **Webhook-driven identity & payments** — Clerk and LemonSqueezy events flow into Convex via verified webhooks, keeping state consistent without polling
- 🎨 **Dark-first, animated UI** — Monaco themes, Framer Motion micro-animations, and Tailwind glassmorphism throughout

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 RC · Tailwind CSS 3 · Framer Motion |
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

## 📁 Project Structure

```
Code IDE/
├── convex/                        # Serverless backend (Convex)
│   ├── schema.ts                  # Data model: users, snippets, stars, comments, executions
│   ├── users.ts                   # syncUser, getUser, upgradeToPro mutations/queries
│   ├── snippets.ts                # Full CRUD + star/comment operations
│   ├── codeExecutions.ts          # saveExecution (pro-gated), getUserStats
│   ├── http.ts                    # Webhook router: /clerk-webhook, /lemon-squeezy-webhook
│   ├── lemonSqueezy.ts            # Webhook signature verification (internal action)
│   └── auth.config.ts             # Clerk JWT config for Convex auth
│
└── src/
    ├── middleware.ts               # Clerk auth middleware (runs on every route)
    ├── store/
    │   └── useCodeEditorStore.ts  # Global editor state (Zustand)
    ├── types/                     # Shared TypeScript interfaces
    ├── hooks/
    │   └── useMounted.ts          # SSR hydration guard
    └── app/
        ├── layout.tsx             # Root layout (ConvexProvider, ClerkProvider, Toaster)
        ├── api/execute/route.ts   # Server-side JDoodle proxy
        ├── (root)/                # Main IDE page
        │   ├── _constants/        # LANGUAGE_CONFIG, Monaco theme definitions
        │   └── _components/       # EditorPanel, OutputPanel, RunButton, Selectors
        ├── ai-assistant/page.tsx  # AI chat (reads code from Zustand store)
        ├── snippets/              # Community gallery + detail view
        ├── pricing/               # Pro tier pricing page
        └── profile/               # User profile + execution history
```
