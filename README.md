# Otjiherero Dictionary

A community dictionary for Otjiherero (Herero) with bilingual lookup and
dictionary-grounded sentence translation.

- **Search & browse** English headwords with their Otjiherero equivalents.
- **Translate** in both directions — English ⇄ Otjiherero — by word or by sentence.
- **Copy or share** any word or translation straight into WhatsApp, Telegram or
  Messenger.
- **Like** words, **suggest** new ones, and **request corrections**.
- Works **offline** once loaded (PWA + local lexicon).

---

## Features

### 0. The home page is the translator
Typing a sentence is the first thing a visitor can do — the hero on `/` is the
same translate box as `/translate`, with the result, its word-by-word gloss and
copy/share buttons appearing inline. Browsing, word of the day and search sit
below it. If the text looks like the wrong language for the selected direction,
the box offers to flip it instead of quietly producing nonsense.

### 1. Dictionary lookup (both directions)
Search English to find the Otjiherero term, or search Otjiherero to find the
English meaning. Handles noun-class prefixes (`otjivike` / `ovivike`), stemming
(`working` → `WORK`) and near-miss spellings. The word tab queries both sides at
once, so it does not matter which language you type.

### 2. Sentence translation (retrieval-augmented)
Give it an English sentence and it returns an Otjiherero sentence, a
word-by-word gloss, grammar notes, a confidence score, and **the exact
dictionary entries it was grounded in**. Words the dictionary does not cover are
called out explicitly instead of being silently guessed.

### 3. Copy & share
Every card and every result carries a copy button and a share menu. Copy puts
plain text on the clipboard (`Aardvark — ondji-mbandjimba`, or the sentence
alone); share opens the OS share sheet on phones and falls back to `wa.me`,
Telegram and SMS links on desktop. The clipboard helper falls back to
`execCommand` because `navigator.clipboard` does not exist in insecure contexts
or some in-app webviews — which is how a lot of this traffic arrives.

### 4. Likes, suggestions, corrections
Mark favourites, submit missing words, and flag mistakes for review. Admins
review everything from `/admin`.


---

## How the translation works

```
English sentence
      │
      ▼
┌─────────────────┐   BM25 + morphology + typo tolerance over the lexicon
│   Retriever     │   plus live full-text search on the Appwrite `words` table
└─────────────────┘
      │  top ~10 entries (headword, Otjiherero terms, noun class, examples)
      ▼
┌─────────────────┐   grammar reference + few-shot pairs from the dictionary
│ Prompt builder  │   + retrieved entries + "flag anything uncovered" rules
└─────────────────┘
      │
      ▼
┌─────────────────┐   OpenAI-compatible chat completion (server proxy or BYOK)
│   LLM           │   returns strict JSON
└─────────────────┘
      │
      ▼
  validated result → cached in localStorage → rendered with sources
```

Why lexical retrieval rather than a vector index: the corpus is small and the
query is a full sentence, so what matters is recalling *specific* content words,
not topical similarity. BM25 with Herero-aware stemming beats embeddings here,
costs nothing per query, and works offline. The retriever is a pure function
(`src/lib/rag/retriever.ts`), so swapping in a dense index later is a contained
change.

### Where the code lives

| Path | Purpose |
| --- | --- |
| `scripts/lib/lexicon-parse.mjs` | Parses the raw scraped dictionary rows into structured entries |
| `scripts/build-lexicon.mjs` | Generates `public/lexicon.json` |
| `src/lib/rag/retriever.ts` | Hybrid retrieval + offline word lookup |
| `src/lib/rag/prompt.ts` | Otjiherero grammar reference + prompt assembly |
| `src/lib/rag/provider.ts` | Model access (server proxy, then BYOK) |
| `src/lib/rag/live.ts` | Folds newly approved Appwrite words into retrieval |
| `src/lib/rag/translate.ts` | Orchestration, validation, caching |
| `src/pages/Translate.tsx` | The `/translate` UI |
| `src/mcp/server.ts` | MCP server exposing the dictionary as AI tools |
| `api/translate.mjs` | Serverless proxy that keeps the API key server-side |
| `scripts/rag-server.mjs` | Same proxy, running locally for `npm run dev:full` |

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your Appwrite project (`VITE_APPWRITE_ENDPOINT`,
`VITE_APPWRITE_PROJECT_ID`, `VITE_APPWRITE_DATABASE_ID`), then create the schema:

```bash
npm run setup:appwrite
```

### 3. Enable sentence translation

Word lookup needs no configuration. Sentence translation needs a model —
pick **one** of:

**A. Server-side key (recommended for a public site).** Add to `.env`:

```bash
# Gemini (key from https://aistudio.google.com/apikey)
LLM_API_KEY=AIza...
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_MODEL=gemini-2.5-flash

# or any other OpenAI-compatible provider:
# LLM_BASE_URL=https://api.openai.com/v1        LLM_MODEL=gpt-4o-mini
# LLM_BASE_URL=https://openrouter.ai/api/v1     LLM_MODEL=openai/gpt-4o-mini
# LLM_BASE_URL=https://api.groq.com/openai/v1   LLM_MODEL=llama-3.3-70b-versatile
# LLM_BASE_URL=http://localhost:11434/v1        LLM_MODEL=llama3.1  (Ollama, no key)
```

Then run the proxy alongside Vite:

```bash
npm run dev:full
```

In production, `api/translate.mjs` is picked up automatically as a serverless
function (Vercel needs no extra config). Set the same variables in your host's
dashboard — **never** prefix them with `VITE_`, or the key would be bundled into
the browser build.

Two optional knobs matter when the answers come back broken:

```bash
LLM_MAX_TOKENS=4096        # default; raise if translations get cut off
LLM_REASONING_EFFORT=low   # Gemini 2.5 / o-series: less thinking, faster replies
```

Reasoning models bill their hidden "thinking" against `LLM_MAX_TOKENS`. Set it
too low and the budget is spent before the JSON answer is written, so the reply
arrives truncated and unparseable. The proxy now retries once with double the
room and reports truncation clearly if it still runs out.

**B. Per-visitor key (no backend).** Leave `LLM_API_KEY` empty. Visitors open
the gear icon on `/translate` and paste their own key; it is stored only in
their browser and sent straight to the provider.

### 4. Run

```bash
npm run dev        # app only — word lookup works, sentences need a key
npm run dev:full   # app + local translation proxy
```

Open <http://localhost:3400>.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on :3400 |
| `npm run dev:full` | Vite + local translation proxy on :3401 |
| `npm run build` | Regenerates the lexicon, then builds for production |
| `npm run build:lexicon` | Rebuilds `public/lexicon.json` from `words.json` |
| `npm run build:lexicon -- --report` | Same, plus a parse-quality report |
| `npm run test:rag` | Retrieval quality harness (no API key needed) |
| `npm run test:mcp` | MCP server protocol + tools smoke test |
| `npm run mcp:build` | Bundle the MCP server to `dist-mcp/mcp-server.mjs` |
| `npm run mcp` | Run the MCP server on stdio |
| `npm run typecheck` | TypeScript check |
| `npm run setup:appwrite` | Creates/updates Appwrite tables and seeds data |

### Updating the dictionary

`public/lexicon.json` is a build-time snapshot committed to the repo, so the app
works on a fresh clone without the (git-ignored) `words.json`. After editing the
dictionary source:

```bash
npm run build:lexicon -- --report
```

The report lists rows whose source text is damaged (OCR artefacts such as
`o20-1`, `WO0`) — those are the entries worth fixing by hand. Words added later
through the admin panel are picked up at query time via live search, so a
rebuild is only needed for bulk imports.

---

## MCP server (use the dictionary from any AI assistant)

The repo ships an MCP (Model Context Protocol) server, so tools like Claude
Desktop, Cursor, or WorkBuddy can query the dictionary directly instead of
scraping the website.

```bash
npm run mcp:build     # bundle src/mcp/server.ts -> dist-mcp/mcp-server.mjs
npm run test:mcp      # protocol + tools smoke test (no key needed)
npm run mcp           # run the server on stdio
```

**Tools**

| Tool | Needs key | What it does |
| --- | --- | --- |
| `lookup_word` | no | Bidirectional lookup with noun classes and examples |
| `search_dictionary` | no | Retrieve the entries the translator is grounded in |
| `translate_sentence` | yes | Full RAG translation with gloss, notes, confidence |
| `get_lexicon_stats` | no | Corpus size, data-quality flags |

It also exposes the full lexicon as the resource `dictionary://lexicon`.

**Register it in an MCP client** (Claude Desktop → Settings → Developer →
Edit Config, or the equivalent in your client; a ready-made `.mcp.json` ships
with the repo):

```json
{
  "mcpServers": {
    "otjiherero-dictionary": {
      "command": "node",
      "args": ["C:/absolute/path/to/herero-dict/dist-mcp/mcp-server.mjs"],
      "env": {
        "LLM_API_KEY": "AIza...",
        "LLM_BASE_URL": "https://generativelanguage.googleapis.com/v1beta/openai",
        "LLM_MODEL": "gemini-2.5-flash"
      }
    }
  }
}
```

`env` is optional — without `LLM_API_KEY` the lookup and search tools still
work, and `translate_sentence` explains how to enable itself.

**AI-friendly site data:** `public/llms.txt` describes the site for AI
crawlers/agents and documents the shape of `/lexicon.json`, and
`lexicon.json` is now included in the PWA precache so offline lookup keeps
working.

---

## Limitations (worth knowing)

- The bundled dictionary is a partial extract (~2,200 headwords). The
  translator is only as good as the lexicon it retrieves from — coverage will
  improve sharply as the dictionary grows.
- Otjiherero is low-resource, so the model has almost no prior knowledge of it.
  Grammar guidance in the prompt is derived from constructions attested in this
  dictionary; treat low-confidence output as a draft for a speaker to check.
- Confidence scores are the model's self-assessment, not a calibrated metric.
- Sentence translation requires network access and a model; word lookup does not.
- The PWA precaches the lexicon (~900 kB) on first load so offline lookup works.
  That is a deliberate trade-off; if first-visit data cost matters more than
  offline readiness, move `lexicon.json` from `globPatterns` to a runtime
  cache and fetch it on first translate.

---

## Contributing

1. Fork the repo and create a branch: `git checkout -b feature-name`
2. Make your changes and commit them.
3. Open a Pull Request.

Corrections from native speakers are especially valuable — both for dictionary
entries and for the grammar reference in `src/lib/rag/prompt.ts`.

---

## License

[MIT](LICENSE)

## Acknowledgments

- Inspired by the beauty of the Otjiherero language and culture.
- Thanks to all contributors and users for their support.
