'use strict';
const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem('nafi.' + k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('nafi.' + k, JSON.stringify(v)); } catch { } } };
let favs = LS.get('favs', []), recent = LS.get('recent', []), cat = 'All', current = null;
const cats = ['All', 'Favorites', ...new Set(TOOLS.map(t => t.cat))];
const FS_URL = 'https://103.180.245.108:39942/';

const TOOLS_API = {
  open(id, force) {
    const t = TOOLS.find(x => x.id === id) || TOOLS[0];
    if (current === t.id && !force) return;
    current = t.id; history.replaceState(null, '', '#' + t.id);
    recent = [t.id, ...recent.filter(x => x !== t.id)].slice(0, 5); LS.set('recent', recent);
    const w = $('#work'); w.innerHTML = ''; const box = document.createElement('div'); w.append(box);
    try { t.render(box); } catch (e) { box.innerHTML = '<p>This tool failed to load.</p>'; console.error(e); H.toast('Tool error: ' + e.message, true); }
    $('#side').classList.remove('open'); drawList();
  }
};

function drawList() {
  const q = $('#search').value.toLowerCase();
  $('#cats').innerHTML = cats.map(c => `<button class="${c === cat ? 'on' : ''}" data-c="${c}">${c}</button>`).join('');
  $('#cats').querySelectorAll('button').forEach(b => b.onclick = () => { cat = b.dataset.c; drawList(); });
  const shown = TOOLS.filter(t => (cat === 'All' || (cat === 'Favorites' ? favs.includes(t.id) : t.cat === cat)) && t.name.toLowerCase().includes(q));
  $('#list').innerHTML = shown.map(t => `<button data-t="${t.id}" class="${t.id === current ? 'on' : ''}"><span>${t.name}</span><span class="star ${favs.includes(t.id) ? 'on' : ''}" data-f="${t.id}" title="Favorite">★</span></button>`).join('') || '<p class="muted small">No tools match.</p>';
  $('#recent').innerHTML = recent.map(id => TOOLS.find(t => t.id === id)).filter(Boolean).map(t => `<button data-t="${t.id}">${t.name}</button>`).join('') || '<p class="muted small">Nothing yet.</p>';
  document.querySelectorAll('[data-t]').forEach(b => b.onclick = e => {
    const f = e.target.closest('[data-f]'); if (f) { const id = f.dataset.f; favs = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id]; LS.set('favs', favs); return drawList(); }
    TOOLS_API.open(b.dataset.t);
  });
}

async function checkFS() {
  const s = $('#fsStatus'); s.innerHTML = '<span class="spin"></span> Checking…';
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 8000);
  try { await fetch(FS_URL, { mode: 'no-cors', cache: 'no-store', signal: ac.signal }); s.textContent = '● Reachable from this browser'; s.style.color = '#22c55e'; }
  catch { s.textContent = '● Not reachable (offline, certificate not trusted, or blocked)'; s.style.color = '#f87171'; }
  clearTimeout(to); $('#fsTime').textContent = 'Last checked: ' + new Date().toLocaleTimeString();
}

$('#search').oninput = drawList;
$('#fsCheck').onclick = checkFS;
$('#menuBtn').onclick = () => $('#side').classList.toggle('open');
document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => TOOLS_API.open(b.dataset.open));
$('#themeBtn').onclick = () => { const d = document.documentElement, n = d.dataset.theme === 'dark' ? 'light' : 'dark'; d.dataset.theme = n; LS.set('theme', n); };
document.documentElement.dataset.theme = LS.get('theme', 'dark');
drawList(); TOOLS_API.open(location.hash.slice(1) || 'wmv', true);
