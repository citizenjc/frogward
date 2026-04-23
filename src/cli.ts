import { createApp } from './app.js';

export async function runCli(args: string[]): Promise<void> {
  const app = createApp();
  await app.run(args);
}
