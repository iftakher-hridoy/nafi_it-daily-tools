'use strict';
const $ = (s, r = document) => r.querySelector(s);
const H = {
  toast(msg, err) { const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; $('#toasts').append(t); setTimeout(() => t.remove(), 4000); },
  size(b) { return b > 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : (b / 1e3).toFixed(0) + ' KB'; },
  save(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); },
  async copy(text) { try { await navigator.clipboard.writeText(text); H.toast('Copied to clipboard'); } catch { H.toast('Copy blocked by browser. Select the text and copy manually.', true); } },
  pad: n => String(n).padStart(2, '0'),
  hm: m => `${Math.floor(m / 60)}h ${H.pad(Math.round(m % 60))}m`,
  mins(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; },
  esc: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  drop(el, accept, cb) {
    el.innerHTML = '<div class="drop" tabindex="0">Drop a file here or click to choose</div><input type="file" hidden accept="' + accept + '">';
    const d = $('.drop', el), i = $('input', el);
    d.onclick = () => i.click(); d.onkeydown = e => e.key === 'Enter' && i.click();
    d.ondragover = e => { e.preventDefault(); d.classList.add('over'); }; d.ondragleave = () => d.classList.remove('over');
    d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); e.dataTransfer.files[0] && pick(e.dataTransfer.files[0]); };
    i.onchange = () => i.files[0] && pick(i.files[0]);
    function pick(f) { d.innerHTML = `<b>${H.esc(f.name)}</b><br><span class="mono">${H.size(f.size)}</span>`; cb(f); }
  },
  async json(url, opt) { const r = await fetch(url, opt); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
};

/* ---------- FFmpeg.wasm (single-thread, vendored locally) ---------- */
let ff = null;
async function getFF(onLog) {
  if (ff) return ff;
  if (!window.FFmpegWASM) throw new Error('FFmpeg files are missing from assets/vendor/');
  const f = new FFmpegWASM.FFmpeg();
  const base = new URL('assets/vendor/', location.href).href;
  await f.load({ coreURL: base + 'ffmpeg-core.js', wasmURL: base + 'ffmpeg-core.wasm' });
  return (ff = f);
}
function videoTool(id, name, mode, inAccept) {
  return {
    id, cat: 'Video', name, render(el) {
      const isConv = mode === 'convert', isTrim = mode === 'trim', isShot = mode === 'shot';
      el.innerHTML = `<h2>${name}</h2><div class="note">Runs fully in your browser with FFmpeg.wasm (single-thread build). Nothing is uploaded. Large files need as much free RAM as roughly 2–3× the file size; the practical limit is about 1–2 GB per file and it is slow compared with desktop software. First use downloads a 32 MB engine from this site.</div>
      <div id="dz"></div><div class="grid" id="opts">
      ${mode === 'compress' || isConv || mode === 'res' ? `<div><label>Quality (CRF, lower = better)</label><select id="crf"><option value="23">High (23)</option><option value="28" ${mode === 'compress' ? 'selected' : ''}>Medium (28)</option><option value="33">Small file (33)</option></select></div>
      <div><label>Resolution</label><select id="res"><option value="">Keep original</option><option value="1920">1080p (1920 wide)</option><option value="1280" ${mode === 'res' ? 'selected' : ''}>720p (1280 wide)</option><option value="854">480p (854 wide)</option><option value="640">360p (640 wide)</option></select></div>` : ''}
      ${isTrim ? '<div><label>Start (seconds or hh:mm:ss)</label><input id="ts" value="0"></div><div><label>End (seconds or hh:mm:ss)</label><input id="te" value="10"></div>' : ''}
      ${isShot ? '<div><label>Time (seconds or hh:mm:ss)</label><input id="ts" value="0"></div>' : ''}
      </div><div class="row"><button class="btn" id="go" disabled>${isShot ? 'Capture frame' : 'Start'}</button><button class="btn ghost" id="clr">Clear</button></div>
      <div class="bar"><i id="pg"></i></div><p class="mono small" id="st">Waiting for a file.</p><div id="res2"></div>`;
      let file = null; const go = $('#go', el);
      H.drop($('#dz', el), inAccept || 'video/*,.wmv,.avi,.mov,.mkv,.mp4', f => { file = f; go.disabled = false; });
      $('#clr', el).onclick = () => TOOLS_API.open(id, true);
      go.onclick = async () => {
        go.disabled = true; const st = $('#st', el), pg = $('#pg', el);
        try {
          st.innerHTML = '<span class="spin"></span> Loading FFmpeg engine…';
          const f = await getFF();
          const onP = ({ progress }) => { if (progress >= 0 && progress <= 1) { pg.style.width = (progress * 100).toFixed(0) + '%'; st.textContent = 'Processing… ' + (progress * 100).toFixed(0) + '%'; } };
          f.on('progress', onP);
          const inName = 'in_' + file.name.replace(/[^\w.]/g, '_');
          await f.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
          const crf = $('#crf', el)?.value || '28', w = $('#res', el)?.value;
          const vf = w ? ['-vf', `scale=${w}:-2`] : [];
          let out, args;
          if (isShot) { out = 'out.png'; args = ['-ss', $('#ts', el).value, '-i', inName, '-frames:v', '1', out]; }
          else if (isTrim) { out = 'out.mp4'; args = ['-ss', $('#ts', el).value, '-to', $('#te', el).value, '-i', inName, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', out]; }
          else { out = 'out.mp4'; args = ['-i', inName, ...vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf, '-c:a', 'aac', '-movflags', '+faststart', out]; }
          const code = await f.exec(args);
          f.off('progress', onP);
          if (code !== 0) throw new Error('FFmpeg exited with code ' + code + '. The file may be unsupported or the browser ran out of memory.');
          const data = await f.readFile(out);
          await f.deleteFile(inName); await f.deleteFile(out);
          const blob = new Blob([data.buffer], { type: isShot ? 'image/png' : 'video/mp4' });
          const dlName = file.name.replace(/\.[^.]+$/, '') + (isShot ? '_frame.png' : '_nafi.mp4');
          pg.style.width = '100%'; st.textContent = `Done. Output ${H.size(blob.size)} (input ${H.size(file.size)}).`;
          $('#res2', el).innerHTML = '<button class="btn" id="dl">Download</button>'; $('#dl', el).onclick = () => H.save(blob, dlName);
          H.toast('Processing finished');
        } catch (e) { st.textContent = 'Error: ' + e.message; H.toast(e.message, true); ff = null; }
        go.disabled = false;
      };
    }
  };
}
const durationTool = {
  id: 'vdur', cat: 'Video', name: 'Video Duration Calculator', render(el) {
    el.innerHTML = '<h2>Video Duration Calculator</h2><div class="note">Reads the file locally through your browser. Nothing is uploaded. Formats your browser cannot play (such as WMV) cannot be read.</div><div id="dz"></div><div id="o"></div>';
    H.drop($('#dz', el), 'video/*', f => {
      const v = document.createElement('video'); v.preload = 'metadata'; v.src = URL.createObjectURL(f);
      v.onloadedmetadata = () => { const d = v.duration; $('#o', el).innerHTML = `<p class="stat mono">${H.pad(Math.floor(d / 3600))}:${H.pad(Math.floor(d % 3600 / 60))}:${H.pad(Math.floor(d % 60))}</p><p class="muted">${v.videoWidth}×${v.videoHeight}, ${H.size(f.size)}</p>`; };
      v.onerror = () => H.toast('This browser cannot read that video format.', true);
    });
  }
};

/* ---------- Images ---------- */
const imageTool = {
  id: 'img', cat: 'Image & PDF', name: 'Image Converter / Compressor / Resizer', render(el) {
    el.innerHTML = `<h2>Image Converter, Compressor & Resizer</h2><div class="note">Processed locally with the browser canvas. Nothing is uploaded. WebP/AVIF output depends on your browser.</div><div id="dz"></div>
    <div class="grid"><div><label>Output format</label><select id="fmt"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></div>
    <div><label>Quality (JPG/WebP): <span id="qv">80</span>%</label><input type="range" id="q" min="10" max="100" value="80"></div>
    <div><label>Max width in px (blank = original)</label><input id="w" type="number" min="16"></div></div>
    <div class="row"><button class="btn" id="go" disabled>Convert</button></div><p class="mono small" id="st"></p><div id="res"></div>`;
    let file; $('#q', el).oninput = e => $('#qv', el).textContent = e.target.value;
    H.drop($('#dz', el), 'image/*', f => { file = f; $('#go', el).disabled = false; });
    $('#go', el).onclick = async () => {
      try {
        const bmp = await createImageBitmap(file), mw = +$('#w', el).value || bmp.width, sc = Math.min(1, mw / bmp.width);
        const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
        const x = c.getContext('2d'); const fmt = $('#fmt', el).value;
        if (fmt === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
        x.drawImage(bmp, 0, 0, c.width, c.height);
        c.toBlob(b => {
          if (!b || b.type !== fmt) return H.toast('Your browser does not support that output format.', true);
          const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[fmt];
          $('#st', el).textContent = `${c.width}×${c.height}, ${H.size(file.size)} → ${H.size(b.size)}`;
          $('#res', el).innerHTML = '<button class="btn" id="dl">Download</button>'; $('#dl', el).onclick = () => H.save(b, file.name.replace(/\.[^.]+$/, '') + '.' + ext);
        }, fmt, +$('#q', el).value / 100);
      } catch (e) { H.toast('Could not read this image: ' + e.message, true); }
    };
  }
};
const ocrTool = {
  id: 'ocr', cat: 'Image & PDF', name: 'Image to Text (OCR)', render(el) {
    el.innerHTML = `<h2>Image to Text (OCR)</h2><div class="note">Uses Tesseract.js. The image is processed in your browser and is not uploaded. The OCR engine and English language data are downloaded once from the jsDelivr CDN, so an internet connection is required on first use.</div><div id="dz"></div><div class="row"><button class="btn" id="go" disabled>Extract text</button><button class="btn ghost" id="cp">Copy</button></div><div class="bar"><i id="pg"></i></div><textarea class="out" id="o" placeholder="Result appears here"></textarea>`;
    let file; H.drop($('#dz', el), 'image/*', f => { file = f; $('#go', el).disabled = false; });
    $('#cp', el).onclick = () => H.copy($('#o', el).value);
    $('#go', el).onclick = async () => {
      try {
        if (!window.Tesseract) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'; s.onload = ok; s.onerror = () => no(new Error('Could not load Tesseract.js (offline?)')); document.head.append(s); });
        const r = await Tesseract.recognize(file, 'eng', { logger: m => { if (m.progress) $('#pg', el).style.width = (m.progress * 100) + '%'; } });
        $('#o', el).value = r.data.text; H.toast('Text extracted');
      } catch (e) { H.toast(e.message, true); }
    };
  }
};

/* ---------- Office / time ---------- */
const dutyTool = {
  id: 'duty', cat: 'Office & Time', name: 'Monthly Duty Hours Calculator', render(el) {
    const KEY = 'nafi.duty'; let rows = JSON.parse(localStorage.getItem(KEY) || '[]');
    el.innerHTML = `<h2>Monthly Duty Hours Calculator</h2><div class="note">Overnight shifts work automatically (for example 20:30 → 08:00 is 11h 30m). Records stay in this browser only.</div>
    <div class="grid"><div><label>Employee name</label><input id="n"></div><div><label>Date</label><input id="d" type="date"></div><div><label>Clock in</label><input id="ci" type="time" value="20:30"></div><div><label>Break start</label><input id="bs" type="time"></div><div><label>Break end</label><input id="be" type="time"></div><div><label>Clock out</label><input id="co" type="time" value="08:00"></div><div><label>Regular hours per shift</label><input id="std" type="number" value="8" step="0.5"></div></div>
    <div class="row"><button class="btn" id="add">Add record</button><button class="btn ghost" id="csv">Export CSV</button><button class="btn ghost" id="clr">Clear all</button></div><div id="tbl"></div>`;
    const calc = r => { const wrap = (a, b) => ((b - a) % 1440 + 1440) % 1440; const duty = wrap(H.mins(r.ci), H.mins(r.co));
      const brk = r.bs && r.be ? wrap(H.mins(r.bs), H.mins(r.be)) : 0; const net = duty - brk; return { duty, brk, net, ot: Math.max(0, net - r.std * 60) }; };
    const draw = () => {
      localStorage.setItem(KEY, JSON.stringify(rows)); const T = { duty: 0, brk: 0, net: 0, ot: 0 };
      const body = rows.map((r, i) => { const c = calc(r); for (const k in T) T[k] += c[k]; return `<tr><td>${H.esc(r.n)}</td><td>${r.d}</td><td>${r.ci}–${r.co}</td><td>${H.hm(c.duty)}</td><td>${H.hm(c.brk)}</td><td>${H.hm(c.net)}</td><td>${H.hm(c.ot)}</td><td><button data-i="${i}">✕</button></td></tr>`; }).join('');
      $('#tbl', el).innerHTML = rows.length ? `<div style="overflow:auto"><table class="mono"><tr><th>Name</th><th>Date</th><th>Shift</th><th>Duty</th><th>Break</th><th>Net</th><th>Overtime</th><th></th></tr>${body}<tr><th colspan="3">Monthly summary (${rows.length} records)</th><th>${H.hm(T.duty)}</th><th>${H.hm(T.brk)}</th><th>${H.hm(T.net)}</th><th>${H.hm(T.ot)}</th><th></th></tr></table></div>` : '<p class="muted">No records yet.</p>';
      el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { rows.splice(+b.dataset.i, 1); draw(); });
    };
    $('#add', el).onclick = () => { const r = { n: $('#n', el).value.trim(), d: $('#d', el).value, ci: $('#ci', el).value, bs: $('#bs', el).value, be: $('#be', el).value, co: $('#co', el).value, std: +$('#std', el).value || 8 };
      if (!r.n || !r.d || !r.ci || !r.co) return H.toast('Enter name, date, clock in and clock out.', true); if (!!r.bs !== !!r.be) return H.toast('Enter both break start and break end, or leave both empty.', true); rows.push(r); draw(); };
    $('#clr', el).onclick = () => { if (rows.length && confirm('Delete all records?')) { rows = []; draw(); } };
    $('#csv', el).onclick = () => { if (!rows.length) return H.toast('Nothing to export.', true); const q = s => '"' + String(s).replace(/"/g, '""') + '"'; const h = n => (n / 60).toFixed(2);
      const lines = [['Employee', 'Date', 'Clock In', 'Break Start', 'Break End', 'Clock Out', 'Duty Hours', 'Break Hours', 'Net Hours', 'Overtime Hours'].map(q).join(',')];
      rows.forEach(r => { const c = calc(r); lines.push([r.n, r.d, r.ci, r.bs, r.be, r.co, h(c.duty), h(c.brk), h(c.net), h(c.ot)].map(q).join(',')); });
      H.save(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv' }), 'duty-report.csv'); };
    draw();
  }
};
const dateDiffTool = {
  id: 'datediff', cat: 'Office & Time', name: 'Date Difference Calculator', render(el) {
    el.innerHTML = '<h2>Date Difference Calculator</h2><div class="grid"><div><label>From</label><input id="a" type="date"></div><div><label>To</label><input id="b" type="date"></div></div><p class="stat mono" id="o">—</p>';
    const f = () => { const a = $('#a', el).value, b = $('#b', el).value; if (!a || !b) return; const d = Math.round((new Date(b) - new Date(a)) / 864e5); $('#o', el).textContent = `${d} days (${(d / 7).toFixed(1)} weeks)`; };
    $('#a', el).onchange = $('#b', el).onchange = f;
  }
};

/* ---------- CCTV ---------- */
const incidentTool = {
  id: 'incident', cat: 'CCTV', name: 'Incident Report Generator', render(el) {
    el.innerHTML = `<h2>CCTV Incident Report Generator</h2><div class="grid"><div><label>Property name</label><input id="p"></div><div><label>Camera name</label><input id="c"></div><div><label>Incident date</label><input id="d" type="date"></div><div><label>Incident time</label><input id="t" type="time"></div></div>
    <label>Incident description</label><textarea id="ds" rows="4"></textarea><label style="margin-top:10px">Additional notes</label><textarea id="nt" rows="2"></textarea>
    <div class="row" style="margin-top:12px"><button class="btn" id="g">Generate report</button><button class="btn ghost" id="cp">Copy to clipboard</button></div><textarea class="out" id="o" readonly></textarea>`;
    $('#g', el).onclick = () => {
      const v = i => $('#' + i, el).value.trim(); if (!v('p') || !v('c') || !v('d') || !v('t') || !v('ds')) return H.toast('Fill in property, camera, date, time and description.', true);
      const dt = new Date(v('d') + 'T' + v('t')); const dStr = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), tStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      $('#o', el).value = `CCTV INCIDENT REPORT\n\nProperty: ${v('p')}\nCamera: ${v('c')}\nDate of Incident: ${dStr}\nTime of Incident: ${tStr} (${v('t')} hrs)\n\nSummary of Incident:\nOn ${dStr} at approximately ${tStr}, the CCTV camera "${v('c')}" at ${v('p')} recorded the following: ${v('ds')}${/[.!?]$/.test(v('ds')) ? '' : '.'}\n${v('nt') ? '\nAdditional Notes:\n' + v('nt') + '\n' : ''}\nThe relevant footage has been reviewed and can be provided upon request.\n\nReport prepared by: NAFi iT\nPrepared on: ${new Date().toLocaleString('en-GB')}`;
    };
    $('#cp', el).onclick = () => $('#o', el).value ? H.copy($('#o', el).value) : H.toast('Generate a report first.', true);
  }
};
const ampmTool = {
  id: 'ampm', cat: 'CCTV', name: 'AM/PM ↔ 24-Hour Converter', render(el) {
    el.innerHTML = '<h2>AM/PM ↔ 24-Hour Converter</h2><div class="grid"><div><label>Time</label><input id="t" type="time" value="20:30"></div></div><p class="stat mono" id="o"></p>';
    const f = () => { const v = $('#t', el).value; if (!v) return; const [h, m] = v.split(':').map(Number); $('#o', el).textContent = `${v} = ${(h % 12) || 12}:${H.pad(m)} ${h < 12 ? 'AM' : 'PM'}`; };
    $('#t', el).oninput = f; f();
  }
};
const footageTool = {
  id: 'footage', cat: 'CCTV', name: 'Footage Time Calculator', render(el) {
    el.innerHTML = '<h2>Footage Time Calculator</h2><div class="note">DVR/NVR clocks can drift. Enter what the recorder shows and the real time to get the offset, then enter the real incident time to find where to search on the recorder.</div><div class="grid"><div><label>Recorder shows</label><input id="a" type="time" step="1"></div><div><label>Actual time</label><input id="b" type="time" step="1"></div><div><label>Real incident time</label><input id="c" type="time" step="1"></div></div><p class="mono" id="o">—</p>';
    const s = t => { const [h, m, x] = t.split(':').map(Number); return h * 3600 + m * 60 + (x || 0); }, f = t => { t = (t % 86400 + 86400) % 86400; return `${H.pad(Math.floor(t / 3600))}:${H.pad(Math.floor(t % 3600 / 60))}:${H.pad(t % 60)}`; };
    const u = () => { const a = $('#a', el).value, b = $('#b', el).value, c = $('#c', el).value; if (!a || !b) return; const off = s(a) - s(b); $('#o', el).innerHTML = `Recorder offset: ${off >= 0 ? '+' : '−'}${Math.abs(off)} s (${off >= 0 ? 'ahead' : 'behind'})` + (c ? `<br><span class="stat">Search recorder at ${f(s(c) + off)}</span>` : ''); };
    el.querySelectorAll('input').forEach(i => i.oninput = u);
  }
};

/* ---------- Networking ---------- */
const ipTool = {
  id: 'ip', cat: 'Network', name: 'Public IP / ISP / Location', render(el) {
    el.innerHTML = '<h2>Public IP, ISP & Location</h2><div class="note">Uses the third-party service ipwho.is. Clicking Look up sends your public IP address to that service.</div><button class="btn" id="go">Look up</button><div id="o"></div>';
    $('#go', el).onclick = async () => {
      $('#o', el).innerHTML = '<span class="spin"></span>';
      try { const d = await H.json('https://ipwho.is/'); if (!d.success) throw new Error(d.message || 'Lookup failed');
        const rows = [['IP address', d.ip], ['IP version', d.type], ['ISP', d.connection?.isp], ['Organisation', d.connection?.org], ['ASN', d.connection?.asn], ['Country', d.country], ['Region', d.region], ['City', d.city], ['Time zone', d.timezone?.id]];
        $('#o', el).innerHTML = '<table class="mono">' + rows.filter(r => r[1]).map(r => `<tr><th>${r[0]}</th><td>${H.esc(r[1])}</td></tr>`).join('') + '</table><p class="muted small">Location is approximate and based on the IP address.</p>';
      } catch (e) { $('#o', el).innerHTML = ''; H.toast('Lookup failed: ' + e.message + '. An ad blocker or offline network can cause this.', true); }
    };
  }
};
const pingTool = {
  id: 'ping', cat: 'Network', name: 'Ping / Latency Test', render(el) {
    el.innerHTML = '<h2>Latency Test</h2><div class="note">Browsers cannot send ICMP ping. This measures HTTPS round-trip time to Cloudflare (10 requests).</div><button class="btn" id="go">Start</button><p class="mono" id="o"></p>';
    $('#go', el).onclick = async () => { const t = []; $('#o', el).innerHTML = '<span class="spin"></span>';
      try { for (let i = 0; i < 10; i++) { const s = performance.now(); await fetch('https://www.cloudflare.com/cdn-cgi/trace?' + Math.random(), { cache: 'no-store' }); t.push(performance.now() - s); }
        const avg = t.reduce((a, b) => a + b) / t.length; $('#o', el).innerHTML = `Min ${Math.min(...t).toFixed(0)} ms · Avg ${avg.toFixed(0)} ms · Max ${Math.max(...t).toFixed(0)} ms<br>Jitter ${(Math.max(...t) - Math.min(...t)).toFixed(0)} ms`;
      } catch { $('#o', el).textContent = ''; H.toast('Test failed. Check your connection.', true); } };
  }
};
const dnsTool = {
  id: 'dns', cat: 'Network', name: 'DNS Lookup', render(el) {
    el.innerHTML = '<h2>DNS Lookup</h2><div class="note">Queries Cloudflare DNS over HTTPS (cloudflare-dns.com). The domain you enter is sent to Cloudflare.</div><div class="grid"><div><label>Domain</label><input id="d" placeholder="example.com"></div><div><label>Record type</label><select id="t"><option>A</option><option>AAAA</option><option>MX</option><option>TXT</option><option>NS</option><option>CNAME</option></select></div></div><button class="btn" id="go">Look up</button><div id="o"></div>';
    $('#go', el).onclick = async () => { const d = $('#d', el).value.trim(); if (!d) return H.toast('Enter a domain.', true);
      try { const r = await H.json(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(d)}&type=${$('#t', el).value}`, { headers: { accept: 'application/dns-json' } });
        $('#o', el).innerHTML = r.Answer ? '<table class="mono">' + r.Answer.map(a => `<tr><td>${H.esc(a.name)}</td><td>TTL ${a.TTL}</td><td>${H.esc(a.data)}</td></tr>`).join('') + '</table>' : '<p class="muted">No records found (status ' + r.Status + ').</p>';
      } catch (e) { H.toast('DNS lookup failed: ' + e.message, true); } };
  }
};
const speedTool = {
  id: 'speed', cat: 'Network', name: 'Internet Speed Test', render(el) {
    el.innerHTML = `<h2>Internet Speed Test</h2><div class="note">Measures real transfer to and from Cloudflare's speed test servers (uses about 35 MB of data). Results vary with browser, Wi-Fi and server distance. Your IP, ISP and country come from ipwho.is.</div><button class="btn" id="go">Start test</button>
    <div class="grid"><div><label>Latency</label><div class="stat mono" id="l">—</div></div><div><label>Download</label><div class="stat mono" id="dn">—</div></div><div><label>Upload</label><div class="stat mono" id="up">—</div></div></div><p class="mono small" id="info"></p><div class="bar"><i id="pg"></i></div>`;
    $('#go', el).onclick = async function () {
      this.disabled = true; const set = (i, v) => $('#' + i, el).textContent = v, pg = $('#pg', el);
      try {
        const ip = await H.json('https://ipwho.is/').catch(() => null);
        if (ip?.success) $('#info', el).textContent = `${ip.ip} · ${ip.connection?.isp || 'ISP unknown'} · ${ip.city || ''} ${ip.country || ''}`;
        const lat = []; for (let i = 0; i < 5; i++) { const s = performance.now(); await fetch('https://speed.cloudflare.com/__down?bytes=0&r=' + Math.random(), { cache: 'no-store' }); lat.push(performance.now() - s); }
        set('l', Math.min(...lat).toFixed(0) + ' ms'); pg.style.width = '15%'; set('dn', 'testing…');
        const N = 25e6; let s = performance.now(), got = 0; const rd = (await fetch('https://speed.cloudflare.com/__down?bytes=' + N, { cache: 'no-store' })).body.getReader();
        for (; ;) { const { done, value } = await rd.read(); if (done) break; got += value.length; set('dn', (got * 8 / 1e6 / ((performance.now() - s) / 1e3)).toFixed(1) + ' Mbps'); pg.style.width = 15 + got / N * 45 + '%'; }
        set('up', 'testing…'); const blob = new Blob([new Uint8Array(10e6)]); s = performance.now();
        await new Promise((ok, no) => { const x = new XMLHttpRequest(); x.open('POST', 'https://speed.cloudflare.com/__up'); x.upload.onprogress = e => { set('up', (e.loaded * 8 / 1e6 / ((performance.now() - s) / 1e3)).toFixed(1) + ' Mbps'); pg.style.width = 60 + e.loaded / e.total * 40 + '%'; }; x.onload = ok; x.onerror = () => no(new Error('Upload blocked')); x.send(blob); });
        H.toast('Speed test complete');
      } catch (e) { H.toast('Speed test failed: ' + e.message, true); }
      this.disabled = false;
    };
  }
};

window.TOOLS = [
  videoTool('wmv', 'WMV to MP4', 'convert', '.wmv,video/x-ms-wmv'), videoTool('avi', 'AVI to MP4', 'convert', '.avi,video/x-msvideo'),
  videoTool('mov', 'MOV to MP4', 'convert', '.mov,video/quicktime'), videoTool('mkv', 'MKV to MP4', 'convert', '.mkv,video/x-matroska'),
  videoTool('vcomp', 'Video Compressor', 'compress'), videoTool('vtrim', 'Video Trimmer', 'trim'), videoTool('vshot', 'Video Screenshot / Frame', 'shot'),
  videoTool('vres', 'Video Resolution Converter', 'res'), durationTool, imageTool, ocrTool,
  dutyTool, dateDiffTool, incidentTool, ampmTool, footageTool, speedTool, ipTool, pingTool, dnsTool
];
