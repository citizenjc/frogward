import { createApp } from './app.js';
import type { RunOptions } from './types/runtime.js';

export async function runCli(args: string[]): Promise<void> {
  const app = createApp();
  await app.run(parseArgs(args));
}

export function parseArgs(args: string[]): RunOptions {
  const hasCheck = args.includes('--check');
  const hasProbe = args.includes('--probe');
  const hasPoll = args.includes('--poll');
  const hasForward = args.includes('--forward-new');
  const hasService = args.includes('--service');
  const isProbe = hasProbe || hasCheck;
  const mode = hasCheck
    ? 'check'
    : hasService
      ? 'service'
      : hasPoll
        ? 'poll'
        : hasForward
          ? 'forward-new'
          : 'once';

  return {
    mode,
    safetyLevel: isProbe ? 'probe' : hasForward || hasService ? 'forward' : 'probe'
  };
}
