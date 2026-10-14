// 計算部分(script#core)だけを取り出して検算する。node source/run-checks.js
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script id="core">([\s\S]*?)<\/script>/);
const RH = new Function(m[1] + '; return RH;')();
let pass = 0, fail = 0;
function eq(name, got, exp) {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (ok) pass++; else { fail++; console.log('NG', name, 'got', JSON.stringify(got), 'exp', JSON.stringify(exp)); }
}
const C = (o) => RH.compute(Object.assign({ name: '', revenue: '', work: '', fix: '', meet: '', expense: '' }, o));
const yen = (x) => RH.fmtYen(x);

// S1 空
let r = C({}); eq('S1 blank', r.blank, true); eq('S1 no hourly', [r.hourlyWork, r.hourlyReal], [null, null]);
r = C({ name: 'だけ' }); eq('S1 name only blank', r.blank, true);

// S2 サンプル（仕様カード第6節の数値）
const S = [
  { name: 'ロゴ制作', revenue: '50000', work: '8', fix: '5', meet: '2', expense: '0' },
  { name: '記事執筆', revenue: '30000', work: '6', fix: '1', meet: '0.5', expense: '' },
  { name: 'バナー制作', revenue: '20000', work: '3', fix: '4', meet: '3', expense: '2000' },
  { name: '動画編集', revenue: '80000', work: '20', fix: '10', meet: '4', expense: '5000' },
].map(C);
eq('S2 hourlyWork', S.map(x => RH.roundYen(x.hourlyWork)), [6250, 5000, 6667, 4000]);
eq('S2 hourlyReal', S.map(x => RH.roundYen(x.hourlyReal)), [3333, 4000, 1800, 2206]);
eq('S2 total hours', S.map(x => x.total), [15, 7.5, 10, 34]);
const items = S.map((res, index) => ({ index, res }));
eq('S2 order low', RH.order(items, 'low').map(x => x.index), [2, 3, 0, 1]);
eq('S2 order input', RH.order(items, 'input').map(x => x.index), [0, 1, 2, 3]);
const ref = RH.parseRef('2500');
eq('S2 low marks', S.map(x => !!RH.isLow(x, ref)), [false, false, true, true]);
const t = RH.totals(S);
eq('S2 total', [t.rev, t.exp, t.hours, RH.roundYen(t.hourly)], [180000, 7000, 66.5, 2602]);
eq('S2 fixMeet%', S.map(x => x.fixMeetPct), [47, 20, 70, 41]);
eq('S2 drop', [RH.roundYen(S[2].drop), S[2].dropPct], [4867, 73]);

// S3 入力形式
const P = (v, k) => RH.parse(v, k || 'money');
eq('S3 fullwidth', P('５０，０００').value, 50000);
eq('S3 円', P('50000円').value, 50000);
eq('S3 comma', P('50,000').value, 50000);
eq('S3 hours 1.5', P('1.5', 'hours').value, 1.5);
eq('S3 hours 1:30', P('1:30', 'hours').value, 1.5);
eq('S3 hours 全角コロン', P('１：３０', 'hours').value, 1.5);
eq('S3 hours 1:75', !!P('1:75', 'hours').error, true);
eq('S3 hours 1時間30分', !!P('1時間30分', 'hours').error, true);
eq('S3 hours 2h', P('2h', 'hours').value, 2);
eq('S3 hours 2時間', P('2時間', 'hours').value, 2);
eq('S3 neg', !!P('-1').error, true);
eq('S3 neg unicode minus', !!P('−1').error, true);
eq('S3 abc', !!P('abc').error, true);
eq('S3 space only', P('  　 ').empty, true);
eq('S3 inner space', P('１ ５').value, 15);
eq('S3 money colon', !!P('1:30').error, true);
eq('S3 円only', !!P('円').error, true);

// S4 境界
r = C({ revenue: '10000', work: '0' }); eq('S4 work0', [r.hourlyWork, r.hourlyReal], [null, null]);
r = C({ revenue: '10000', fix: '2' }); eq('S4 work empty fix2', [r.hourlyWork, r.hourlyReal], [null, 5000]);
r = C({ revenue: '0', work: '2' }); eq('S4 rev0', [r.hourlyWork, r.hourlyReal, r.dropPct], [0, 0, null]);
r = C({ revenue: '5000', work: '1', expense: '5000' }); eq('S4 exp=rev', [r.hourlyReal, r.overExpense], [0, false]);
r = C({ revenue: '12000', work: '4', meet: '1', expense: '14000' }); eq('S4 over', [RH.roundYen(r.hourlyReal), r.overExpense, yen(r.hourlyReal)], [-400, true, '−400円']);
r = C({ revenue: '100000000', work: '1' }); eq('S4 big rev', !!r.errors.revenue, true);
r = C({ revenue: '1000', work: '10000' }); eq('S4 big hours', !!r.errors.work, true);
r = C({ revenue: '99999999', work: '9999' }); eq('S4 max ok', r.hasError, false);
r = C({ work: '2' }); eq('S4 need revenue', r.needRevenue, true);
r = C({ revenue: '1000', work: 'x' }); eq('S4 err', [r.hasError, r.hourlyReal], [true, null]);
for (const o of [{}, { revenue: '1' }, { work: '1' }, { revenue: '0', work: '0' }, { revenue: '1', work: '0', fix: '0' }]) {
  const x = C(o);
  eq('S4 finite ' + JSON.stringify(o), [x.hourlyWork, x.hourlyReal, x.drop].some(v => v != null && !isFinite(v)), false);
}

// S5 丸め
eq('S5 2205.88', RH.roundYen(75000 / 34), 2206);
eq('S5 .5', RH.roundYen(2.5), 3);
eq('S5 -.5', RH.roundYen(-0.5), -1);
eq('S5 -0.4', yen(-0.4), '0円');
eq('S5 neg fmt', yen(-1200), '−1,200円');

// S6 並べ替え
const mix = [C({ revenue: '10000', work: '2' }), C({ work: '2' }), C({ revenue: '10000', work: '5' }), C({ revenue: '5000', work: '1' })].map((res, index) => ({ index, res }));
eq('S6 incomplete last', RH.order(mix, 'low').map(x => x.index), [2, 0, 3, 1]);
const same = [C({ revenue: '1000', work: '1' }), C({ revenue: '1000', work: '1' })].map((res, index) => ({ index, res }));
eq('S6 ties keep input order', RH.order(same, 'low').map(x => x.index), [0, 1]);

// S7 基準
eq('S7 none', RH.parseRef('').none, true);
eq('S7 zero', RH.parseRef('0').zero, true);
eq('S7 fullwidth', RH.parseRef('２５００').value, 2500);
eq('S7 error', !!RH.parseRef('abc').error, true);
eq('S7 equal not low', RH.isLow(C({ revenue: '25000', work: '10' }), RH.parseRef('2500')), false);
eq('S7 below', RH.isLow(C({ revenue: '24990', work: '10' }), RH.parseRef('2500')), true);
eq('S7 none no mark', !!RH.isLow(S[2], RH.parseRef('')), false);

// S9 割合・差なし
r = C({ revenue: '10000', work: '5' }); eq('S9 noGap', r.noGap, true);
r = C({ revenue: '10000', work: '1', fix: '19' }); eq('S9 95%', r.fixMeetPct, 95);
r = C({ revenue: '10000', fix: '1' }); eq('S9 fix only', [r.hourlyReal, r.fixMeetPct], [10000, 100]);

// 合計
eq('totals single', RH.totals([S[0]]), null);
eq('totals skips incomplete', RH.totals([S[0], C({ work: '1' }), S[1]]).count, 2);

console.log(fail ? `FAIL ${fail} / PASS ${pass}` : `ALL PASS ${pass}`);
process.exit(fail ? 1 : 0);
