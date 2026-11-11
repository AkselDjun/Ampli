const UNITS: Record<string, number> = {
  ноль: 0, один: 1, одна: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9,
  десять: 10, одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19,
  двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90,
  сто: 100, двести: 200, триста: 300, четыреста: 400, пятьсот: 500, шестьсот: 600, семьсот: 700, восемьсот: 800, девятьсот: 900,
  полтора: 1.5, полторы: 1.5
};

const THOUSAND = /^тысяч[аи]?$/;
const UNIT_WORDS: [RegExp, string][] = [
  [/^киловатт(а|ов)?$/, 'кВт'],
  [/^ватт(а|ов)?$/, 'Вт'],
  [/^штук[аи]?$/, 'шт'],
  [/^метр(а|ов)?$/, 'м']
];

export const SPOKEN_ROOMS = ['кухня', 'гостиная', 'зал', 'спальня', 'детская', 'ванная', 'санузел', 'туалет', 'коридор', 'прихожая', 'балкон', 'лоджия', 'кабинет', 'гараж', 'котельная', 'улица', 'баня'];

const fmtNum = (v: number): string => String(Math.round(v * 100) / 100).replace('.', ',');

function numbers(words: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i].toLowerCase();
    if (!(w in UNITS) && !THOUSAND.test(w)) {
      out.push(words[i]);
      i++;
      continue;
    }
    let total = 0;
    let cur = 0;
    let any = false;
    while (i < words.length) {
      const t = words[i].toLowerCase();
      if (t in UNITS) {
        cur += UNITS[t];
        any = true;
        i++;
      } else if (THOUSAND.test(t)) {
        total += (cur || 1) * 1000;
        cur = 0;
        any = true;
        i++;
      } else if (t === 'с' && words[i + 1]?.toLowerCase() === 'половиной' && any) {
        cur += 0.5;
        i += 2;
      } else if (t === 'запятая' && any && words[i + 1] && words[i + 1].toLowerCase() in UNITS) {
        let frac = 0;
        i++;
        while (i < words.length && words[i].toLowerCase() in UNITS && UNITS[words[i].toLowerCase()] < 1000) {
          frac += UNITS[words[i].toLowerCase()];
          i++;
        }
        cur += frac / 10 ** String(Math.round(frac)).length;
        break;
      } else break;
    }
    out.push(fmtNum(total + cur));
  }
  return out;
}

export function spokenToText(text: string, rooms = false): string {
  const words = numbers(text.trim().split(/\s+/).filter(Boolean));
  const out: string[] = [];
  words.forEach((w, i) => {
    const low = w.toLowerCase();
    const unit = UNIT_WORDS.find(([rx]) => rx.test(low));
    if (rooms && SPOKEN_ROOMS.includes(low.replace(/[:,.]$/, '')) && !/:$/.test(w)) {
      if (out.length) out[out.length - 1] = out[out.length - 1].replace(/,$/, '') + ';';
      out.push(w.replace(/[,.]$/, '') + ':');
      return;
    }
    if (unit) {
      out.push(unit[1] + (i < words.length - 1 ? ',' : ''));
      return;
    }
    out.push(w);
  });
  return out.join(' ').replace(/\s+,/g, ',').replace(/,\s*;/g, ';').trim();
}
