const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const PORT = 3456;
const PUBLIC_DIR = path.join(__dirname, 'public');
const EXPORTS_DIR = path.join(__dirname, 'exports');
fs.mkdirSync(EXPORTS_DIR, { recursive: true });

const jobs = new Map();
const sseClients = new Set();

function broadcastSSE(event, payload) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch (e) {}
  }
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 80 * 1024 * 1024) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const GENERATE_SYSTEM_PROMPT = `Sen 30 yıllık deneyime sahip bir Kıdemli Motion Grafik Yönetmeni ve Yaratıcı Kodlayıcısın.
Kullanıcının istediği konseptte 1920x1080 (30fps) çalışan, tamamen parametrik bir HTML5 Canvas motion grafik projesi üreteceksin.

ÇOK ÖNEMLİ MİMARİ KURAL:
Ürettiğin video daha sonra kullanıcı tarafından "yazıyı yavaşlat", "rengi değiştir", "fontu büyüt" gibi komutlarla SIFIRDAN RENDER ALMADAN anlık düzenlenecek.
Bu yüzden tüm renkler, hızlar, boyutlar, metinler ve yaylanma (spring) değerleri "params" objesinden okunmalı!

Yanıtını SADECE aşağıdaki geçerli JSON formatında ver (açıklama yazma, sadece tek bir JSON bloğu ver):
{
  "title": "Proje Adı",
  "reply": "Kullanıcıya Türkçe kısa açıklama",
  "duration": 16,
  "params": {
    "bgColor": "#0B0B0C",
    "textColor": "#ECEAE4",
    "accentColor": "#FF4B1F",
    "displayFont": "Archivo",
    "monoFont": "JetBrains Mono",
    "globalSpeed": 1.0,
    "textSpeed": 1.0,
    "titleSize": 240,
    "subSize": 24,
    "tracking": -0.03,
    "springStiff": 12,
    "springDamp": 0.4,
    "grainAmount": 0.08,
    "strokeWidth": 2.5,
    "headline1": "ANA BAŞLIK",
    "headline2": "İKİNCİ SATIR",
    "headline3": "VURGU KELİMESİ",
    "subtitle": "Alt açıklama sloganı",
    "brandName": "MARKA",
    "tagLine": "İSTANBUL — 2026"
  },
  "scenes": [
    {
      "name": "01 GİRİŞ",
      "start": 0,
      "end": 4,
      "sfx": "impact",
      "code": "// Kullanılabilir: g (ctx), t (genel sn), lt (sahne içi 0..1 ilerleme), W (dinamik: 1920 veya 1080), H (dinamik: 1080 veya 1920), P (params)\n// Yardımcılar: E.outExpo(k), E.inOutExpo(k), E.outCubic(k), clamp(v,a,b), lerp(a,b,k), p(t,a,b,spd), spring(s), typed(str,k), font(size,w,fam), mono(size,w), fit(text,maxW,base), centerText(text,cx,cy,size,color), strokeCenterText(text,cx,cy,size,color,lineW), drawLogo(cx,cy,size), drawScreen(cx,cy,w,h,radius)\n// DİKKAT: 16:9 Yatay ve 9:16 Reels formatlarına tam uyum için asla 1680 vb. sabit piksel verme! Daima W*0.84, W/2, H/2 ve fit() kullan ki her ekrana tam sığsın.\n"
    },
    {
      "name": "02 TİPOGRAFİ",
      "start": 4,
      "end": 8,
      "sfx": "whoosh",
      "code": "..."
    },
    {
      "name": "03 VURGU & EKRAN",
      "start": 8,
      "end": 12,
      "sfx": "riser",
      "code": "..."
    },
    {
      "name": "04 FİNAL LOGO",
      "start": 12,
      "end": 16,
      "sfx": "shimmer",
      "code": "..."
    }
  ]
}`;

const PATCH_SYSTEM_PROMPT = `Sen bir Canlı Motion Grafik Yamayıcısısın (Live Patcher).
Kullanıcının ekranda çalışan bir motion grafik videosu var. Kullanıcı bir değişiklik istediğinde TÜM VİDEOYU SIFIRDAN YAZMA!
1. Eğer hız, renk, font, boyut, metin veya yaylanma değişecekse sadece "paramPatch" döndür.
2. Eğer belirli bir sahnenin çizimi/animasyonu değişecekse sadece o sahnenin indexini ve yeni kodunu "scenePatches" dizisinde döndür.

Yanıtını SADECE geçerli bir JSON olarak ver:
{
  "reply": "Samimi Türkçe yanıt",
  "paramPatch": { ...sadece değişen parametreler... },
  "scenePatches": [
    // { "index": 0, "code": "..." }
  ]
}`;

async function callLLM({ provider, apiKey, systemPrompt, userMessage }) {
  if (provider === 'anthropic' && apiKey) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });
    if (!resp.ok) throw new Error(`Claude API (${resp.status})`);
    const data = await resp.json();
    const txt = data.content?.[0]?.text || '{}';
    const match = txt.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : txt);
  }

  if (provider === 'gemini' && apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    if (!resp.ok) throw new Error(`Gemini API (${resp.status})`);
    const data = await resp.json();
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const match = txt.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : txt);
  }

  throw new Error('NO_API_KEY');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Live SSE stream for MCP / external agents to push live updates into the browser
  if (req.method === 'GET' && url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('event: connected\ndata: {"ok":true}\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // Endpoint for MCP server (atlas-mcp.js) to push a newly generated video or patch live to browser
  if (req.method === 'POST' && url.pathname === '/api/mcp-push') {
    try {
      const body = await readBody(req);
      broadcastSSE('mcp_update', body);
      return sendJSON(res, 200, { ok: true, clients: sseClients.size });
    } catch (e) {
      return sendJSON(res, 500, { ok: false, error: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/ai-generate') {
    try {
      const { provider, apiKey, prompt } = await readBody(req);
      const result = await callLLM({
        provider,
        apiKey,
        systemPrompt: GENERATE_SYSTEM_PROMPT,
        userMessage: `Kullanıcının istediği yeni motion grafik konsepti:\n"${prompt}"`
      });
      return sendJSON(res, 200, { ok: true, project: result });
    } catch (e) {
      return sendJSON(res, 200, { ok: false, error: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/ai-patch') {
    try {
      const { provider, apiKey, prompt, currentParams, scenes } = await readBody(req);
      const userMessage = `Mevcut Parametreler:\n${JSON.stringify(currentParams, null, 2)}\n\nMevcut Sahneler:\n${JSON.stringify(scenes, null, 2)}\n\nKullanıcının Değişiklik İsteği: "${prompt}"`;
      const result = await callLLM({
        provider,
        apiKey,
        systemPrompt: PATCH_SYSTEM_PROMPT,
        userMessage
      });
      return sendJSON(res, 200, { ok: true, ...result });
    } catch (e) {
      return sendJSON(res, 200, { ok: false, error: e.message });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/claude-pro-prompt') {
    return sendJSON(res, 200, { ok: true, generatePrompt: GENERATE_SYSTEM_PROMPT, patchPrompt: PATCH_SYSTEM_PROMPT });
  }

  if (req.method === 'POST' && url.pathname === '/api/render/start') {
    try {
      const { fps = 30, id } = await readBody(req);
      const jobId = id || ('reel_' + Date.now());
      const outPath = path.join(EXPORTS_DIR, `${jobId}.mp4`);
      const ff = spawn(ffmpegPath, [
        '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '16',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outPath
      ], { stdio: ['pipe', 'ignore', 'pipe'] });

      let stderr = '';
      ff.stderr.on('data', d => { stderr = (stderr + d).slice(-1500); });
      const donePromise = new Promise((resolve, reject) => {
        ff.on('close', code => code === 0 ? resolve(outPath) : reject(new Error(stderr || 'ffmpeg failed')));
      });
      jobs.set(jobId, { ff, outPath, donePromise });
      return sendJSON(res, 200, { ok: true, jobId });
    } catch (e) {
      return sendJSON(res, 500, { ok: false, error: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/render/chunk') {
    try {
      const { jobId, frames } = await readBody(req);
      const job = jobs.get(jobId);
      if (!job) return sendJSON(res, 404, { ok: false, error: 'Job bulunamadı' });
      for (const dataUrl of frames) {
        const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
        if (!job.ff.stdin.write(buf)) {
          await new Promise(r => job.ff.stdin.once('drain', r));
        }
      }
      return sendJSON(res, 200, { ok: true });
    } catch (e) {
      return sendJSON(res, 500, { ok: false, error: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/render/finish') {
    try {
      const { jobId, audioWavBase64 } = await readBody(req);
      const job = jobs.get(jobId);
      if (!job) return sendJSON(res, 404, { ok: false, error: 'Job bulunamadı' });
      job.ff.stdin.end();
      await job.donePromise;
      jobs.delete(jobId);

      // If audioWavBase64 is provided, mux the WAV audio track into the MP4
      if (audioWavBase64 && typeof audioWavBase64 === 'string') {
        const wavPath = path.join(EXPORTS_DIR, `${jobId}.wav`);
        const finalPath = path.join(EXPORTS_DIR, `${jobId}_sfx.mp4`);
        const b64 = audioWavBase64.includes(',') ? audioWavBase64.split(',')[1] : audioWavBase64;
        fs.writeFileSync(wavPath, Buffer.from(b64, 'base64'));
        await new Promise((resolve, reject) => {
          const mux = spawn(ffmpegPath, [
            '-y', '-i', job.outPath, '-i', wavPath,
            '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
            '-movflags', '+faststart', finalPath
          ]);
          mux.on('close', code => code === 0 ? resolve() : reject(new Error('Audio mux failed')));
        });
        try { fs.unlinkSync(wavPath); fs.unlinkSync(job.outPath); } catch (e) {}
        return sendJSON(res, 200, { ok: true, url: `/exports/${jobId}_sfx.mp4` });
      }

      return sendJSON(res, 200, { ok: true, url: `/exports/${jobId}.mp4` });
    } catch (e) {
      return sendJSON(res, 500, { ok: false, error: e.message });
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/exports/')) {
    const file = path.join(EXPORTS_DIR, path.basename(url.pathname));
    if (fs.existsSync(file)) {
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${path.basename(file)}"`
      });
      return fs.createReadStream(file).pipe(res);
    }
  }

  let filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const ext = path.extname(filePath);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`ATLAS Motion Studio v2.2 (Claude Pro 1-Click + MCP Live SSE) -> http://localhost:${PORT}`);
});
