import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { expect, test } from '@playwright/test';

const execFileAsync = promisify(execFile);

test('scaffold boot smoke path succeeds', async () => {
  const { stdout } = await execFileAsync('npm', ['run', 'dev', '--', '--check'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APP_MODE: 'scaffold'
    }
  });

  expect(stdout).toContain('app.check.complete');
});

test('scaffold explicit probe mode succeeds', async () => {
  const { stdout } = await execFileAsync('npm', ['run', 'dev', '--', '--probe'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APP_MODE: 'scaffold'
    }
  });

  expect(stdout).toContain('"safetyLevel":"probe"');
  expect(stdout).toContain('app.check.complete');
});

test('forward-new mode is blocked without forwarding gate', async () => {
  const { stderr } = await execFileAsync('npm', ['run', 'dev', '--', '--forward-new'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APP_MODE: 'scaffold'
    }
  }).catch((error: { stderr?: string }) => ({ stderr: error.stderr ?? '' }));

  expect(stderr).toContain('Forwarding mode blocked by security gate');
});

test('scaffold forward-new summarizes confirmed success counts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'frogward-smoke-'));
  const statePath = join(dir, 'runtime-state.json');

  await writeFile(
    statePath,
    JSON.stringify(
      {
        seen: [
          {
            id: 'old-seen',
            firstSeenAt: '2026-04-24T00:00:00.000Z',
            lastSeenAt: '2026-04-24T00:00:00.000Z',
            source: 'sapo-row-id',
            confidence: 'high'
          }
        ],
        forwarded: [],
        scan: {
          scanCount: 1,
          lastNewCount: 0,
          lastScanAt: '2026-04-24T00:00:00.000Z',
          bootstrapCompletedAt: '2026-04-24T00:00:00.000Z'
        }
      },
      null,
      2
    ),
    'utf8'
  );

  try {
    const { stdout, stderr } = await execFileAsync('npm', ['run', 'dev', '--', '--forward-new'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        APP_MODE: 'scaffold',
        STATE_FILE_PATH: statePath,
        FORWARDING_ENABLED: 'true',
        FORWARDING_ACK: 'true',
        FORWARDING_WARP_TOKEN: 'warp-ok',
        DESTINATION_EMAIL: 'dest@example.com'
      }
    });

    expect(stderr).toBe('');
    expect(stdout).toContain('app.forward.complete');
    expect(stdout).toContain('"candidateCount":1');
    expect(stdout).toContain('"successCount":1');
    expect(stdout).toContain('"failedCount":0');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('service mode requires forwarding gate before starting automation', async () => {
  const { stderr } = await execFileAsync('npm', ['run', 'dev', '--', '--service'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APP_MODE: 'scaffold'
    }
  }).catch((error: { stderr?: string }) => ({ stderr: error.stderr ?? '' }));

  expect(stderr).toContain('Forwarding mode blocked by security gate');
});
