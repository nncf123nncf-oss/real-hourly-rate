// 投稿カード用の実画面を撮る(Chrome headless / CDP)。実行: node source/shoot.js <出力フォルダ> [YYYY-MM-DD]
const fs = require('fs'), path = require('path');
const { launch } = require('./cdp');
const OUT = path.resolve(process.argv[2]); const DATE = process.argv[3] || '2026-10-15';
const PAGE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
fs.mkdirSync(OUT, { recursive: true });
// Card2の入力（すべて架空）: [案件名, 報酬, 経費, 作業, 修正, 打合せ]
const CARD2 = [['撮影同行', '12000', '14000', '4', '0', '1'], ['講座資料', '25000', '0', '5', '3', '2']];
(async () => {
  const b = await launch(9381);
  const rect = sel => b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY,left:r.left,right:r.right,h:r.height}})()`);
  // Card1: デスクトップ1000px・2カラム。サンプル4件＋基準2500円
  await b.open(PAGE, 1000, 1300, 2, false);
  await b.ev(`document.getElementById('sample').click()`); await b.sleep(400);
  const lay = await rect('.layout'), out = await rect('.sticky'), inp = await rect('.layout > .panel');
  console.log('card1', JSON.stringify({ lay, out, inp }));
  await b.shot(path.join(OUT, '01-desktop-sample-' + DATE + '.png'), { x: 0, y: Math.max(0, lay.top - 12), width: 1000, height: Math.max(out.bottom, inp.bottom) - lay.top + 20 });
  await b.shot(path.join(OUT, 'source-desktop-full.png'), { x: 0, y: 0, width: 1000, height: await b.ev('document.documentElement.scrollHeight') });
  // Card2: 375px・DPR2。別の入力（経費が報酬を上回る案件を含む・基準の時給は未入力）
  await b.open(PAGE, 375, 900, 2, true);
  await b.ev(`document.getElementById('clear').click()`); await b.sleep(100);
  await b.ev(`document.getElementById('add').click()`); await b.sleep(100);
  await b.ev(`(()=>{const D=${JSON.stringify(CARD2)};const cs=document.querySelectorAll('.case');
    D.forEach((row,i)=>{const ins=cs[i].querySelectorAll('input');row.forEach((v,j)=>{ins[j].value=v;ins[j].dispatchEvent(new Event('input',{bubbles:true}));});});return cs.length})()`);
  await b.sleep(400);
  const h2 = await rect('#out-h'), res = await rect('#results'), tot = await rect('#total');
  console.log('card2', JSON.stringify({ h2, res, tot, n: await b.ev(`document.querySelectorAll('.res').length`) }));
  await b.shot(path.join(OUT, '02-mobile375-over-expense-' + DATE + '.png'), { x: 0, y: h2.top - 8, width: 375, height: Math.max(res.bottom, tot.bottom || 0) - h2.top + 16 });
  await b.shot(path.join(OUT, 'source-mobile375-full.png'), { x: 0, y: 0, width: 375, height: await b.ev('document.documentElement.scrollHeight') });
  b.close(); setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error(e); process.exit(2); });
