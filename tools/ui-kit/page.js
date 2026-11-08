// page.js: UI kit page behaviour (viewport switch, hidden toggle, hover tooltip). Inlined by build.mjs after renderer.js.
(function () {
  'use strict';
  const KIT = window.KIT, R = window.KitRenderer;
  const VP = { desktop: [1920, 1080], laptop: [1280, 720], phone: [844, 390] };
  const state = { vp: 'laptop', showHidden: false };
  const byKey = {};
  for (const g of KIT.guis) byKey[g.key] = g;

  function drawScreens() {
    const [W, H] = VP[state.vp];
    for (const host of document.querySelectorAll('[data-screen]')) {
      R.renderScreen(byKey[host.dataset.screen], host, W, H, { showHidden: state.showHidden });
    }
  }
  function drawComponents() {
    for (const host of document.querySelectorAll('[data-comp]')) {
      const c = KIT.components[Number(host.dataset.comp)];
      let node = c.node, w = c.w, h = c.h;
      if (!node) {
        const hit = R.locate(byKey[c.gui], c.names, 1280, 720);
        if (!hit) { host.textContent = 'Not found in the export: ' + c.path; continue; }
        node = hit.node; w = hit.w; h = hit.h;
      }
      const scale = R.renderComponent(node, w, h, host, { showHidden: state.showHidden }, c.path);
      const label = document.getElementById('compsize-' + host.dataset.comp);
      if (label) label.textContent = `${Math.round(w)}×${Math.round(h)} px at 1280×720, drawn at ${Math.round(scale * 100)}%`;
    }
  }
  function drawApprox() {
    const ul = document.getElementById('approx-live');
    if (!ul) return;
    const entries = Object.entries(window.KIT_APPROX).sort((a, b) => b[1] - a[1]);
    ul.innerHTML = entries.length ? '' : '<li>None hit by the current view.</li>';
    for (const [k, v] of entries) {
      const li = document.createElement('li');
      li.textContent = `${k} (${v}×)`;
      ul.appendChild(li);
    }
  }
  function drawAll() {
    for (const k of Object.keys(window.KIT_APPROX)) delete window.KIT_APPROX[k];
    drawComponents();
    drawScreens();
    drawApprox();
  }

  for (const b of document.querySelectorAll('[data-vp]')) {
    b.addEventListener('click', () => {
      state.vp = b.dataset.vp;
      for (const o of document.querySelectorAll('[data-vp]')) o.setAttribute('aria-pressed', String(o === b));
      drawAll();
    });
  }
  document.getElementById('show-hidden').addEventListener('change', (e) => {
    state.showHidden = e.target.checked;
    document.body.classList.toggle('showing-hidden', state.showHidden);
    drawAll();
  });

  const tip = document.getElementById('tip');
  let hovered = null;
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest && e.target.closest('.rn:not(.rn-folder)');
    if (hovered) hovered.classList.remove('rn-hover');
    hovered = el;
    if (!el) { tip.hidden = true; return; }
    el.classList.add('rn-hover');
    tip.textContent = `${el.dataset.path}\n${el.dataset.cls} · ${el.dataset.wh} px${el.classList.contains('rn-hidden') ? ' · Visible=false' : ''}`;
    tip.hidden = false;
  });
  document.addEventListener('mousemove', (e) => {
    if (tip.hidden) return;
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    const y = e.clientY + 18 + tip.offsetHeight > window.innerHeight ? e.clientY - tip.offsetHeight - 10 : e.clientY + 18;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });

  let timer = null;
  window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(drawAll, 200); });

  const loads = [];
  for (const f of Object.values(KIT.fonts)) for (const face of f.faces) loads.push(document.fonts.load(`${face.style} ${face.weight} 16px ${f.css}`));
  Promise.allSettled(loads).then(() => document.fonts.ready).then(drawAll);
})();
