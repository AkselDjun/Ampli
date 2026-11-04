import type { Calc, Project, Row } from '../core/types';
import { fmt, fs } from '../core/format';
import { IN_CABLE } from '../core/norms';
import { inCableName } from '../core/protection';

const W = 420;
const H = 297;
const FX = 20;
const FY = 5;
const FR = 415;
const FB = 292;
const SX = FR - 185;
const SY = FB - 55;
const TX0 = 25;
const TX1 = 72;
const TR = FR - 5;
const BUS = 54;
const TOP = 112;

export const drawCode = (t: number): string => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return 'ЭМ-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
};

export function wrap(text: string, max: number, lines = 2): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (next.length <= max || !cur) cur = next;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  if (out.length > lines) {
    const head = out.slice(0, lines);
    head[lines - 1] = head[lines - 1].slice(0, Math.max(1, max - 1)) + '…';
    return head;
  }
  return out;
}

function Breaker({ x, y, h, diff }: { x: number; y: number; h: number; diff: boolean }) {
  const a = y + h * 0.3;
  const b = y + h * 0.7;
  return (
    <g>
      <path d={'M' + x + ' ' + y + 'V' + a} />
      <path d={'M' + (x - 1.4) + ' ' + (a - 1.4) + 'l2.8 2.8M' + (x + 1.4) + ' ' + (a - 1.4) + 'l-2.8 2.8'} />
      <path d={'M' + x + ' ' + b + 'L' + (x - 3) + ' ' + (a + 0.6)} />
      <path d={'M' + x + ' ' + b + 'V' + (y + h)} />
      {diff && <ellipse cx={x} cy={b + (y + h - b) / 2} rx="2.6" ry="1.3" />}
    </g>
  );
}

export function DrawingA3({ p, a, company }: { p: Project; a: Calc; company: string }) {
  const c = a.c;
  const three = c.supply === 3;
  const rows = a.rows.map((x, i) => ({ x, i })).filter(o => !o.x.r.empty && o.x.r.In);
  const order: { x: Row; i: number }[] = [];
  const zoneOf: (number | null)[] = [];
  if (a.uzos.length) {
    a.uzos.forEach((u, k) => u.groups.forEach(i => { order.push({ x: a.rows[i], i }); zoneOf.push(k); }));
    rows.forEach(o => { if (o.x.r.uzo === null) { order.push(o); zoneOf.push(null); } });
  } else rows.forEach(o => { order.push(o); zoneOf.push(null); });
  const n = Math.max(1, order.length);
  const cw = Math.min(40, (TR - TX1) / n);
  const cx = (k: number) => TX1 + cw * k + cw / 2;
  const fsz = cw < 17 ? 2.2 : 2.6;
  const maxCh = Math.max(6, Math.floor(cw / (fsz * 0.52)));
  const labels: [string, number][] = [
    ['Обозначение аппарата', 8],
    ['Тип, номинальный ток, А', 8],
    ...(a.uzos.length || order.some(o => o.x.r.rcbo) ? [['Дифф. ток, мА', 8] as [string, number]] : []),
    ...(three ? [['Фаза', 8] as [string, number]] : []),
    ['Марка кабеля', 8],
    ['Число жил и сечение, мм²', 8],
    ['Длина, м', 8],
    ['Руст, кВт', 8],
    ['Iр, А', 8],
    ['ΔU, %', 8],
    ['Номер группы', 8],
    ['Наименование электроприёмника', 14]
  ];
  const ys: number[] = [];
  let y = TOP;
  labels.forEach(([, h]) => { ys.push(y); y += h; });
  const tableBottom = y;
  const label = (r: Row['r']) => (r.rcbo ? 'QFD' : 'QF');
  const cellVals = (o: { x: Row; i: number }, k: number): string[] => {
    const r = o.x.r;
    const vals: string[] = [label(r) + (k + 1), r.curve + r.In];
    if (labels.some(l => l[0] === 'Дифф. ток, мА')) vals.push(r.rcbo ? String(r.ma) : (zoneOf[k] !== null ? 'QD' + ((zoneOf[k] as number) + 1) + ' / ' + a.uzos[zoneOf[k] as number].ma : '—'));
    if (three) vals.push(r.three ? 'L1–L3' : o.x.l.phase);
    vals.push('ВВГнг(А)-LS', (r.three ? 5 : 3) + '×' + fs(r.S as number), r.cable > 0 ? fmt(r.cable, 0) : '—', fmt(r.pInst / 1000, 2), fmt(r.I, 1), fmt(r.drop, 1), 'Г' + (o.i + 1));
    return vals;
  };
  const inLabel = a.inIn ? (three ? '4P ' : '2P ') + 'C' + a.inIn : '—';
  const inCab = a.inS ? inCableName(c, a.inS) : IN_CABLE[c.inCable];
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0') + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + String(date.getFullYear()).slice(2);
  const t = { fill: '#000', stroke: 'none' } as const;
  const busY = BUS;
  const brY = a.uzos.length ? 74 : 60;
  const brH = 16;
  const objName = wrap(p.address || p.name || 'Квартира', 60, 2);
  return (
    <svg className="a3" viewBox={'0 0 ' + W + ' ' + H} width={W + 'mm'} height={H + 'mm'} role="img" aria-label="Принципиальная схема распределительной сети" fill="none" stroke="#000" strokeWidth="0.35" fontFamily="'Golos Text', Arial, sans-serif">
      <rect x={FX} y={FY} width={FR - FX} height={FB - FY} strokeWidth="0.7" />
      <text x={TX0} y="14" {...t} fontSize="3.2" fontWeight="700">Щиток квартирный ЩК</text>
      <text x={TX0} y="19" {...t} fontSize="2.4">{three ? '~3 × 400/230 В, 50 Гц' : '~230 В, 50 Гц'}</text>
      <text x={TX0} y="27" {...t} fontSize="2.4">От этажного щита ЩЭ</text>
      <path d={'M' + (TX0 + 6) + ' 29V33'} strokeWidth="0.5" />
      <Breaker x={TX0 + 6} y={33} h={14} diff={false} />
      <text x={TX0 + 10} y="39" {...t} fontSize="2.4" fontWeight="700">QF0</text>
      <text x={TX0 + 10} y="42.5" {...t} fontSize="2.4">{inLabel}</text>
      <text x={TX0 + 10} y="46" {...t} fontSize="2.2">{inCab}</text>
      <path d={'M' + (TX0 + 6) + ' 47V' + busY + 'H' + (TX1 + cw * n - cw / 2 + 2)} strokeWidth="0.9" />
      {a.uzos.map((u, k) => {
        const idx = zoneOf.map((z, j) => (z === k ? j : -1)).filter(j => j >= 0);
        if (!idx.length) return null;
        const x0 = cx(idx[0]);
        const x1 = cx(idx[idx.length - 1]);
        return (
          <g key={'u' + k}>
            <Breaker x={x0} y={busY} h={14} diff />
            <text x={x0 + 3.5} y={busY + 6} {...t} fontSize="2.4" fontWeight="700">QD{k + 1}</text>
            <text x={x0 + 3.5} y={busY + 9.5} {...t} fontSize="2.2">{u.In} А, {u.ma} мА</text>
            <path d={'M' + x0 + ' ' + (busY + 14) + 'V' + (brY - 2) + 'M' + (x0 - 1) + ' ' + (brY - 2) + 'H' + (x1 + 1)} strokeWidth="0.7" />
          </g>
        );
      })}
      {order.map((o, k) => {
        const r = o.x.r;
        const x = cx(k);
        const z = zoneOf[k];
        const top = z === null ? busY : brY - 2;
        return (
          <g key={o.x.l.id}>
            <path d={'M' + x + ' ' + top + 'V' + brY} />
            <Breaker x={x} y={brY} h={brH} diff={r.rcbo} />
            <text x={x + 2} y={brY + 4} {...t} fontSize={fsz} fontWeight="700">{label(r)}{k + 1}</text>
            <path d={'M' + x + ' ' + (brY + brH) + 'V' + TOP} />
            <text {...t} fontSize={fsz} transform={'translate(' + (x - 1) + ' ' + (TOP - 3) + ') rotate(-90)'}>{(r.three ? 5 : 3) + '×' + fs(r.S as number)}</text>
          </g>
        );
      })}
      {labels.map(([name, h], k) => (
        <g key={name}>
          <rect x={TX0} y={ys[k]} width={TX1 - TX0} height={h} />
          {wrap(name, 26, 2).map((ln, j, arr) => <text key={j} x={TX0 + 1.5} y={ys[k] + h / 2 + 0.9 + (j - (arr.length - 1) / 2) * 3} {...t} fontSize="2.3">{ln}</text>)}
        </g>
      ))}
      {order.map((o, k) => {
        const vals = cellVals(o, k);
        const x = TX1 + cw * k;
        const name = wrap(o.x.l.name || 'Без названия', maxCh, 3);
        return (
          <g key={'c' + o.x.l.id}>
            {labels.map(([lname, h], j) => (
              <g key={lname}>
                <rect x={x} y={ys[j]} width={cw} height={h} />
                {j < vals.length && <text x={x + cw / 2} y={ys[j] + h / 2 + 0.9} {...t} fontSize={fsz} textAnchor="middle">{vals[j]}</text>}
              </g>
            ))}
            {name.map((ln, j) => <text key={j} x={x + cw / 2} y={ys[labels.length - 1] + 4 + j * 3.2} {...t} fontSize={fsz - 0.2} textAnchor="middle">{ln}</text>)}
          </g>
        );
      })}
      <g>
        <text x={TX0} y={tableBottom + 8} {...t} fontSize="2.8" fontWeight="700">Итого по щитку</text>
        <text x={TX0} y={tableBottom + 13} {...t} fontSize="2.5">Руст = {fmt(a.sumInst / 1000, 2)} кВт; Ко = {fs(c.ko)}; Рр = {fmt(a.P / 1000, 2)} кВт; Iр = {fmt(a.Itot, 1)} А{three ? ' (наиболее загруженная фаза)' : ''}.</text>
        <text x={TX0} y={tableBottom + 17.5} {...t} fontSize="2.5">Выделенная мощность {fmt(c.alloc, 1)} кВт. Корпус щитка на {a.size} модулей.</text>
        <text x={TX0} y={tableBottom + 25} {...t} fontSize="2.8" fontWeight="700">Примечания</text>
        {[
          '1. Схема выполнена по ГОСТ 21.613-2014. Расчёт по ТКП 339-2022 с изм. № 1 и СН 4.04.01-2019.',
          '2. Групповые линии выполнить кабелем ВВГнг(А)-LS с медными жилами, прокладка ' + (c.method === 'wall' ? 'скрытая.' : 'открытая.'),
          '3. Шины N и PE в щитке раздельные' + (a.uzos.length ? ', у каждого УЗО своя шина N.' : '.') + ' Объединять N и PE после разделения не допускается.',
          '4. Длины кабелей указаны с учётом отводов от распределительных коробок, уточняются по месту.'
        ].map((ln, j) => <text key={j} x={TX0} y={tableBottom + 30 + j * 4.2} {...t} fontSize="2.4">{ln}</text>)}
      </g>
      <g strokeWidth="0.5">
        <rect x={SX} y={SY} width="185" height="55" strokeWidth="0.7" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(k => <path key={'h' + k} d={'M' + SX + ' ' + (SY + k * 5) + 'H' + (SX + 65)} strokeWidth={k === 3 ? 0.7 : 0.25} />)}
        {[10, 20, 30, 40, 55].map(dx => <path key={'v' + dx} d={'M' + (SX + dx) + ' ' + SY + 'V' + (SY + (dx === 10 || dx === 20 || dx === 30 ? 15 : 55))} strokeWidth="0.5" />)}
        <path d={'M' + (SX + 20) + ' ' + (SY + 15) + 'V' + (SY + 55)} strokeWidth="0.5" />
        <path d={'M' + (SX + 65) + ' ' + SY + 'V' + (SY + 55)} strokeWidth="0.7" />
        <path d={'M' + (SX + 65) + ' ' + (SY + 15) + 'H' + FR + 'M' + (SX + 65) + ' ' + (SY + 30) + 'H' + FR} strokeWidth="0.7" />
        <path d={'M' + (SX + 135) + ' ' + (SY + 30) + 'V' + (SY + 55)} strokeWidth="0.7" />
        <path d={'M' + (SX + 135) + ' ' + (SY + 35) + 'H' + FR + 'M' + (SX + 135) + ' ' + (SY + 40) + 'H' + FR} strokeWidth="0.5" />
        <path d={'M' + (SX + 150) + ' ' + (SY + 30) + 'V' + (SY + 40) + 'M' + (SX + 165) + ' ' + (SY + 30) + 'V' + (SY + 40)} strokeWidth="0.5" />
        {['Изм.', 'Кол.уч', 'Лист', '№ док.', 'Подп.', 'Дата'].map((h, k) => <text key={h} x={SX + [5, 15, 25, 35, 47.5, 60][k]} y={SY + 13.9} {...t} fontSize="2" textAnchor="middle">{h}</text>)}
        <text x={SX + 1} y={SY + 18.9} {...t} fontSize="2.2">Разраб.</text>
        <text x={SX + 21} y={SY + 18.9} {...t} fontSize="2.2">{(p.author || '').slice(0, 14)}</text>
        <text x={SX + 56} y={SY + 18.9} {...t} fontSize="2">{dd}</text>
        <text x={SX + 1} y={SY + 23.9} {...t} fontSize="2.2">Пров.</text>
        <text x={SX + 1} y={SY + 43.9} {...t} fontSize="2.2">Н.контр.</text>
        <text x={SX + 1} y={SY + 48.9} {...t} fontSize="2.2">Утв.</text>
        <text x={SX + 125} y={SY + 9.5} {...t} fontSize="4" textAnchor="middle">{drawCode(Date.now())}</text>
        {objName.map((ln, j) => <text key={j} x={SX + 125} y={SY + 22 + (j - (objName.length - 1) / 2) * 4} {...t} fontSize="3" textAnchor="middle">{ln}</text>)}
        <text x={SX + 100} y={SY + 40} {...t} fontSize="2.8" textAnchor="middle">Щиток квартирный ЩК.</text>
        <text x={SX + 100} y={SY + 44.5} {...t} fontSize="2.8" textAnchor="middle">Принципиальная схема</text>
        <text x={SX + 100} y={SY + 49} {...t} fontSize="2.8" textAnchor="middle">распределительной сети</text>
        {['Стадия', 'Лист', 'Листов'].map((h, k) => <text key={h} x={SX + [142.5, 157.5, 175][k]} y={SY + 33.8} {...t} fontSize="2.2" textAnchor="middle">{h}</text>)}
        {['Р', '1', '1'].map((h, k) => <text key={'v' + k} x={SX + [142.5, 157.5, 175][k]} y={SY + 38.8} {...t} fontSize="2.6" textAnchor="middle">{h}</text>)}
        {wrap(company || '', 26, 2).map((ln, j, arr) => <text key={j} x={SX + 160} y={SY + 48 + (j - (arr.length - 1) / 2) * 3.4} {...t} fontSize="2.8" textAnchor="middle">{ln}</text>)}
      </g>
      <text x={FR} y={H - 1.5} {...t} fontSize="2.5" textAnchor="end">Формат A3</text>
    </svg>
  );
}
