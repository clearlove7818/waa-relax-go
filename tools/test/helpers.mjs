import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const entry = fileURLToPath(new URL('../check.mjs', import.meta.url));

export function workspace(t) {
  // Resolve the OS temp alias so the checker tests real inputs, not /var's symlink.
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'relax-go-check-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return {
    root,
    write(name, text) {
      const path = join(root, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
      return path;
    },
    run(args = [], input = '') {
      const result = spawnSync(process.execPath, [entry, ...args], {
        cwd: root, input, encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024,
      });
      assert.ifError(result.error);
      assert.equal(result.signal, null, result.stderr);
      return result;
    },
  };
}

export function report(result, status = 0) {
  assert.equal(result.status, status, result.stderr || result.stdout);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

export const issuesFor = (result, rule) => result.files.flatMap((file) => file.issues).filter((issue) => issue.rule === rule);
