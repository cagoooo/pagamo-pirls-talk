// 用 OpenAI gpt-image-2 生成簡報底圖與圖標總表（金鑰只從環境變數讀取）
import fs from 'node:fs';
import path from 'node:path';
const OUT = path.resolve(process.argv[2] || 'images');
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('缺少 OPENAI_API_KEY'); process.exit(1); }

const LIGHT = 'soft light editorial illustration, warm cream and white background, airy, generous empty space in the center for overlaid titles, accents of coral orange (#e8643a) and sky cyan (#4fc3f7), gentle gradients, subtle paper texture, absolutely no text, no letters, no numbers, no logos';
const JOBS = [
  ['bg_cover', `An open storybook article page on the left whose paragraphs lift off as glowing ribbons and fold into a neat stack of colorful quiz cards, which fly toward a small cheerful game world map with tiny territories and castles on the right. ${LIGHT}`],
  ['bg_solution', `A friendly laptop browser window with a small glowing puzzle-piece extension icon; a beam from the icon turns a block of paragraph lines into four colorful layered question cards stacked like stairs. ${LIGHT}`],
  ['bg_closing', `A warm evening online meeting: a soft grid of glowing video call tiles with simple faceless teacher silhouettes waving, connected by gentle light threads, a desk lamp glow and a mug of tea in the foreground. ${LIGHT}`],
  ['icon_sheet', 'A clean icon sheet: exactly 8 flat neon line icons arranged in a precise grid of 2 rows and 4 columns on a pure solid dark navy (#0d1117) background, each icon centered in its own equal cell with wide spacing, cyan and orange neon glow style, bold strokes, no text. Row 1 left to right: (1) a keyboard with a tired sweat drop, (2) a four-step staircase pyramid, (3) a spreadsheet grid with an upload arrow, (4) a rocket launching. Row 2 left to right: (5) a magnifying glass over lines of text, (6) a light bulb connected to a chain link, (7) two puzzle pieces joining together, (8) a balance scale weighing two items.'],
];

async function gen([name, prompt]) {
  const file = path.join(OUT, name + '.png');
  if (fs.existsSync(file)) { console.log('略過（已存在）', name); return; }
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: 'gpt-image-2', prompt, size: '1536x1024', quality: 'low', n: 1, output_format: 'png', background: 'opaque' }),
    });
    const j = await r.json();
    if (r.ok && j.data?.[0]?.b64_json) {
      fs.writeFileSync(file, Buffer.from(j.data[0].b64_json, 'base64'));
      console.log('完成', name); return;
    }
    console.log('失敗', name, r.status, j.error?.message?.slice(0, 160));
    await new Promise(res => setTimeout(res, 20000 * attempt));
  }
}
const queue = [...JOBS];
await Promise.all([0, 1].map(async () => { while (queue.length) await gen(queue.shift()); }));
console.log('全部結束');
