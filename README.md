# 🚀 CodeCraft AI

> A cloud-native developer platform — Monaco-powered multi-language IDE, real-time sandboxed execution, community snippet sharing, freemium monetisation, and a purpose-built AI intelligence service — unified in a single monorepo.

---

## 🎯 What It Is

Developers iterating on ideas or learning new languages are constantly context-switching between editors, REPLs, documentation, AI chat tools, and community resources. CodeCraft AI collapses that entire surface into one experience — write code, run it instantly in a remote sandbox, get AI-driven guidance without ever leaving the editor, then publish or discover reusable snippets. A clean auth + pro-tier model keeps the platform sustainable, with every business rule enforced server-side.

The platform is structured as two cohesive subsystems in a single monorepo:

| Subsystem | Role |
|---|---|
| **Code IDE** (`Code IDE/`) | Next.js 15 frontend + Convex backend — editor, execution, social features, auth, payments |
| **AI Service** (`AI-code-assistant/`) | FastAPI microservice — six typed AI endpoints consumed by the IDE's `/ai-assistant` page |

---

## 🏗️ Architecture & Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        Next.js 15 App                            │
│                                                                  │
│  ┌──────────────┐   ┌──────────────────┐   ┌─────────────────┐  │
│  │  Monaco IDE  │   │  AI Assistant    │   │    Snippets     │  │
│  │ (EditorPanel)│   │  (/ai-assistant) │   │  (/snippets)    │  │
│  └──────┬───────┘   └────────┬─────────┘   └────────┬────────┘  │
│         │  Zustand store     │                       │           │
│         └────────────────────┘                       │           │
│                  │                                   │           │
│    ┌─────────────▼─────────────────────────────────▼──────────┐ │
│    │          /api/execute  (Next.js Route Handler)            │ │
│    │        server-side JDoodle proxy — credentials hidden     │ │
│    └──────────────────────────┬────────────────────────────────┘ │
└─────────────────────────────── │ ────────────────────────────────┘
                                 │ HTTP
                          ┌──────▼──────┐
                          │ JDoodle API │  (sandboxed execution)
                          └─────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                      AI Service Module                           │
│                   (FastAPI — AI-code-assistant/)                 │
│                                                                  │
│  POST /api/v1/*                                                  │
│         │                                                        │
│  ┌──────▼────────┐   HTTP only — Pydantic validation,            │
│  │  api/routes   │   delegates to service, shapes typed response  │
│  └──────┬────────┘                                               │
│         │  typed dict                                            │
│  ┌──────▼────────┐   All AI logic here.                          │
│  │  ai_service   │   ModelKeyRotator → _call_with_rotation()     │
│  │               │   → generate_content() → sanitize / parse     │
│  └──────┬────────┘                                               │
│         │  reads                                                 │
│  ┌──────▼────────┐   lru_cache'd Settings singleton.             │
│  │  core/config  │   All prompts & model name from .env.         │
│  └───────────────┘                                               │
│         │                                                        │
│      AI Model (LLM)                                              │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                       Convex Backend                             │
│                                                                  │
│  ┌──────────┐  ┌─────────────┐  ┌────────────────────────────┐  │
│  │ users.ts │  │ snippets.ts │  │     codeExecutions.ts      │  │
│  │ syncUser │  │ CRUD+Stars  │  │  saveExecution (pro-gated) │  │
│  │upgradePro│  │  Comments   │  │       getUserStats         │  │
│  └─────┬────┘  └──────┬──────┘  └─────────────┬──────────────┘  │
│        │              │                        │                 │
│  ┌─────▼──────────────▼────────────────────────▼──────────────┐ │
│  │                   Convex Document DB                        │ │
│  │    users | snippets | snippetComments | stars |             │ │
│  │    codeExecutions                                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  http.ts  (Convex HTTP router)                           │   │
│  │  POST /clerk-webhook       → syncUser                    │   │
│  │  POST /lemon-squeezy-webhook → upgradeToPro              │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘

External services
  Clerk        ──►  Auth + svix-verified webhook → syncUser (Convex)
  LemonSqueezy ──►  Payment webhook → upgradeToPro mutation (Convex)
```

---

## 🔗 How Components Correlate

**🗂️ Zustand — the editor session's single source of truth**
`useCodeEditorStore` holds the live Monaco instance, current language, theme, font size, and the last execution result. `EditorPanel`, `OutputPanel`, and `RunButton` all subscribe to the same store slice — the output panel never polls, it reacts the moment `runCode()` resolves. `setCode()` writes back to `localStorage` keyed by language so switching languages never erases work-in-progress. That same `code` field is read by the AI Assistant page on route change, letting the AI service see the current editor content with zero prop drilling.

**🔒 `/api/execute` as a security proxy**
JDoodle credentials (`clientId`/`clientSecret`) are server-side-only env vars, never exposed to the browser. The route handler injects them server-side and proxies the response — execution lives in a Next.js Route Handler rather than Convex because secrets belong closest to the secret store.

**🤖 The AI Service module is a discrete, independently deployable FastAPI process**
It exposes six typed endpoints at `/api/v1/*` that the IDE's `/ai-assistant` page calls over HTTP. `routes.py` is deliberately thin — deserialize into a typed Pydantic model, call `ai_service.py`, return a typed response. All AI interaction (prompt construction, model calls, output sanitization) is encapsulated inside `ai_service.py`, independently testable without spinning up FastAPI.

**⚙️ `config.py` anchors the AI service**
Every module calls `get_settings()` (cached via `lru_cache`) — never touching env vars directly. All six system prompts live in `.env` as `PROMPT_*` variables. Iterating on prompt engineering requires zero code changes and zero redeployment.

**🔑 `ModelKeyRotator` solves quota exhaustion transparently**
Accepts a pool of model credentials via a single comma-separated env var. On any quota or rate-limit signal it marks the current credential spent and silently switches to the next one — all within the same request lifecycle. Routes and schemas have no knowledge this mechanism exists.

**⚡ Convex handles persistence, real-time social features, and business rule enforcement**
`saveExecution` checks `isPro` before allowing non-JavaScript runs — a server-side invariant, not a UI concern. Snippets use three related tables with compound indexes making toggle-star O(1). Cascade deletion on snippet delete is transactional inside the mutation — no orphaned records.

**🪝 Clerk + Convex webhook pipeline for identity sync**
Clerk is the auth provider; Convex owns the application user record (including `isPro`). On `user.created`, Clerk sends a svix-verified POST to Convex's HTTP router which calls `syncUser` with `isPro: false`. The Next.js app never manually creates users — Clerk events drive Convex state asynchronously.

**💳 LemonSqueezy closes the monetisation loop**
On `order_created`, LemonSqueezy POSTs to Convex's HTTP router. After signature verification, `upgradeToPro` patches the user record. Every subsequent `saveExecution` enforces the gate server-side, and the UI reflects the change instantly by querying the same Convex record — no extra API call.

**🛡️ Fail-fast startup in the AI service**
`get_settings()` runs inside the ASGI lifespan context before any traffic is accepted. A missing or malformed env var raises a named `ValidationError` at boot, not silently at the first real request — making container healthchecks and deployment pipelines reliable.

---

## ✨ Key Features

### 💻 Code IDE
- 🌐 **Multi-language sandbox** — 10 languages (Python, JavaScript, TypeScript, Java, Go, Rust, C++, C#, Ruby, Swift) via JDoodle, with per-language defaults and Monaco syntax highlighting
- 💾 **Persistent editor state** — language, theme, font size, and per-language drafts survive refreshes via `localStorage`, hydrated into Zustand on mount
- 🌍 **Community snippet hub** — create, star, comment on, and delete public snippets with real-time Convex queries and compound-indexed social graphs
- 🔐 **Freemium gate** — free tier locked to JavaScript; all other languages require Pro, enforced at the Convex mutation layer not the client
- 🪝 **Webhook-driven identity & payments** — Clerk and LemonSqueezy events propagate into Convex via verified webhooks, no polling
- 🎨 **Dark-first, animated UI** — Monaco themes, Framer Motion micro-animations, and Tailwind glassmorphism throughout

### 🤖 AI Service Module
- 🧠 **Six discrete AI endpoints** — generate, explain, analyze complexity, rubber-duck debug, translate, and auto-document code; each with its own typed Pydantic contract
- 🔑 **Transparent credential rotation** — `ModelKeyRotator` cycles through a pool of model credentials on quota exhaustion, returning `429` only when all are genuinely spent
- 📝 **Prompt-as-configuration** — all six system prompts are env vars; zero hardcoded strings, iterate without redeployment
- 📐 **Structured JSON mode for complexity analysis** — forces `response_mime_type="application/json"` so Big-O analysis always returns validated `time_complexity`, `space_complexity`, and `bottlenecks` fields
- 🧩 **Strict layer separation** — HTTP handling, AI logic, and configuration in distinct modules with no cross-layer leakage

---

## 🛠️ Tech Stack

### Code IDE

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

### AI Service Module

| Category | Technology |
|---|---|
| Web framework | FastAPI 0.111+ |
| ASGI server | Uvicorn (standard extras) |
| AI integration | Google Generative AI SDK |
| Config & validation | Pydantic v2 + pydantic-settings |
| Language | Python 3.11+ |

---

## 📁 Project Structure

```
CodeCraft AI/
│
├── Code IDE/                          # Next.js frontend + Convex backend
│   ├── convex/
│   │   ├── schema.ts                  # Data model: users, snippets, stars, comments, executions
│   │   ├── users.ts                   # syncUser, getUser, upgradeToPro mutations/queries
│   │   ├── snippets.ts                # Full CRUD + star/comment operations
│   │   ├── codeExecutions.ts          # saveExecution (pro-gated), getUserStats
│   │   ├── http.ts                    # Webhook router: /clerk-webhook, /lemon-squeezy-webhook
│   │   ├── lemonSqueezy.ts            # Webhook signature verification (internal action)
│   │   └── auth.config.ts             # Clerk JWT config for Convex auth
│   └── src/
│       ├── middleware.ts               # Clerk auth middleware
│       ├── store/useCodeEditorStore.ts # Global editor state (Zustand)
│       ├── types/                      # Shared TypeScript interfaces
│       ├── hooks/useMounted.ts         # SSR hydration guard
│       └── app/
│           ├── layout.tsx              # Root layout (ConvexProvider, ClerkProvider, Toaster)
│           ├── api/execute/route.ts    # Server-side JDoodle proxy
│           ├── (root)/                 # Main IDE page
│           │   ├── _constants/         # LANGUAGE_CONFIG, Monaco theme definitions
│           │   └── _components/        # EditorPanel, OutputPanel, RunButton, Selectors
│           ├── ai-assistant/page.tsx   # AI chat (reads code from Zustand store)
│           ├── snippets/               # Community gallery + detail view
│           ├── pricing/                # Pro tier pricing page
│           └── profile/                # User profile + execution history
│
└── AI-code-assistant/                  # AI Service Module (FastAPI)
    ├── app/
    │   ├── main.py                     # App factory · CORS · lifespan · /health
    │   ├── api/routes.py               # Six route handlers — HTTP layer only
    │   ├── core/config.py              # lru_cache'd Settings singleton
    │   ├── models/schemas.py           # Typed Pydantic request/response pairs
    │   └── services/ai_service.py      # ModelKeyRotator · _call_with_rotation · 6 fns
    └── requirements.txt
```
