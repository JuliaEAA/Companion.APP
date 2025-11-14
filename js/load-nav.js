// Loads HTML snippets indicated by [data-include] attributes and sets active tab
document.addEventListener('DOMContentLoaded', () => {
  const includes = document.querySelectorAll('[data-include]');
  includes.forEach(async (el) => {
    const url = el.getAttribute('data-include');
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      el.innerHTML = html;

      // After injection, compute active tab by matching location
      try {
        const path = window.location.pathname.split('/').pop() || '';
        const anchors = el.querySelectorAll('.tab-item a');
        anchors.forEach(a => a.parentElement.classList.remove('active'));
        // try exact match first
        let matched = false;
        anchors.forEach(a => {
          const href = a.getAttribute('href') || '';
          if (href === path || href === window.location.pathname) {
            a.parentElement.classList.add('active'); matched = true;
          }
        });
        if (!matched) {
          // fallback: mark link whose href is contained in location.href
          anchors.forEach(a => {
            const href = a.getAttribute('href') || '';
            if (href && window.location.href.includes(href)) a.parentElement.classList.add('active');
          });
        }
      } catch (err) {
        // non-fatal
        console.warn('nav loader: active tab detection failed', err);
      }

    } catch (err) {
      console.error('Failed to load include:', url, err);
    }
  });
});
