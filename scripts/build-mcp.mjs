/**
 * build-mcp.mjs
 * ------------------------------------------------------------------
 * Bundles the MCP server (src/mcp/server.ts) into a single standalone
 * ESM file at dist-mcp/mcp-server.mjs, so MCP clients only need Node —
 * no node_modules next to the entry point.
 *
 *   npm run mcp:build      # bundle
 *   npm run mcp            # run it (stdio transport)
 * ------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outdir = path.join(projectRoot, 'dist-mcp');
const outfile = path.join(outdir, 'mcp-server.mjs');

await build({
  entryPoints: [path.join(projectRoot, 'src/mcp/server.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
});

// tiny launcher so `node dist-mcp/mcp-server.mjs` works from any cwd
fs.writeFileSync(
  path.join(outdir, 'README.md'),
  `# dist-mcp

Build output for the Otjiherero Dictionary MCP server (\`npm run mcp:build\`).

Point your MCP client at:

    node <project>/dist-mcp/mcp-server.mjs

Environment (optional): LLM_API_KEY, LLM_BASE_URL, LLM_MODEL,
HERERO_LEXICON_PATH. See the project README for a full config example.
`,
);

const bytes = fs.statSync(outfile).size;
console.log(`  mcp server bundled -> ${path.relative(projectRoot, outfile)} (${(bytes / 1024).toFixed(0)} KB)`);
