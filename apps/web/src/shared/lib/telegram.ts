import {
  backButton,
  bindViewportCssVars,
  disableVerticalSwipes,
  expandViewport,
  hapticFeedbackImpactOccurred,
  hapticFeedbackNotificationOccurred,
  init,
  miniAppReady,
  mockTelegramEnv,
  mountBackButton,
  mountMiniAppSync,
  mountSwipeBehavior,
  mountViewport,
  openTelegramLink,
  retrieveRawInitData,
} from '@telegram-apps/sdk-react';

let rawInitData: string | undefined;

/** Raw initData for the `Authorization: tma ...` header. */
export function getRawInitData(): string | undefined {
  return rawInitData;
}

/**
 * DEV ONLY: imitates the Telegram client in a normal browser.
 * The signed initData comes from the Vite dev server (see dev/init-data-plugin.ts).
 */
async function mockForDev(): Promise<void> {
  const res = await fetch('/__dev/init-data');
  if (!res.ok) throw new Error(await res.text());
  const tgWebAppData = await res.text();
  mockTelegramEnv({
    launchParams: {
      tgWebAppData,
      tgWebAppVersion: '8.0',
      tgWebAppPlatform: 'tdesktop',
      tgWebAppThemeParams: { bg_color: '#0f172a', text_color: '#f1f5f9' },
    },
    onEvent: () => {
      // The browser has no Telegram client to answer method calls.
    },
  });
}

function isInsideTelegram(): boolean {
  return /tgWebAppData=/.test(window.location.hash) || 'TelegramWebviewProxy' in window;
}

/** ready + expand, disable swipe-to-close, bind viewport/safe-area CSS vars. */
export async function initTelegram(): Promise<void> {
  if (import.meta.env.DEV && !isInsideTelegram()) await mockForDev();
  try {
    init();
  } catch {
    // Not in Telegram and no mock (e.g. production opened in a browser). The API will reply 401.
    return;
  }
  rawInitData = retrieveRawInitData();

  if (mountMiniAppSync.isAvailable()) mountMiniAppSync();
  if (mountBackButton.isAvailable()) mountBackButton();
  if (mountSwipeBehavior.isAvailable()) {
    mountSwipeBehavior();
    if (disableVerticalSwipes.isAvailable()) disableVerticalSwipes();
  }
  if (mountViewport.isAvailable()) {
    // Without a real Telegram client (dev mock) nobody answers the viewport request,
    // so do not let it block the first render.
    await Promise.race([mountViewport(), new Promise((r) => setTimeout(r, 1000))]);
    if (bindViewportCssVars.isAvailable()) bindViewportCssVars();
    if (expandViewport.isAvailable()) expandViewport();
  }
  if (miniAppReady.isAvailable()) miniAppReady();
}

export const haptic = {
  light() {
    if (hapticFeedbackImpactOccurred.isAvailable()) hapticFeedbackImpactOccurred('light');
  },
  success() {
    if (hapticFeedbackNotificationOccurred.isAvailable())
      hapticFeedbackNotificationOccurred('success');
  },
  error() {
    if (hapticFeedbackNotificationOccurred.isAvailable())
      hapticFeedbackNotificationOccurred('error');
  },
};

export function openTgLink(url: string): void {
  if (openTelegramLink.isAvailable()) openTelegramLink(url);
  else window.open(url, '_blank', 'noopener');
}

/** Shows the native back button and returns a cleanup. Falls back to nothing outside Telegram. */
export function bindNativeBackButton(visible: boolean, onBack: () => void): () => void {
  if (!backButton.isMounted()) return () => undefined;
  if (!visible) {
    backButton.hide();
    return () => undefined;
  }
  backButton.show();
  return backButton.onClick(onBack);
}
