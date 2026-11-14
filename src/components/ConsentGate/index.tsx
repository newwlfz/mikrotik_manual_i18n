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
};

const COPY: Record<'en' | 'zh-Hans', Copy> = {
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
  },
};

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

/** The current page on the official site, without the zh-Hans route prefix. */
function officialUrl(): string {
  try {
    const pathname = window.location.pathname.replace(/^\/zh-Hans(?=\/|$)/, '') || '/';
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
  const {i18n} = useDocusaurusContext();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);

  const locale = i18n.currentLocale === 'zh-Hans' ? 'zh-Hans' : 'en';
  const copy = COPY[locale];

  useEffect(() => {
    setMounted(true);
    if (hasConsented()) return undefined;
    // The locale decision can be final before this effect runs: the `<head>`
    // script executes during parsing, long before hydration.
    if (isLocaleRedirecting()) return undefined;

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
      if (!redirecting) setOpen(true);
    };
    const onSettled = () => finish(isLocaleRedirecting());
    // A redirect decided *after* the gate was shown (the landing page's own
    // hop is one such case) must still withdraw it instead of letting the
    // visitor click a notice that is about to disappear.
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

  if (!mounted || !open) return null;

  return (
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
            onClick={() => window.location.assign(officialUrl())}>
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
  );
}
