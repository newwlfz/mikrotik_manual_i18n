// Open a table in the official full-width modal instead of stretching it in
// place: the dialog dims the page, closes on backdrop click, the Close button
// and Escape, and restores the body scroll state.
//
// The SSR component (`src/components/WideTable`) passes the dialog labels as
// `data-modal-title` / `data-modal-close`, so those win. If a page ships a bare
// wrapper (old build artefact, hand-written HTML), the fallback follows the
// page locale from `<html lang>` instead of hard-coding one English wording.
if (typeof document !== 'undefined') {
  const FALLBACK_COPY = {
    en: {title: 'Table View', close: 'Close'},
    'zh-Hans': {title: '表格视图', close: '关闭'},
    'zh-Hant': {title: '表格檢視', close: '關閉'},
  };

  function fallbackCopy() {
    const locale = document.documentElement?.lang;
    return FALLBACK_COPY[locale] ?? FALLBACK_COPY.en;
  }

  let open = null;

  const onKeydown = (event) => {
    if (event.key === 'Escape') closeModal();
  };

  const closeModal = () => {
    if (!open) return;
    const {root, scroll} = open;
    open = null;
    root.remove();
    document.body.style.overflow = scroll;
    document.removeEventListener('keydown', onKeydown);
  };

  const openModal = (container) => {
    const table = container.querySelector('table');
    if (!table) return;
    closeModal();

    const root = document.createElement('div');
    root.className = 'wideTableModalRoot';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');

    const backdrop = document.createElement('div');
    backdrop.className = 'wideTableBackdrop';
    backdrop.addEventListener('click', closeModal);

    const dialog = document.createElement('div');
    dialog.className = 'wideTableDialog';

    const header = document.createElement('div');
    header.className = 'wideTableHeader';
    const fallback = fallbackCopy();
    const title = document.createElement('strong');
    title.textContent = container.dataset.modalTitle || fallback.title;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = container.dataset.modalClose || fallback.close;
    button.addEventListener('click', closeModal);
    header.append(title, button);

    const body = document.createElement('div');
    body.className = 'wideTableBody';
    body.append(table.cloneNode(true));

    dialog.append(header, body);
    root.append(backdrop, dialog);
    root.setAttribute('aria-label', title.textContent);
    document.body.append(root);

    open = {root, scroll: document.body.style.overflow};
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeydown);
    button.focus();
  };

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('.wideTableToolbar button');
    if (!button) return;
    const container = button.closest('.wideTableInline');
    if (container) openModal(container);
  });
}
