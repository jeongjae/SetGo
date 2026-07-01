import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function readGitValue(command, fallback) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || fallback;
  } catch {
    return fallback;
  }
}

const version = {
  app: 'SetGo',
  builtAt: new Date().toISOString(),
  commit: readGitValue('git rev-parse --short HEAD', 'unknown'),
};

const target = resolve('public', 'app-version.json');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(version, null, 2)}\n`, 'utf8');
