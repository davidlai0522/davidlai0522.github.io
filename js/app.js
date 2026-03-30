/**
 * APP.JS — Portfolio tab router & section loader
 *
 * Reads SECTIONS from config.js, builds nav dynamically,
 * and fetches/injects section HTML on navigation.
 */

(function () {
  'use strict';

  const cache = {};   // { sectionId: htmlString }
  let activeId = null;

  // ─── Entry point ───────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    buildNav();
    const initialId = getTabFromURL() || SECTIONS[0].id;
    navigate(initialId, /* pushState */ false);
  }

  // ─── Build nav tabs from SECTIONS registry ──────────────────
  function buildNav() {
    const container = document.getElementById('nav-tabs');
    SECTIONS.forEach(sec => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn';
      btn.textContent = sec.label;
      btn.dataset.id = sec.id;
      btn.setAttribute('aria-label', `Navigate to ${sec.label} section`);
      btn.addEventListener('click', () => navigate(sec.id));
      container.appendChild(btn);
    });
  }

  // ─── Navigate to a section ──────────────────────────────────
  async function navigate(id, push = true) {
    if (id === activeId) return;

    const section = SECTIONS.find(s => s.id === id);
    if (!section) {
      console.warn(`[app.js] No section registered with id: "${id}"`);
      return;
    }

    // Update nav active state
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.id === id);
    });

    // Update URL without reloading
    if (push) {
      const url = new URL(window.location);
      url.searchParams.set('tab', id);
      history.pushState({ tab: id }, '', url);
    }

    activeId = id;
    await loadSection(section);
  }

  // ─── Fetch & inject section HTML ────────────────────────────
  async function loadSection(section) {
    const mount = document.getElementById('content-mount');

    // Show spinner while loading
    mount.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>Loading…</span>
      </div>`;

    try {
      // Use cache to avoid refetching
      if (!cache[section.id]) {
        const res = await fetch(section.file);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        cache[section.id] = await res.text();
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'section-fade-in';
      wrapper.innerHTML = cache[section.id];

      mount.innerHTML = '';
      mount.appendChild(wrapper);

      // Scroll to top of content on navigation
      mount.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
      console.error('[app.js] Failed to load section:', section.file, err);
      mount.innerHTML = `
        <div class="loading-spinner">
          <span>⚠️ Could not load section. Run via a local server (not file://).</span>
          <code>python3 -m http.server 8080</code>
        </div>`;
    }
  }

  // ─── Read ?tab= from URL ────────────────────────────────────
  function getTabFromURL() {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && SECTIONS.find(s => s.id === tab)) return tab;
    return null;
  }

  // ─── Handle browser back/forward ────────────────────────────
  window.addEventListener('popstate', (e) => {
    const id = (e.state && e.state.tab) || SECTIONS[0].id;
    navigate(id, false);
  });

})();
