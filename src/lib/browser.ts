export interface BrowserPage {
  goto(url: string): Promise<void>;
}

export interface BrowserManager {
  withPage<T>(callback: (page: BrowserPage) => Promise<T>): Promise<T>;
}

export function createBrowserManager(): BrowserManager {
  return {
    async withPage<T>(callback: (page: BrowserPage) => Promise<T>): Promise<T> {
      const page: BrowserPage = {
        async goto(): Promise<void> {
          return Promise.resolve();
        }
      };

      return callback(page);
    }
  };
}
