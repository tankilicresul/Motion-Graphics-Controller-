#!/usr/bin/env node
// ATLAS Motion Studio — Official Local MCP Server (stdio JSON-RPC 2.0)
// Connects Claude Desktop (Claude Pro), Cursor, or Antigravity directly to http://localhost:3456
const readline = require('readline');

const STUDIO_URL = 'http://localhost:3456/api/mcp-push';

const TOOLS = [
  {
    name: 'create_motion_video',
    description: 'ATLAS Motion Studio ekranında sıfırdan parametrik bir motion grafik videosu oluşturur ve canlı oynatır.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Proje başlığı' },
        duration: { type: 'number', description: 'Saniye cinsinden süre (örn 16)' },
        params: {
          type: 'object',
          description: 'Parametreler: bgColor, textColor, accentColor, displayFont, globalSpeed, textSpeed, titleSize, subSize, tracking, springStiff, springDamp, headline1, headline2, headline3, subtitle, brandName, tagLine'
        },
        scenes: {
          type: 'array',
          description: 'Sahne dizisi: [{ name, start, end, code }]',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              start: { type: 'number' },
              end: { type: 'number' },
              code: { type: 'string', description: 'HTML5 Canvas çizim kodu (g, t, lt, W, H, P, HLP kullanır)' }
            },
            required: ['name', 'start', 'end', 'code']
          }
        }
      },
      required: ['title', 'params', 'scenes']
    }
  },
  {
    name: 'patch_motion_video',
    description: 'Mevcut videoyu sıfırdan üretmeden sadece belirtilen parametreleri (hız, renk, font, boyut, metin) veya tek bir sahneyi anında günceller.',
    inputSchema: {
      type: 'object',
      properties: {
        reply: { type: 'string', description: 'Yapılan değişikliğin açıklaması' },
        paramPatch: { type: 'object', description: 'Değişen parametre anahtarları (örn { textSpeed: 0.6, accentColor: "#0066FF" })' },
        scenePatches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index: { type: 'number' },
              code: { type: 'string' }
            }
          }
        }
      }
    }
  }
];

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', async line => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch (e) { return; }

  if (req.method === 'initialize') {
    return send({
      jsonrpc: '2.0',
      id: req.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'atlas-motion-mcp', version: '2.2.0' }
      }
    });
  }

  if (req.method === 'tools/list') {
    return send({ jsonrpc: '2.0', id: req.id, result: { tools: TOOLS } });
  }

  if (req.method === 'tools/call') {
    const { name, arguments: args } = req.params || {};
    try {
      const resp = await fetch(STUDIO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: name, args })
      }).then(r => r.json());

      return send({
        jsonrpc: '2.0',
        id: req.id,
        result: {
          content: [{ type: 'text', text: `ATLAS Studio canlı güncellendi (${resp.clients || 1} ekran bağlı).` }]
        }
      });
    } catch (err) {
      return send({
        jsonrpc: '2.0',
        id: req.id,
        result: {
          content: [{ type: 'text', text: `Hata: ${err.message}` }],
          isError: true
        }
      });
    }
  }
});
