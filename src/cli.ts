import { createApp } from './app.js';
import type { RunOptions } from './types/runtime.js';

export async function runCli(args: string[]): Promise<void> {
  const app = createApp();
  await app.run(parseArgs(args));
}

function parseArgs(args: string[]): RunOptions {
  const isProbe = args.includes('--probe') || args.includes('--check');

  return {
    mode: args.includes('--check') ? 'check' : 'once',
    safetyLevel: isProbe ? 'probe' : 'forward'
  };
}
