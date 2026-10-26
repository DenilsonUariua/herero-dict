/**
 * MCP server for the Otjiherero Dictionary
 * ------------------------------------------------------------------
 * Exposes the dictionary and the RAG translation pipeline to any
 * MCP-capable AI assistant (Claude Desktop, Cursor, WorkBuddy, …).
 *
 * Transport: stdio. Run it with:
 *
 *   npm run mcp            # after npm run mcp:build
 *
 * Client configuration (Claude Desktop / Cursor / generic):
 *   {
 *     "mcpServers": {
 *       "otjiherero-dictionary": {
 *         "command": "node",
 *         "args": ["<absolute path>/dist-mcp/mcp-server.mjs"],
 *         "env": { "LLM_API_KEY": "sk-..." }        // optional
 *       }
 *     }
 *   }
 *
 * Tools:
 *   lookup_word        bidirectional dictionary lookup (offline)
 *   search_dictionary  retrieve the entries the RAG pipeline would use
 *   translate_sentence full RAG translation (needs LLM_API_KEY)
 *   get_lexicon_stats  corpus size + data-quality flags
 *
 * Resources:
 *   dictionary://lexicon   the full structured lexicon as JSON
 *
 * Environment (all optional):
 *   LLM_API_KEY / OPENAI_API_KEY   enables translate_sentence
 *   LLM_BASE_URL                   default https://api.openai.com/v1
 *   LLM_MODEL                      default gpt-4o-mini
 *   HERERO_LEXICON_PATH            override lexicon.json location
 * ------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { lookupWord, retrieve } from '../lib/rag/retriever';
import { translateSentence, translateWord } from '../lib/rag/translate-core';
import { RagError, type Direction, type Lexicon, type RagSettings } from '../lib/rag/types';

// ------------------------------------------------------------------ env

const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
const LLM_BASE_URL = (
  process.env.LLM_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  'https://api.openai.com/v1'
).replace(/\/$/, '');
const LLM_MODEL = process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

const isLocalProvider = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(LLM_BASE_URL);

function settings(): RagSettings {
  return { mode: 'byok', apiKey: LLM_API_KEY, baseUrl: LLM_BASE_URL, model: LLM_MODEL };
}

// ------------------------------------------------------------------ lexicon

function findLexicon(): string {
  const candidates = [
    process.env.HERERO_LEXICON_PATH,
    path.join(process.cwd(), 'public', 'lexicon.json'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'lexicon.json'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `lexicon.json not found. Looked in: ${candidates.join(', ')}. ` +
      'Run "npm run build:lexicon" or set HERERO_LEXICON_PATH.',
  );
}

const lexiconPath = findLexicon();
const lexicon = JSON.parse(fs.readFileSync(lexiconPath, 'utf8')) as Lexicon;

// ------------------------------------------------------------------ helpers

const DIRECTIONS = ['en-hz', 'hz-en'] as const;

function parseDirection(value: string | undefined): Direction {
  return value === 'hz-en' ? 'hz-en' : 'en-hz';
}

function errText(err: unknown): string {
  if (err instanceof RagError) {
    if (err.code === 'no-key') {
      return 'No model API key is configured for the MCP server. Set LLM_API_KEY (and optionally LLM_BASE_URL / LLM_MODEL) in the server env. Word lookup and dictionary search work without a key.';
    }
    return err.message;
  }
  return (err as Error)?.message ?? String(err);
}

const isError = (err: unknown) => err instanceof RagError && err.code !== 'no-key';

// ------------------------------------------------------------------ server

const server = new McpServer({
  name: 'otjiherero-dictionary',
  version: '1.0.0',
});

server.registerTool(
  'lookup_word',
  {
    title: 'Look up a word',
    description:
      'Dictionary lookup in both directions: English->Otjiherero or Otjiherero->English. ' +
      'Returns headwords, Otjiherero terms with noun-class (singular/plural) prefixes, ' +
      'usage examples, and match quality. Runs offline, no API key needed.',
    inputSchema: {
      word: z.string().min(1).describe('The word to look up, in the source language'),
      direction: z
        .enum(['en-hz', 'hz-en'])
        .optional()
        .describe("Translation direction: 'en-hz' (default) searches English headwords, 'hz-en' searches Otjiherero terms"),
      limit: z.number().int().min(1).max(25).optional().describe('Maximum results (default 8)'),
    },
  },
  async ({ word, direction, limit }) => {
    const result = lookupWord(lexicon, word, parseDirection(direction), limit ?? 8);
    const payload = {
      query: result.query,
      direction: result.direction,
      hits: result.hits.map((hit) => ({
        english: hit.en,
        herero: hit.hz,
        pluralClassPrefix: hit.classPrefix ?? undefined,
        match: hit.matchType,
        example: hit.examples[0]
          ? { english: hit.examples[0].en ?? undefined, herero: hit.examples[0].hz }
          : undefined,
      })),
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    };
  },
);

server.registerTool(
  'search_dictionary',
  {
    title: 'Search the dictionary',
    description:
      'Retrieve the dictionary entries most relevant to a sentence or phrase — the same ' +
      'evidence the sentence translator is grounded in. Useful to answer "how would this ' +
      'be said in Otjiherero" without invoking a model. Offline, no API key needed.',
    inputSchema: {
      query: z.string().min(1).describe('A sentence, phrase, or list of words'),
      direction: z.enum(['en-hz', 'hz-en']).optional().describe("Which side to search: 'en-hz' (default) or 'hz-en'"),
      limit: z.number().int().min(1).max(20).optional().describe('Maximum distinct headwords (default 10)'),
    },
  },
  async ({ query, direction, limit }) => {
    const result = retrieve(lexicon, query, parseDirection(direction), limit ?? 10);
    const payload = {
      direction: parseDirection(direction),
      contentWords: result.contentWords,
      uncovered: result.uncovered,
      entries: result.blocks.map((block) => ({
        headword: block.en,
        qualifier: block.qualifier ?? undefined,
        herero: block.hz,
        examples: block.examples.map((ex) => ({ english: ex.en ?? undefined, herero: ex.hz })),
        matchedWords: block.matched,
        score: Number(block.score.toFixed(2)),
      })),
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    };
  },
);

server.registerTool(
  'translate_sentence',
  {
    title: 'Translate a sentence',
    description:
      "Translate a full sentence between English and Otjiherero using retrieval-augmented generation: " +
      "the relevant dictionary entries are retrieved first and the model is grounded in them. " +
      "Returns the translation, a word-by-word gloss, grammar notes, a confidence score, and the " +
      'dictionary entries used. direction "hz-en" (Otjiherero -> English) is experimental. ' +
      'Requires LLM_API_KEY in the server environment.',
    inputSchema: {
      text: z.string().min(1).max(1200).describe('The sentence to translate'),
      direction: z
        .enum(['en-hz', 'hz-en'])
        .optional()
        .describe("'en-hz' translates English to Otjiherero (default), 'hz-en' the reverse"),
    },
  },
  async ({ text, direction }) => {
    try {
      const result = await translateSentence({
        text,
        direction: parseDirection(direction),
        settings: settings(),
        lexicon,
        bypassCache: true,
      });
      const payload = {
        herero: result.herero,
        english: result.english,
        gloss: result.gloss,
        notes: result.notes,
        confidence: result.confidence,
        sources: result.sources,
        uncovered: result.uncovered,
        model: result.model,
      };
      return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
    } catch (err) {
      return {
        isError: isError(err),
        content: [{ type: 'text', text: errText(err) }],
      };
    }
  },
);

server.registerTool(
  'get_lexicon_stats',
  {
    title: 'Get dictionary stats',
    description:
      'Size and data quality of the bundled Otjiherero lexicon: entry count, Otjiherero term ' +
      'count, example sentences, and which entries are flagged for OCR damage.',
    inputSchema: {},
  },
  async () => {
    const flagged = lexicon.entries.filter((e) => e.flags.length > 0);
    const payload = {
      lexiconPath,
      generatedAt: lexicon.generatedAt,
      entries: lexicon.stats.entries,
      hereroTerms: lexicon.stats.terms,
      exampleSentences: lexicon.stats.examples,
      flaggedForReview: flagged.map((entry) => ({ headword: entry.en, flags: entry.flags })),
      translationEnabled: Boolean(LLM_API_KEY) || isLocalProvider,
      model: LLM_MODEL,
    };
    return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  },
);

server.registerResource(
  'lexicon',
  'dictionary://lexicon',
  {
    title: 'Otjiherero lexicon',
    description: 'The full structured dictionary: English headwords, Otjiherero terms with noun classes, and example sentence pairs.',
    mimeType: 'application/json',
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify({ ...lexicon, _sourcePath: lexiconPath }),
      },
    ],
  }),
);

// ------------------------------------------------------------------ start

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout carries the MCP protocol
  console.error(
    `[otjiherero-dictionary] MCP server ready · ${lexicon.stats.entries} entries · ` +
      `translation ${Boolean(LLM_API_KEY) || isLocalProvider ? 'enabled' : 'disabled (no LLM_API_KEY)'}`,
  );
}

main().catch((err) => {
  console.error('[otjiherero-dictionary] fatal:', err);
  process.exit(1);
});
