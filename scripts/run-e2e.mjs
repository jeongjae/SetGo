import { spawn } from 'node:child_process';

const port = 4183;
const host = '127.0.0.1';
const url = `http://${host}:${port}`;

function spawnProcess(command, args, options = {}) {
  return spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
    ...options,
  });
}

async function waitForServer(timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function runPlaywright() {
  return new Promise((resolve) => {
    const child = spawnProcess(process.execPath, ['./node_modules/@playwright/test/cli.js', 'test'], {
      env: {
        ...process.env,
        SETGO_E2E_SKIP_WEBSERVER: '1',
      },
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const server = spawnProcess(process.execPath, [
    './node_modules/vite/bin/vite.js',
    '--host',
    host,
    '--port',
    String(port),
    '--strictPort',
  ]);

  const stopServer = () => {
    if (!server.killed) {
      server.kill('SIGTERM');
      setTimeout(() => {
        if (!server.killed) server.kill('SIGKILL');
      }, 2_000).unref();
    }
  };

  process.on('SIGINT', () => {
    stopServer();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    stopServer();
    process.exit(143);
  });

  try {
    await waitForServer();
    const code = await runPlaywright();
    stopServer();
    process.exit(code);
  } catch (error) {
    stopServer();
    console.error(error);
    process.exit(1);
  }
}

void main();
