import { createApp } from './app.js';
import type { RunOptions } from './types/runtime.js';

export async function runCli(args: string[]): Promise<void> {
  const app = createApp();
  await app.run(parseArgs(args));
}

function parseArgs(args: string[]): RunOptions {
  return {
    mode: args.includes('--check') ? 'check' : 'once'
  };
}
