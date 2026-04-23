import { execFile } from 'node:child_process';
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
