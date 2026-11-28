import React, {useEffect, useState} from 'react';

const STORAGE_KEY = 'content-wide';

export default function WidthToggle() {
  const [wide, setWide] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) === 'true';
    setWide(stored);
    document.documentElement.classList.toggle('content-wide', stored);
    setMounted(true);
  }, []);

  function toggle() {
    const next = !wide;
    setWide(next);
    document.documentElement.classList.toggle('content-wide', next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  return (
    <button
      type="button"
      className="navbar__item navbar__link"
      style={{cursor: 'pointer', background: 'none', border: 'none', font: 'inherit'}}
      onClick={toggle}
      aria-pressed={wide}
      title={wide ? 'Restore default content width' : 'Widen content width'}
      disabled={!mounted}>
      {wide ? 'Narrow' : 'Widen'}
    </button>
  );
}
