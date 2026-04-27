import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AuthError } from '../lib/errors.js';
import type { BrowserPage } from '../lib/browser.js';
import { resolveInboxUrl } from './mailbox-routes.js';
import type { LoginResult, ModuleContext } from '../types/runtime.js';

interface LoginInput extends ModuleContext {
  page: BrowserPage;
  usingStorageState: boolean;
}

export async function loginToSapo({
  config,
  logger,
  page,
  usingStorageState
}: LoginInput): Promise<LoginResult> {
  logger.info('sapo.login.start', {
    mode: config.mode,
    hasStorageState: usingStorageState
  });

  await page.goto(await resolveInboxUrl(page));
  await handleKnownInterstitials(page);
  logger.info('sapo.login.after_inbox_probe', { url: page.url() });

  if (await isAuthenticated(page)) {
    logger.info('sapo.login.reused_session', {
      source: usingStorageState ? 'storage-state' : 'active-session'
    });
    return { status: 'reused-session', inboxReached: true };
  }

  await page.goto('https://mail.sapo.pt/login?ssoAuth&site=mail.sapo.pt');
  logger.info('sapo.login.after_goto', { url: page.url() });

  if (await isAuthenticated(page)) {
    logger.info('sapo.login.reused_session', { source: 'login-redirect' });
    return { status: 'reused-session', inboxReached: true };
  }

  if (config.mode !== 'live') {
    logger.info('sapo.login.scaffold_skip');
    return { status: 'interactive-login', inboxReached: true };
  }

  if (!config.sapoEmail || !config.sapoPassword) {
    throw new AuthError('Live login requires SAPO credentials.', {
      emailConfigured: Boolean(config.sapoEmail)
    });
  }

  await performInteractiveLogin(page, {
    username: config.sapoEmail,
    password: config.sapoPassword
  });

  await settlePostLoginNavigation(page, logger);

  logger.info('sapo.login.after_submit', {
    url: page.url(),
    title: await page.title()
  });

  if (!(await isAuthenticated(page))) {
    const screenshotPath = join(config.artifactDir, 'auth', 'login-failure.png');
    const htmlPath = join(config.artifactDir, 'auth', 'login-failure.html');
    await page.screenshot(screenshotPath);
    const html = await page.content();
    await mkdir(join(config.artifactDir, 'auth'), { recursive: true });
    await writeFile(htmlPath, html, 'utf8');

    throw new AuthError('SAPO login failed: inbox not reachable after credential submit.', {
      screenshotPath,
      htmlPath
    });
  }

  logger.info('sapo.login.success', { path: page.url() });
  return { status: 'interactive-login', inboxReached: true };
}

async function isAuthenticated(page: BrowserPage): Promise<boolean> {
  const inboxShellSettled = await page.waitForSelector(
    'button:has-text("Nova mensagem"), a[href*="#/messages/SU5CT1g"], [title*="Caixa de Entrada"]',
    5_000
  );
  if (inboxShellSettled) {
    return true;
  }

  const url = page.url();
  const title = await page.title();
  const html = await page.content();

  if (title.includes('Caixa de Entrada')) {
    return true;
  }

  const inboxByUrl =
    url.includes('/inbox') || url.includes('/v7/#/messages') || url.includes('/messages/SU5CT1g');
  if (inboxByUrl) {
    return true;
  }

  const inboxSignals = ['Caixa de Entrada', 'Nova mensagem', 'Definições', 'SAPO MAIL'];

  if (inboxSignals.every((signal) => html.includes(signal))) {
    return true;
  }

  const inboxSelectorVisible = await page.waitForSelector(
    'a[href*="inbox"], [href*="#/messages/SU5CT1g"], [title*="Caixa de Entrada"]',
    2_000
  );
  return inboxSelectorVisible;
}

async function performInteractiveLogin(
  page: BrowserPage,
  credentials: { username: string; password: string }
): Promise<void> {
  await handleKnownInterstitials(page);

  await page.waitForSelector(
    'input[placeholder*="email"], input[placeholder*="telemóvel"], input[type="email"], input[name*="user"], input[name*="mail"]',
    10_000
  );
  await page.fill(
    'input[placeholder*="email"], input[placeholder*="telemóvel"], input[type="email"], input[name*="user"], input[name*="mail"]',
    credentials.username
  );
  await page.click('button:has-text("Continuar")');
  await page.waitForSelector('input[type="password"], input[placeholder*="password"]', 10_000);
  await page.fill('input[type="password"], input[placeholder*="password"]', credentials.password);
  await page.click('button:has-text("Continuar")');
  await page.waitForSelector('body', 10_000);
  await handleKnownInterstitials(page);
}

async function settlePostLoginNavigation(
  page: BrowserPage,
  logger: ModuleContext['logger']
): Promise<void> {
  const observedUrls = new Set<string>();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const currentUrl = page.url();
    observedUrls.add(currentUrl);

    if (await isAuthenticated(page)) {
      logger.info('sapo.login.navigation_settled', {
        attempt,
        currentUrl,
        observedUrls: Array.from(observedUrls)
      });
      return;
    }

    await handleKnownInterstitials(page);
    await page.waitForSelector('body', 2_500);
  }

  logger.warn('sapo.login.navigation_unsettled', {
    currentUrl: page.url(),
    observedUrls: Array.from(observedUrls)
  });
}

async function handleKnownInterstitials(page: BrowserPage): Promise<void> {
  const consentSelectors = [
    'button:has-text("Accept")',
    'button:has-text("Aceitar")',
    'button:has-text("ACEITAR")',
    'button#onetrust-accept-btn-handler'
  ];

  for (const selector of consentSelectors) {
    const visible = await page.isVisible(selector);
    if (visible) {
      await page.click(selector);
      return;
    }
  }

  const deferPasswordChangeSelectors = [
    'a[href*="shibboleth-idp/SSO"]',
    'a[href*="Shibboleth.sso"]',
    'a:has-text("Agora não")'
  ];

  for (const selector of deferPasswordChangeSelectors) {
    const visible = await page.isVisible(selector);
    if (visible) {
      await page.click(selector);
      return;
    }
  }
}
