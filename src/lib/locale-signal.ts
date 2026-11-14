/**
 * 语种侦测与首访版权框之间的单向信号。
 *
 * 每次整页加载，自动语种判断最终只会进入下面两个状态之一：
 *
 *   - `window.__LOCALE_REDIRECTING__ === true`：本次会整页跳走（跨站换语种，
 *     或落地页跳到文档入口）。版权框必须**不出现**：否则用户正要点，页面就
 *     被换掉了，到了目标站还会再弹一次，体验是「弹 → 跳 → 再弹」。
 *   - `window.__LOCALE_SETTLED__ === true`：语种已经定了，不会再有自动跳转，
 *     版权框可以按自己的存储状态决定是否展示。
 *
 * 写方（按时间先后）：
 *   1. `docusaurus.config.ts` 的 `localeRedirectScript` 内联进 `<head>` 的同步
 *      脚本：解析 HTML 时就下结论，因此跳转和「不跳转」都发生在首次绘制前，
 *      版权框水合时一定能读到已写好的标记；
 *   2. `src/clientModules/locale-detect.js`：兜底与客户端路由更新（进度条式
 *      导航）时再次判断，晚到的结论通过事件广播；
 *   3. `src/pages/index.tsx`：站点根 `/` 的落地页兜底跳转。
 *
 * 读方：`src/components/ConsentGate`。它同时监听两个事件，并有 1.5s 兜底，
 * 万一三个写方都没跑（旧构建产物、脚本被拦截），仍然按「不跳转」正常展示。
 *
 * `src/clientModules/locale-detect.js` 是纯 JS（`npm run test:locale` 直接用
 * node 导入它），不能导入本模块，所以那两处全局名/事件名是**同一份约定的
 * 复制**，改动时必须一起改；`work/consent-locale.e2e.mjs` 与浏览器检查会在
 * 端到端层面兜住漂移。
 */

export const LOCALE_SETTLED_EVENT = 'locale-settled';
export const LOCALE_REDIRECTING_EVENT = 'locale-redirecting';

declare global {
  interface Window {
    __LOCALE_SETTLED__?: boolean;
    __LOCALE_REDIRECTING__?: boolean;
  }
}

/** 本次加载已经决定整页跳转。 */
export function isLocaleRedirecting(): boolean {
  return typeof window !== 'undefined' && window.__LOCALE_REDIRECTING__ === true;
}

/** 语种已定，且不会再有自动跳转。 */
export function isLocaleSettled(): boolean {
  return typeof window !== 'undefined' && window.__LOCALE_SETTLED__ === true;
}

/**
 * 广播「语种已定」。幂等：重复调用不会重复派发事件，避免监听方重复处理。
 * 已经进入跳转状态时直接忽略，跳转中的页面不该再被判定为「已定」。
 */
export function markLocaleSettled(): void {
  if (typeof window === 'undefined' || isLocaleRedirecting()) return;
  if (window.__LOCALE_SETTLED__ === true) return;
  window.__LOCALE_SETTLED__ = true;
  window.dispatchEvent(new Event(LOCALE_SETTLED_EVENT));
}

/**
 * 广播「本次要跳转」。幂等；一旦置为 true 就不会退回。
 */
export function markLocaleRedirecting(): void {
  if (typeof window === 'undefined') return;
  if (window.__LOCALE_REDIRECTING__ === true) return;
  window.__LOCALE_REDIRECTING__ = true;
  window.dispatchEvent(new Event(LOCALE_REDIRECTING_EVENT));
}
