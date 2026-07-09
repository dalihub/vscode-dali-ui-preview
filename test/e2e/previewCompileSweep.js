/**
 * previewCompileSweep.js — compile EVERY *.preview.dali.cpp (examples/ + test/samples/)
 * against a chosen backend and report a pass/fail matrix.
 *
 * This exists because the golden runners only cover test/samples/ AND only run in
 * docker by default — so a STALE *native* DALi prefix (runtimeMode:local) silently
 * went unverified and shipped the `View has no member 'AddChildren'` error to a
 * local-mode user. This sweep closes that gap: it tests the exact compile that the
 * live extension performs, in WHICHEVER runtime mode you actually use.
 *
 * Usage:
 *   SWEEP_BACKEND=native  DALI_PREFIX=/path/to/dali-env/opt  xvfb-run -a node out/test/e2e/previewCompileSweep.js
 *   SWEEP_BACKEND=docker  PREVIEW_IMAGE=ghcr.io/lwc0917/dali-preview-runtime:latest xvfb-run -a node out/test/e2e/previewCompileSweep.js
 *
 * NB: this is plain JS (no compile step) so it can be run directly; it require()s the
 * compiled standaloneBuildRunner from out/.
 */
const path = require('path');
const fs = require('fs');
const cp = require('child_process');

function findRepoRoot(start) {
  let d = start;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(d, 'package.json')) && fs.existsSync(path.join(d, 'server/preview_harness.cpp.template'))) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  throw new Error('repo root not found from ' + start);
}
const REPO = findRepoRoot(__dirname);
const SBR = require(path.join(REPO, 'out/test/e2e/standaloneBuildRunner.js'));
const { isRuntimeApiSkew } = require(path.join(REPO, 'out/src/skewSignature.js'));

const BACKEND = (process.env.SWEEP_BACKEND || 'native').toLowerCase();
const NATIVE_PREFIX = process.env.DALI_PREFIX || '/home/woochan/tizen/generativeUI/dali-env/opt';
const IMAGE = process.env.PREVIEW_IMAGE || 'ghcr.io/lwc0917/dali-preview-runtime:latest';
const TEMPLATE = path.join(REPO, 'server/preview_harness.cpp.template');
const OUT = path.join(process.env.TMPDIR || '/tmp', 'preview_sweep_out');
fs.mkdirSync(OUT, { recursive: true });

// ── Docker-sweep render skip (documented, never silent) ──────────────
// These samples COMPILE cleanly (skew=0) but their DALi first-frame render produces no
// PNG in the docker compile-sweep's headless Xvfb path — a sweep-only render-env artifact,
// NOT a dali-ui API break. They ARE render-validated by the golden runner (test:e2e) and
// the CLI harness, and golden also compiles them in docker, so the docker sweep's coverage
// for them is redundant. Excluded from the DOCKER backend only; the NATIVE sweep (this
// sweep's unique coverage) still checks them. Each skip is logged (see loop below).
const DOCKER_SWEEP_RENDER_SKIP = new Set([
  'test/samples/weather-forecast.preview.dali.cpp',
]);

function listPreviewFiles() {
  const out = cp.execSync(
    "git ls-files | grep -E '\\.preview\\.dali\\.cpp$' | grep -E '^(examples|test/samples)/'",
    { cwd: REPO, encoding: 'utf8' },
  );
  return out.split('\n').map(s => s.trim()).filter(Boolean);
}

// `@dali-preview` factory (ADR-001 Mode 2): the file is `RetType Name(args){ BODY }`.
// The real codeExtractor renders only BODY; feeding the whole definition double-wraps
// it (the harness adds its own function), so g++ says "function-definition not allowed
// here". Mirror the extractor for these files only — gated on the marker so every other
// preview file is fed byte-identically (no risk to the common whole-body case).
function extractUserCode(raw) {
  if (!/^\s*\/\/\s*@dali-preview\b/m.test(raw)) return raw;
  const open = raw.indexOf('{');
  if (open === -1) return raw;
  let depth = 0;
  for (let i = open; i < raw.length; i++) {
    if (raw[i] === '{') depth++;
    else if (raw[i] === '}' && --depth === 0) return raw.slice(open + 1, i);
  }
  return raw; // unbalanced — leave as-is
}

function firstCompileError(err) {
  // Prefer a real g++ diagnostic line (path:line:col: error/fatal). Skip our own
  // "Compile error:" header (which would otherwise win the /error:/ match).
  const lines = String(err || '').split('\n');
  const diag = lines.find(l => /:\d+:\d+:\s*(error|fatal error):/.test(l));
  const pick = diag || lines.find(l => /error:/i.test(l) && !/^compile error:/i.test(l.trim())) || lines[0] || '';
  return pick.replace(/^.*?:(\d+):(\d+):\s*/, 'L$1:$2 ').slice(0, 150);
}

(async () => {
  const files = listPreviewFiles();
  console.log(`=== PREVIEW COMPILE SWEEP — backend=${BACKEND} ===`);
  console.log(BACKEND === 'docker' ? `Image : ${IMAGE}` : `Prefix: ${NATIVE_PREFIX}`);
  console.log(`Files : ${files.length}\n`);

  const results = [];
  const skipped = [];
  for (const rel of files) {
    if (BACKEND === 'docker' && DOCKER_SWEEP_RENDER_SKIP.has(rel)) {
      skipped.push(rel);
      console.log(`  SKIP  ${rel}   (docker-sweep render skip — renders via golden+CLI; headless yields no PNG, skew=0)`);
      continue;
    }
    const abs = path.join(REPO, rel);
    const tag = rel.replace(/[\/.]/g, '_');
    const opts = {
      userCode: extractUserCode(fs.readFileSync(abs, 'utf8')),
      width: 600, height: 400,
      outputPngPath: path.join(OUT, tag + '.png'),
      metadataPath: path.join(OUT, tag + '.json'),
      templatePath: TEMPLATE,
      daliPrefix: NATIVE_PREFIX,
      display: process.env.DISPLAY || ':0',
    };
    let r;
    try {
      r = BACKEND === 'docker' ? await SBR.buildAndCaptureDocker(opts, IMAGE) : await SBR.buildAndCapture(opts);
    } catch (e) { r = { success: false, error: String(e && e.stack || e) }; }
    const skew = !r.success && isRuntimeApiSkew(r.error);
    results.push({ rel, ok: !!r.success, skew, err: r.success ? '' : firstCompileError(r.error) });
    console.log(`  ${r.success ? 'PASS' : (skew ? 'FAIL*' : 'FAIL ')}  ${rel}${r.success ? '' : '   ' + results[results.length - 1].err}`);
  }

  const pass = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  const skew = results.filter(r => r.skew).length;
  console.log(`\n=== ${pass} pass, ${fail} fail, ${skipped.length} skip (${skew} of them are dali-ui API skew / stale runtime) ===`);
  if (skipped.length) console.log(`(skipped in ${BACKEND} sweep — see SKIP lines above: ${skipped.join(', ')})`);
  console.log('(FAIL* = stale-runtime API skew signature)');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('SWEEP THREW:', e && e.stack || e); process.exit(3); });
