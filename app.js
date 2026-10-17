/* chartcut web - render 9:16 di browser, tanpa server */
(() => {
const $ = (s) => document.querySelector(s);
const Q = new URLSearchParams(location.search);

const video   = $('#video');
const preview = $('#preview');
const pctx    = preview.getContext('2d');

const S = {
  file: null, url: null,
  hook: 'Stop pakai RSI buat entry gold.', hookDur: 2.5,
  labels: [], brand: '', cta: 'SIMPAN VIDEO INI', ctaDur: 2,
  srtCues: [], extra: 1, posX: 0.5, posY: 0.5,
  pushin: true, pushinAmt: 0.12, fps: 30, mbps: 8, mute: false, speed: 1,
  ready: false, busy: false
};

/* ---------- util ---------- */
function fmt(t){ t=Math.max(0,t); return t.toFixed(1)+'s'; }

function wrap(ctx, text, maxW){
  const out = [];
  for (const para of String(text).split('\n')){
    let line = '';
    for (const w of para.split(/\s+/).filter(Boolean)){
      const cand = line ? line + ' ' + w : w;
      if (ctx.measureText(cand).width <= maxW) line = cand;
      else { if (line) out.push(line); line = w; }
    }
    if (line) out.push(line);
  }
  return out;
}

function block(ctx, text, cx, cy, size, color, maxW){
  if (!text) return;
  ctx.save();
  ctx.font = 'bold ' + size + 'px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const lines = wrap(ctx, text, maxW);
  if (!lines.length){ ctx.restore(); return; }
  const lh = size * 1.22, pad = size * 0.30;
  const bw = Math.max.apply(null, lines.map(l => ctx.measureText(l).width));
  const bh = lines.length * lh;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(cx - bw/2 - pad, cy - pad, bw + pad*2, bh + pad*0.6);
  ctx.fillStyle = color;
  lines.forEach((l, i) => ctx.fillText(l, cx, cy + i*lh));
  ctx.restore();
}

function parseSRT(txt){
  const out = [];
  const toSec = (s) => {
    const m = String(s).match(/(\d+):(\d+):(\d+)[,.](\d+)/);
    return m ? (+m[1])*3600 + (+m[2])*60 + (+m[3]) + (+m[4])/1000 : null;
  };
  for (const blk of String(txt).replace(/\r/g,'').trim().split(/\n\s*\n/)){
    const lines = blk.split('\n');
    const i = lines.findIndex(l => l.includes('-->'));
    if (i < 0) continue;
    const parts = lines[i].split('-->');
    const a = toSec(parts[0]), b = toSec(parts[1]);
    if (a === null || b === null) continue;
    out.push({ start:a, end:b, text: lines.slice(i+1).join('\n').trim() });
  }
  return out;
}

/* ---------- gambar satu frame ---------- */
function drawFrame(ctx, W, H, t, dur){
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return;

  const base = Math.max(W/vw, H/vh);
  const push = S.pushin ? 1 + S.pushinAmt * (t / Math.max(0.01, dur || 1)) : 1;
  const sc = base * Math.max(1, S.extra) * push;
  const dw = vw*sc, dh = vh*sc;
  const dx = -(dw - W) * S.posX, dy = -(dh - H) * S.posY;
  ctx.drawImage(video, dx, dy, dw, dh);

  const maxW = W * 0.84;

  if (S.brand) block(ctx, S.brand, W/2, H*0.035, H*0.0198, 'rgba(255,255,255,0.85)', maxW);

  if (S.hook && t <= S.hookDur)
    block(ctx, S.hook, W/2, H*0.145, H*0.0385, '#ffffff', maxW);

  for (const lb of S.labels){
    if (t >= lb.start && t <= lb.end)
      block(ctx, lb.text, W/2, H*0.45, H*0.0281, '#ffeb3b', maxW);
  }

  if (S.cta && dur && t >= dur - S.ctaDur)
    block(ctx, S.cta, W/2, H*0.42, H*0.0344, '#ffffff', maxW);

  const cue = S.srtCues.find(c => t >= c.start && t <= c.end);
  if (cue) block(ctx, cue.text, W/2, H*0.88, H*0.026, '#ffffff', W*0.8);
}

/* ---------- preview ---------- */
let previewRAF = null;
function previewLoop(){
  if (S.ready){
    const d = video.duration || 1;
    drawFrame(pctx, preview.width, preview.height, video.currentTime, d);
  }
  previewRAF = requestAnimationFrame(previewLoop);
}

/* ---------- label rows ---------- */
function renderLabels(){
  const box = $('#labels');
  box.innerHTML = '';
  S.labels.forEach((lb, i) => {
    const row = document.createElement('div');
    row.className = 'label-row';
    row.innerHTML =
      '<input type="text" placeholder="Liquidity" value="' + (lb.text||'').replace(/"/g,'&quot;') + '">' +
      '<input type="number" step="0.5" min="0" value="' + lb.start + '" title="mulai (s)">' +
      '<input type="number" step="0.5" min="0" value="' + lb.end + '" title="selesai (s)">' +
      '<button type="button" title="hapus">&times;</button>';
    const [txt, a, b, del] = row.querySelectorAll('input,button');
    txt.oninput = () => { S.labels[i].text = txt.value; };
    a.oninput  = () => { S.labels[i].start = parseFloat(a.value) || 0; };
    b.oninput  = () => { S.labels[i].end   = parseFloat(b.value) || 0; };
    del.onclick = () => { S.labels.splice(i,1); renderLabels(); };
    box.appendChild(row);
  });
}

/* ---------- muat video ---------- */
function loadVideo(src, name){
  S.url = src;
  video.src = src;
  video.muted = true;
  video.load();
  video.onloadedmetadata = () => {
    S.ready = true;
    $('#phEmpty').classList.add('hidden');
    $('#render').disabled = false;
    const d = video.duration;
    if (!S.labels.length){
      S.labels = [{ text:'Liquidity', start: Math.min(4, d*0.2), end: Math.min(11, d*0.55) }];
      renderLabels();
    }
    $('#fileinfo').textContent = (name||'video') + ' - ' + video.videoWidth + 'x' + video.videoHeight +
      ', ' + fmt(d) + ' -> output 1080x1920';
    video.currentTime = 0;
    video.play().catch(()=>{});
  };
  video.onerror = () => { $('#fileinfo').textContent = 'Gagal memuat video.'; };
}

/* ---------- render (WebCodecs, deterministik) ---------- */
function setStatus(t){ $('#status').textContent = t; }
function setProg(p){ $('#progfill').style.width = Math.max(0, Math.min(1, p))*100 + '%'; }
async function pickVideoCodec(w, h, fps, bitrate){
  const cands = ['avc1.640033','avc1.4D0033','avc1.42002A','avc1.4D002A','avc1.420028','avc1.42E033','vp09.00.10.08'];
  for (const c of cands){
    try{
      const r = await VideoEncoder.isConfigSupported({ codec:c, width:w, height:h, bitrate, framerate:fps });
      if (r && r.supported) return c;
    }catch(e){}
  }
  return null;
}

function seekTo(t){
  return new Promise(res => {
    let done = false;
    const fin = () => { if (done) return; done = true; video.removeEventListener('seeked', fin); res(); };
    video.addEventListener('seeked', fin);
    try { video.currentTime = t; } catch(e){ fin(); }
    setTimeout(fin, 600);
  });
}

/* audio: decode file -> PCM -> AAC */
async function setupAudio(file){
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !window.AudioEncoder) return null;
    const ac = new AC();
    const buf = await ac.decodeAudioData(await file.arrayBuffer());
    await ac.close();
    if (!buf || !buf.length) return null;
    const cfg = { codec:'mp4a.40.2', sampleRate: buf.sampleRate,
                  numberOfChannels: Math.min(2, buf.numberOfChannels), bitrate: 128000 };
    const sup = await AudioEncoder.isConfigSupported(cfg);
    if (!sup || !sup.supported) return null;
    return { buf, cfg };
  }catch(e){ return null; }
}

async function render(){
  if (S.busy || !S.ready) return;
  S.busy = true; $('#render').disabled = true; $('#dl').classList.add('hidden');
  setProg(0);
  const t0 = performance.now();

  try{
    if (!window.VideoEncoder) throw new Error('Browser tidak mendukung WebCodecs. Pakai Chrome/Edge terbaru.');
    const { Muxer, ArrayBufferTarget } = await import('./vendor/mp4-muxer/mp4-muxer.mjs');

    const W = 1080, H = 1920;
    const dur = video.duration || 1;
    const fps = S.fps;
    const bitrate = Math.round(S.mbps * 1000000);

    const cvs = document.createElement('canvas');
    cvs.width = W; cvs.height = H;
    const ctx = cvs.getContext('2d', { alpha:false });

    /* audio dulu, supaya konfigurasi muxer lengkap sejak awal */
    setStatus('Menyiapkan audio...');
    let audio = null;
    if (S.mute) setStatus('Audio dibuang sesuai setelan.');
    else if (!S.file) setStatus('Audio dilewati (sumber bukan berkas lokal).');
    else audio = await setupAudio(S.file);

    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: { codec:'avc', width:W, height:H, frameRate:fps },
      audio: audio ? { codec:'aac', sampleRate:audio.cfg.sampleRate,
                       numberOfChannels:audio.cfg.numberOfChannels } : undefined,
      fastStart: 'in-memory'
    });

    const codec = await pickVideoCodec(W, H, fps, bitrate);
    if (!codec) throw new Error('Tidak ada codec H.264 yang didukung.');

    const venc = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: e => { throw e; }
    });
    venc.configure({ codec, width:W, height:H, bitrate, framerate:fps, latencyMode:'quality' });

    /* ---- frame loop ---- */
    video.pause(); video.muted = true;
    const total = Math.max(1, Math.round(dur * fps));
    setStatus('Merender ' + total + ' frame...');

    for (let i = 0; i < total; i++){
      const t = i / fps;
      await seekTo(t);
      drawFrame(ctx, W, H, t, dur);
      const frame = new VideoFrame(cvs, {
        timestamp: Math.round(t * 1e6),
        duration: Math.round(1e6 / fps)
      });
      venc.encode(frame, { keyFrame: (i % (fps * 2) === 0) });
      frame.close();
      if (i % 5 === 0){
        setProg(i / total);
        setStatus('Merender frame ' + i + ' / ' + total);
        await new Promise(r => setTimeout(r, 0));
      }
      while (venc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 4));
    }
    await venc.flush();
    venc.close();

    /* ---- audio encode ---- */
    if (audio){
      setStatus('Menyandikan audio...');
      const aenc = new AudioEncoder({
        output: (c, m) => muxer.addAudioChunk(c, m),
        error: e => console.warn(e)
      });
      aenc.configure(audio.cfg);
      const b = audio.buf, sr = b.sampleRate, ch = audio.cfg.numberOfChannels;
      const L = b.getChannelData(0);
      const R = ch > 1 ? (b.numberOfChannels > 1 ? b.getChannelData(1) : L) : null;
      const BLK = 1024;
      for (let off = 0; off < b.length; off += BLK){
        const n = Math.min(BLK, b.length - off);
        const data = new Float32Array(n * ch);
        for (let i = 0; i < n; i++){
          data[i] = L[off + i];
          if (ch > 1) data[n + i] = R[off + i];
        }
        aenc.encode(new AudioData({
          format:'f32-planar', sampleRate:sr, numberOfFrames:n,
          numberOfChannels:ch, timestamp: Math.round(off / sr * 1e6), data
        }));
        if ((off / BLK) % 40 === 0) await new Promise(r => setTimeout(r, 0));
      }
      await aenc.flush();
      aenc.close();
    }

    muxer.finalize();
    const blob = new Blob([target.buffer], { type:'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = $('#dl');
    a.href = url;
    a.download = 'chartcut_' + Date.now() + '.mp4';
    a.textContent = 'Unduh MP4 (' + (blob.size/1048576).toFixed(1) + ' MB)';
    a.classList.remove('hidden');

    if (Q.get('post')){
      try{ await fetch('/upload', { method:'POST', headers:{'X-Filename': Q.get('post')}, body: blob }); }catch(e){}
    }

    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    setProg(1);
    setStatus('Selesai. ' + (blob.size/1048576).toFixed(1) + ' MB, ' + W + 'x' + H + ', ' +
              fps + 'fps, ' + fmt(dur) + ' - diproses ' + secs + 's' + (audio ? ' (dengan audio)' : ' (tanpa audio)'));
  }catch(err){
    setStatus('Gagal: ' + (err && err.message ? err.message : err));
  }finally{
    S.busy = false; $('#render').disabled = false;
    video.muted = true;
    video.play().catch(()=>{});
  }
}

/* ---------- wiring ---------- */
function syncPreview(){
  S.hook = $('#hook').value;
  S.hookDur = parseFloat($('#hookDur').value) || 2.5;
  S.brand = $('#brand').value.trim();
  S.cta = $('#cta').value.trim();
  S.ctaDur = parseFloat($('#ctaDur').value) || 2;
  S.extra = Math.max(1, parseFloat($('#extra').value) || 1);
  S.speed = Math.min(4, Math.max(0.25, parseFloat($('#speed').value) || 1));
  S.posX = parseFloat($('#posX').value);
  S.posY = parseFloat($('#posY').value);
  S.pushin = $('#pushin').checked;
  S.pushinAmt = parseFloat($('#pushinAmt').value) || 0;
  S.fps = Math.min(60, Math.max(15, parseInt($('#fps').value) || 30));
  S.mbps = Math.min(20, Math.max(2, parseInt($('#mbps').value) || 8));
  S.mute = $('#mute').checked;
}

['hook','hookDur','brand','cta','ctaDur','extra','speed','posX','posY','pushinAmt','fps','mbps']
  .forEach(id => { const e = document.getElementById(id); e.addEventListener('input', syncPreview); });
$('#pushin').addEventListener('change', syncPreview);
$('#mute').addEventListener('change', syncPreview);

$('#file').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  S.file = f;
  loadVideo(URL.createObjectURL(f), f.name);
});

$('#srt').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  S.srtCues = parseSRT(await f.text());
  $('#srtinfo').textContent = S.srtCues.length + ' baris caption dimuat.';
});

$('#addLabel').addEventListener('click', () => {
  const d = video.duration || 60;
  S.labels.push({ text:'', start: Math.min(5, d*0.2), end: Math.min(12, d*0.5) });
  renderLabels();
});

$('#render').addEventListener('click', render);

$('#reset').addEventListener('click', () => {
  localStorage.removeItem('chartcut');
  location.reload();
});

/* persist */
const KEYS = ['hook','hookDur','brand','cta','ctaDur','extra','speed','fps','mbps'];
function save(){
  const o = { labels:S.labels, srt:false };
  KEYS.forEach(k => o[k] = $('#'+k).value);
  o.pushin = $('#pushin').checked; o.mute = $('#mute').checked;
  try{ localStorage.setItem('chartcut', JSON.stringify(o)); }catch(e){}
}
function restore(){
  try{
    const o = JSON.parse(localStorage.getItem('chartcut') || 'null');
    if (!o) return;
    KEYS.forEach(k => { if (o[k] !== undefined) $('#'+k).value = o[k]; });
    if (o.pushin !== undefined) $('#pushin').checked = o.pushin;
    if (o.mute !== undefined) $('#mute').checked = o.mute;
  }catch(e){}
}
document.addEventListener('input', save);

/* ---------- boot ---------- */
restore();
syncPreview();
renderLabels();
previewLoop();

if (Q.get('test')){
  const url = Q.get('test');
  loadVideo(url, 'test');
  if (Q.get('hook')) { S.hook = Q.get('hook'); $('#hook').value = S.hook; }
  if (Q.get('autorun')){
    (async () => {
      try{
        const b = await (await fetch(url)).blob();
        S.file = new File([b], 'test.mp4', { type: b.type || 'video/mp4' });
      }catch(e){}
      for (let i = 0; i < 60 && !S.ready; i++) await new Promise(r => setTimeout(r, 250));
      syncPreview(); render();
    })();
  }
}
})();
