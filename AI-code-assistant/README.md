# 🤖 CodeCraft AI — Intelligence Service

> A production-grade FastAPI microservice exposing six purpose-built code intelligence endpoints — each backed by an LLM, each enforcing its own typed contract, none leaking implementation details to the caller.

---

## 🧠 What It Does

Context-switching between your editor, docs, and AI tools is friction. This service eliminates it by turning code intelligence into discrete, composable HTTP endpoints. Drop it behind any frontend or CI pipeline and get instant access to six capabilities:

| Endpoint | What It Returns |
|---|---|
| `POST /api/v1/generate-code` | Raw, fence-free code from a plain-English idea |
| `POST /api/v1/explain-code` | Line-by-line Markdown explanation |
| `POST /api/v1/analyze-complexity` | Structured JSON — Big-O time, space, and bottlenecks |
| `POST /api/v1/rubber-duck` | Conversational debugging answer in Markdown |
| `POST /api/v1/convert-language` | Idiomatically translated code in any target language |
| `POST /api/v1/generate-docstring` | Standalone docstring + full annotated source |

---

## 🏗️ Architecture

Four strict layers. No database. All state is ephemeral per-request.

```
  Client (HTTP POST)
        │
        ▼
┌───────────────────────────────────┐
│  main.py  (FastAPI app factory)   │  CORS · lifespan validation
│                                   │  global exception handler · /health
└──────────────┬────────────────────┘
               │  /api/v1/*
               ▼
┌───────────────────────────────────┐
│  api/routes.py  (APIRouter)       │  HTTP only — deserialize request,
│                                   │  delegate to service, shape response.
│                                   │  Zero AI logic lives here.
└──────────────┬────────────────────┘
               │  typed dict
               ▼
┌───────────────────────────────────┐
│  services/ai_service.py           │  All intelligence lives here.
│                                   │  ModelKeyRotator → _call_with_rotation()
│                                   │  → generate_content() → sanitize/parse
└──────────────┬────────────────────┘
               │  reads
               ▼
┌───────────────────────────────────┐
│  core/config.py                   │  lru_cache'd Settings singleton.
│  models/schemas.py                │  Every prompt, credential & model name
│                                   │  sourced from .env — zero hardcoded strings.
└───────────────────────────────────┘
               │
               ▼
         AI Model (LLM)
```

---

## ⚙️ Engineering Decisions Worth Knowing

**🔑 Credential pool with automatic rotation**
The service accepts a comma-separated pool of model credentials via a single env var. `ModelKeyRotator` tracks exhaustion state across all of them. On a quota or rate-limit signal it silently marks the current credential spent and switches to the next — all within the same request lifecycle. The caller never sees a retry; they only see a `429` once every credential is genuinely spent. Routes and schemas have no knowledge this mechanism exists.

**📐 Structured JSON mode for complexity analysis**
`analyze-complexity` is the only endpoint that calls the model with `response_mime_type="application/json"`. This forces the model into a structured output mode rather than free-form text. The service then validates the returned payload against four required keys (`time_complexity`, `space_complexity`, `bottlenecks`, `analysis_md`) before the response ever reaches the route layer — giving a deterministic contract even from a generative model.

**🗂️ Prompts are config, not code**
All six system prompts live in `.env` as `PROMPT_*` variables, loaded by `pydantic-settings` and cached. Iterating on prompt engineering requires zero code changes and zero redeployment — just an env update and a process restart.

**⚡ Fail-fast startup**
`get_settings()` is called inside the ASGI lifespan context before the server accepts any traffic. A missing or malformed env var raises a named `ValidationError` at boot, not silently at the first real request — making container healthchecks and deployment pipelines reliable.

**🧩 Independent schema evolution**
Request and response models are separate Pydantic classes with no shared base. `AnalyzeComplexityResponse` carries four structured fields; `ExplainCodeResponse` carries a single Markdown string. Each can evolve without touching any other endpoint's contract.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Web framework | FastAPI 0.111+ |
| ASGI server | Uvicorn (standard extras) |
| AI integration | Google Generative AI SDK |
| Config & validation | Pydantic v2 + pydantic-settings |
| Language | Python 3.11+ |

---

## 📁 Structure

```
AI-code-assistant/
├── app/
│   ├── main.py               # App factory · CORS · lifespan · /health
│   ├── api/
│   │   └── routes.py         # Six route handlers — HTTP layer only
│   ├── core/
│   │   └── config.py         # lru_cache'd Settings singleton
│   ├── models/
│   │   └── schemas.py        # Typed Pydantic request/response pairs
│   └── services/
│       └── ai_service.py     # ModelKeyRotator · _call_with_rotation · 6 fns
└── requirements.txt
```

Interactive API docs auto-generated at `/docs` (Swagger UI) and `/redoc` (ReDoc).