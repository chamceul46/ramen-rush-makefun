// RAMEN RUSH — hand-in program (Node 22, standard library only).
//
// The game itself is the static site in game/ (open game/index.html in a
// desktop browser, offline, no build step). This program delivers it: it
// copies game/ and screenshots/ into the output directory and writes
// dossier.json there with buildDossier from the vendored make.fun library,
// exactly the summary the judge reads.
//
// In the grader the output directory is /output; locally it is whatever
// MAKEFUN_OUTPUT_DIR names:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });

mkdirSync(join(outDir, 'screenshots'), { recursive: true });
const shotsDir = join(repoDir, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

// The caps below are the scorer's own (see the competition's gate): the
// dossier text is capped at 160 KiB, at most 4 screenshots of 256 KiB each,
// and game/ holds at most 993 entries / 48 MiB with paths under 1000 bytes.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
