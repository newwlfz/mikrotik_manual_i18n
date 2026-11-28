import React, {useEffect, useRef, useState, type ReactNode} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {
  LOCALE_REDIRECTING_EVENT,
  LOCALE_SETTLED_EVENT,
  isLocaleRedirecting,
  isLocaleSettled,
} from '../../lib/locale-signal';

/**
 * One-time first-visit notice.
 *
 * The notice is a deliberate gate: it cannot be dismissed with Escape, a
 * backdrop click or a close button, so the visitor has to read it and choose
 * either "continue" (remembered in localStorage *and* a cookie) or "go to the
 * official documentation".
 *
 * The gate also waits for the automatic locale decision (`src/lib/locale-signal.ts`):
 * a Chinese browser on an English page is redirected before the notice can
 * appear, so the visitor never gets "notice pops up → page jumps → notice pops
 * up again". Only a settled locale (no redirect) shows it, and only once per
 * page load.
 *
 * Nothing here runs during SSR: the saved decision and the locale signal live in
 * browser storage/globals, so the component renders nothing until after
 * hydration (`mounted`). That keeps the server HTML and the first client render
 * identical.
 */

const STORAGE_KEY = 'mikrotik-consent';
const COOKIE_NAME = 'mikrotik_consent';
const COOKIE_MAX_AGE = 31536000;
const OFFICIAL_ORIGIN = 'https://manual.mikrotik.com';

/**
 * How long the gate waits for a locale decision before treating the page as
 * settled. The `<head>` script writes the signal before the first paint, so
 * this only matters when that script did not run (old build artefact, blocked
 * inline script, embedded copy of the client module): the notice must not stay
 * invisible forever.
 */
const LOCALE_SETTLE_TIMEOUT_MS = 1500;

/**
 * Keep the loading curtain mounted for one CSS fade-out after the locale
 * settles. Must stay in sync with `.consentGateLoading` in `src/css/custom.css`.
 */
const OVERLAY_FADE_MS = 240;

type OverlayPhase = 'checking' | 'leaving' | 'gone';

type Copy = {
  title: string;
  purposeHeading: string;
  purpose: string;
  scopeHeading: string;
  scope: string;
  copyrightHeading: string;
  copyright: string;
  period: string;
  accept: string;
  official: string;
  loading: string;
};

const COPY = {
  en: {
    title: 'Before you continue',
    purposeHeading: 'Purpose',
    purpose:
      'This mirror helps people who do not read English comfortably use the official MikroTik RouterOS manual.',
    scopeHeading: 'Translation scope',
    scope:
      'Only natural-language prose is translated. RouterOS interface text, commands, parameters and enumeration values always follow the official English documentation.',
    copyrightHeading: 'Copyright',
    copyright:
      'Documentation and trademarks belong to MikroTik. This site is for learning only and cannot replace the official manual. Please refer to the original pages at',
    period: '.',
    accept: 'I understand, continue',
    official: 'Go to the official documentation',
    loading: 'Checking your language…',
  },
  'zh-Hans': {
    title: '使用前请阅读',
    purposeHeading: '建站目的',
    purpose:
      '本站用于方便非英语母语的用户阅读 MikroTik 官方 RouterOS 手册，内容取自官方文档。',
    scopeHeading: '翻译范围',
    scope:
      '我们只翻译自然语言说明。RouterOS 的界面、命令、参数与枚举值一律以官方英文原文为准。',
    copyrightHeading: '版权',
    copyright:
      '文档内容与商标归 MikroTik 所有。本站仅供学习交流，不能替代官方文档；请以官方原文为准，并访问',
    period: '。',
    accept: '我已了解，继续访问',
    official: '前往官方文档',
    loading: '正在确认语种，请稍候…',
  },
  'zh-Hant': {
    title: '使用前請閱讀',
    purposeHeading: '建站目的',
    purpose:
      '本站用於方便非英語母語的使用者閱讀 MikroTik 官方 RouterOS 手冊，內容取自官方文件。',
    scopeHeading: '翻譯範圍',
    scope:
      '我們只翻譯自然語言說明。RouterOS 的介面、命令、參數與列舉值一律以官方英文原文為準。',
    copyrightHeading: '版權',
    copyright:
      '文件內容與商標歸 MikroTik 所有。本站僅供學習交流，不能取代官方文件；請以官方原文為準，並造訪',
    period: '。',
    accept: '我已了解，繼續',
    official: '前往官方文件',
    loading: '正在確認語言，請稍候…',
  },
} satisfies Record<string, Copy>;

/** Unknown / missing locale falls back to English (any build without that locale). */
function copyFor(locale: string | undefined): Copy {
  return (COPY as Record<string, Copy>)[locale ?? 'en'] ?? COPY.en;
}

function hasCookie(name: string): boolean {
  if (typeof document === 'undefined') return false;
  const prefix = `${name}=`;
  return document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .some((entry) => entry.startsWith(prefix));
}

/** The visitor already accepted in either storage mechanism. */
function hasConsented(): boolean {
  try {
    if (window.localStorage.getItem(STORAGE_KEY) !== null) return true;
  } catch {
    // Private mode can deny localStorage; fall through to the cookie.
  }
  return hasCookie(COOKIE_NAME);
}

function rememberConsent() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Not fatal: the cookie below is enough to suppress the next notice.
  }
  try {
    document.cookie = `${COOKIE_NAME}=1; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    // Cookies can be disabled; localStorage already recorded the decision.
  }
}

/** Normalize a deployment base path to leading + trailing `/`. */
function normalizeBasePath(value: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

/**
 * The site's deployment root *without* a locale suffix. The current build
 * injects `<meta name="docusaurus-base-url">` into every page's `<head>`
 * (see `docusaurus.config.ts`), so that is the authoritative source. Stale
 * builds fall back to `siteConfig.baseUrl`, which Docusaurus localizes for
 * non-default locales (`/repo/zh-Hans/`) — strip that suffix first.
 */
function siteBasePath(configuredBase: string | undefined, locale: string | undefined): string {
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="docusaurus-base-url"]');
    const fromMeta = meta?.getAttribute('content')?.trim();
    if (fromMeta) return normalizeBasePath(fromMeta);
  }
  if (typeof configuredBase === 'string' && configuredBase.trim()) {
    let base = normalizeBasePath(configuredBase);
    if (locale) {
      const suffix = `${locale}/`;
      if (base.endsWith(suffix)) base = base.slice(0, -suffix.length) || '/';
    }
    return base;
  }
  return '/';
}

/**
 * The current page on the official site, without this site's deployment
 * prefix or a Chinese route prefix.
 *
 * The official manual has neither `/mikrotik_manual_i18n/`-style per-repo
 * prefixes nor a `/zh-Hans/` / `/zh-Hant/` tree. Both are stripped before the
 * origin is swapped — the prefix is *derived* from the injected base URL (never
 * hardcoded) so per-locale repos and renamed deployments inherit the fix.
 */
function officialUrl(configuredBase: string | undefined, locale: string | undefined): string {
  try {
    const base = siteBasePath(configuredBase, locale);
    let pathname = window.location.pathname;
    // Strip the deployment prefix (e.g. `/repo/`) first; a localized page is
    // `/repo/zh-Hans/docs/...`, so the locale sits *after* the prefix.
    if (base !== '/' && (pathname === base.slice(0, -1) || pathname.startsWith(base))) {
      pathname = pathname.slice(base.length - 1) || '/';
    }
    pathname = pathname.replace(/^\/zh-(?:Hans|Hant)(?=\/|$)/, '') || '/';
    return `${OFFICIAL_ORIGIN}${pathname}${window.location.search}`;
  } catch {
    return `${OFFICIAL_ORIGIN}/`;
  }
}

function focusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('disabled'));
}

export default function ConsentGate(): ReactNode {
  const {i18n, siteConfig} = useDocusaurusContext();
  const [mounted, setMounted] = useState(false);
  const [overlayPhase, setOverlayPhase] = useState<OverlayPhase>('checking');
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);

  // Read at render time, not cached at mount: once the locale signal settles
  // the page may already be the target locale, and the dialog must show *that*
  // locale's copy rather than a caption captured before the decision.
  const copy = copyFor(i18n?.currentLocale);

  useEffect(() => {
    setMounted(true);

    let fadeTimer: number | undefined;

    // A returning visitor (or a page that is already redirecting) has no
    // dialog to reveal, so there is nothing for a curtain to hide. Drop it
    // immediately instead of flashing a loading screen.
    if (hasConsented() || isLocaleRedirecting()) {
      setOverlayPhase('gone');
      return undefined;
    }

    // `settled` is the "render at most once" latch: duplicate events, the
    // fallback timer and the late redirect signal all funnel through one
    // decision, so the gate can never be mounted twice or re-animate.
    let settled = false;
    let timer: number | undefined;

    const finish = (redirecting: boolean) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener(LOCALE_SETTLED_EVENT, onSettled);
      window.removeEventListener(LOCALE_REDIRECTING_EVENT, onRedirecting);
      if (redirecting) {
        setOverlayPhase('gone');
        return;
      }
      // Reveal the dialog in the locale that has just settled. Keep the
      // curtain mounted for one CSS transition so it fades out (opacity +
      // visibility) instead of vanishing, and never blocks a click meanwhile.
      setOpen(true);
      setOverlayPhase('leaving');
      fadeTimer = window.setTimeout(() => setOverlayPhase('gone'), OVERLAY_FADE_MS);
    };
    const onSettled = () => finish(isLocaleRedirecting());
    // A redirect decided *after* the curtain was up (the landing page's own
    // hop is one such case) must still withdraw the gate instead of letting
    // the visitor click a notice that is about to disappear.
    const onRedirecting = () => finish(true);

    window.addEventListener(LOCALE_SETTLED_EVENT, onSettled);
    window.addEventListener(LOCALE_REDIRECTING_EVENT, onRedirecting);
    timer = window.setTimeout(() => finish(isLocaleRedirecting()), LOCALE_SETTLE_TIMEOUT_MS);

    // Re-read the flags: the signal may have been emitted before this listener
    // existed (the `<head>` script cannot wait for React).
    if (isLocaleRedirecting()) finish(true);
    else if (isLocaleSettled()) finish(false);

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer);
      window.removeEventListener(LOCALE_SETTLED_EVENT, onSettled);
      window.removeEventListener(LOCALE_REDIRECTING_EVENT, onRedirecting);
    };
  }, []);

  // Focus management, focus trap, Escape suppression and the scroll lock live
  // together: all of them start when the dialog opens and are undone on close.
  useEffect(() => {
    if (!open) return undefined;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    acceptRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // A choice is mandatory: Escape must not dismiss the gate, and must not
        // reach the zoom/table dialogs underneath either.
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusableElements(dialogRef.current);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Clicking non-focusable chrome can otherwise move the focus to <body> and
    // let the next Tab escape the dialog.
    const onFocusIn = (event: FocusEvent) => {
      const dialog = dialogRef.current;
      if (dialog && event.target instanceof Node && !dialog.contains(event.target)) {
        acceptRef.current?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
      document.body.style.overflow = bodyOverflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;

  // Until the locale decision is final, show a full-screen curtain with a
  // loading hint *instead of* the dialog. This is what prevents the
  // "English box → locale switch → translated box" flash: no dialog copy is
  // painted until the locale can no longer change.
  const curtain =
    overlayPhase === 'gone' ? null : (
      <div
        className={`consentGateLoading${overlayPhase === 'leaving' ? ' consentGateLoading--leaving' : ''}`}
        data-testid="consent-loading"
        role="status"
        aria-live="polite">
        <div className="consentGateLoadingPanel">
          <div className="consentGateSpinner" aria-hidden="true" />
          <p className="consentGateLoadingText">{copy.loading}</p>
        </div>
      </div>
    );

  if (!open) return curtain;

  return (
    <>
      {curtain}
      <div className="consentGateRoot" data-testid="consent-gate">
        <div
          ref={dialogRef}
          className="consentGateDialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-gate-title"
          aria-describedby="consent-gate-body">
          <h2 id="consent-gate-title" className="consentGateTitle">
            {copy.title}
          </h2>
          <div id="consent-gate-body" className="consentGateBody">
            <p>
              <strong>{copy.purposeHeading}</strong>
              <br />
              {copy.purpose}
            </p>
            <p>
              <strong>{copy.scopeHeading}</strong>
              <br />
              {copy.scope}
            </p>
            <p>
              <strong>{copy.copyrightHeading}</strong>
              <br />
              {copy.copyright}{' '}
              <a href={`${OFFICIAL_ORIGIN}/`} target="_blank" rel="noopener noreferrer">
                manual.mikrotik.com
              </a>
              {copy.period}
            </p>
          </div>
          <div className="consentGateActions">
            <button
              type="button"
              className="consentGateOfficial"
              data-testid="consent-official"
              onClick={() =>
                window.location.assign(officialUrl(siteConfig.baseUrl, i18n?.currentLocale))
              }>
              {copy.official}
            </button>
            <button
              ref={acceptRef}
              type="button"
              className="consentGateAccept"
              data-testid="consent-accept"
              onClick={() => {
                rememberConsent();
                setOpen(false);
              }}>
              {copy.accept}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
