import type { Calc } from '../core/types';
import type { AsmWire, Core } from '../core/assembly';
import { assembly } from '../core/assembly';
import { fs, plural } from '../core/format';
import { DataTable } from './kit';
import { Empty } from './fields';

const SW: Record<Core, string> = { L: 'l1', L1: 'l1', L2: 'l2', L3: 'l3', N: 'n', PE: 'pe' };

function Cores({ w }: { w: AsmWire }) {
  return (
    <span className="asm-cores">
      {w.cores.map(x => (
        <span key={x.c} className="asm-core">
          <i className={'asm-sw sw-' + SW[x.c]} aria-hidden="true" />
          {x.c} {x.color}
        </span>
      ))}
    </span>
  );
}

const devWord = (n: number): string => n + ' ' + plural(n, ['аппарат', 'аппарата', 'аппаратов']);

export function AssemblyView({ a, print }: { a: Calc; print?: boolean }) {
  const asm = assembly(a);
  if (!asm.rails.length) return <Empty className="rep-empty">Добавьте группу с приборами, и здесь появится порядок сборки щитка: ряды, гребёнки, шины и подключение кабелей.</Empty>;
  const three = a.c.supply === 3;
  return (
    <div className={print ? 'asm asm-print' : 'asm'}>
      <h3 className="sec-t">Ряды щитка</h3>
      <p className="muted">Корпус на {a.size} мод.: {asm.rails.length} {plural(asm.rails.length, ['ряд', 'ряда', 'рядов'])} по {asm.rails[0].len} мод. Аппараты стоят слева направо, как на щитке.</p>
      <ol className="asm-rails">
        {asm.rails.map(r => (
          <li key={r.n} className="asm-rail">
            <div className="asm-rail-h"><b>Ряд {r.n}</b><span className="muted">занято {r.used} из {r.len} мод.</span></div>
            <ol className="asm-devs" aria-label={'Аппараты ряда ' + r.n}>
              {r.devs.map(d => (
                <li key={r.n + '-' + d.pos} className={'asm-dev k-' + d.kind} title={d.title}>
                  <b>{d.label}</b>
                  <span>{d.sub}</span>
                  <small>{d.pos}{d.mod > 1 ? '–' + (d.pos + d.mod - 1) : ''} мод.</small>
                </li>
              ))}
            </ol>
            {r.combs.map(c => (
              <p key={c.from + c.devs[0]} className="asm-comb">
                <b>Гребёнка {c.poles}</b> на {devWord(c.devs.length)} ({c.mods} мод.) от {c.from}: {c.devs.join(', ')}
              </p>
            ))}
          </li>
        ))}
      </ol>
      <h3 className="sec-t">Шины N и PE</h3>
      <DataTable label="Шины N и PE" className="asm-bus" head={<><th>Шина</th><th>Питание</th><th>Подключить</th><th className="num">Отверстий</th></>}>
        {asm.buses.map(b => (
          <tr key={b.name}>
            <td className="c-t">{b.name}</td>
            <td className="c-m" data-k="Питание">{b.feed}</td>
            <td className="c-v">{b.terms.join(', ')}</td>
            <td className="num c-m" data-k="Отверстий">{b.count > 1 ? b.count + ' × ' : ''}{b.holes}<span className="dt-u"> ({b.terms.length} занято)</span></td>
          </tr>
        ))}
      </DataTable>
      <h3 className="sec-t">Перемычки</h3>
      <DataTable label="Перемычки в щитке" className="asm-wire" head={<><th>Откуда</th><th>Куда</th><th>Жилы</th><th className="num">Сечение</th></>}>
        {asm.wires.map((w, i) => (
          <tr key={i}>
            <td className="c-t">{w.from}</td>
            <td className="c-m" data-k="Куда">{w.to}</td>
            <td className="c-v"><Cores w={w} /></td>
            <td className="num c-m" data-k="Сечение">{fs(w.s)}<span className="dt-u"> мм²</span></td>
          </tr>
        ))}
      </DataTable>
      <h3 className="sec-t">Подключение групп</h3>
      <DataTable label="Подключение кабелей групп" className="asm-lines" head={<><th>Гр.</th><th>Название</th>{three && <th>Фаза</th>}<th>Аппарат</th><th>Кабель и жилы</th><th>N</th><th>PE</th><th>Наконечник</th></>}>
        {asm.lines.map(l => (
          <tr key={l.g}>
            <td className="mono c-k">{l.g}</td>
            <td className="c-t">{l.name}</td>
            {three && <td className="mono c-m" data-k="Фаза">{l.phase}</td>}
            <td className="mono c-m" data-k="Аппарат">{l.dev}, от {l.from}</td>
            <td className="c-v">{l.cable}: {l.cores}</td>
            <td className="c-m" data-k="N">{l.n}</td>
            <td className="c-m" data-k="PE">{l.pe}</td>
            <td className="mono c-m" data-k="Наконечник">{l.ferrule}</td>
          </tr>
        ))}
      </DataTable>
      <h3 className="sec-t">Важно при сборке</h3>
      <ul className="asm-notes">
        {asm.notes.map(n => <li key={n}>{n}</li>)}
      </ul>
    </div>
  );
}
