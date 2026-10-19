import { useMemo } from 'react';
import type { Calc, Project } from '../core/types';
import { calcAll } from '../core/calc';
import { dfmt, fmt } from '../core/format';
import { SCOPE_NOTE, TEST_NOTE, TRIP_STEPS, passportInput, passportRows, watts } from '../core/passport';
import { ownerUrl, qrSvg } from '../core/share';

export function PassportBody({ p, a, qr }: { p: Project; a: Calc; qr?: string | null }) {
  const rows = passportRows(a);
  const inp = passportInput(a);
  const anyRcd = rows.some(r => r.rcd);
  return (
    <div className="pp">
      <h1>Паспорт электрощита</h1>
      <p className="pp-sub">{p.name || 'Без названия'}{p.address ? ', ' + p.address : ''}</p>
      <div className="pp-meta">
        {p.client && <div><span>Владелец: </span>{p.client}</div>}
        {p.author && <div><span>Исполнитель: </span>{p.author}</div>}
        <div><span>Дата: </span>{dfmt(Date.now())}</div>
      </div>
      <div className="pp-in">
        <b>{inp.text}</b>
        <span>Расчётная мощность квартиры {fmt(inp.pKw, 1)} кВт из выделенных {fmt(inp.allocKw, 1)} кВт</span>
      </div>
      <h2>Что на каком автомате</h2>
      <div className="pp-list">
        {rows.map(r => (
          <section className="pp-card" key={r.no}>
            <header>
              <span className="pp-no">{r.no}</span>
              <b>{r.name}</b>
              <span className="pp-prot">{r.prot}</span>
            </header>
            {r.where && <p className="pp-where">{r.where}</p>}
            <p>Предельная нагрузка группы около {watts(r.capW)}.</p>
            {r.heavy.length > 0 && <p>Самые мощные приборы: {r.heavy.map(h => h.name + ' ' + watts(h.watts)).join(', ')}.</p>}
            {r.together && <p className="pp-warn">Сумма мощностей приборов группы ({watts(r.totalW)}) больше предела. Не включайте одновременно: {r.together}.</p>}
          </section>
        ))}
      </div>
      <h2>Если автомат выключился</h2>
      <ol className="pp-steps">
        {TRIP_STEPS.map(s => <li key={s}>{s}</li>)}
      </ol>
      {anyRcd && <p className="pp-note">{TEST_NOTE}</p>}
      {qr && (
        <div className="pp-qr">
          <div role="img" aria-label="QR-код паспорта" dangerouslySetInnerHTML={{ __html: qr }} />
          <span>Наведите камеру телефона, чтобы открыть этот паспорт на экране.</span>
        </div>
      )}
      <p className="pp-note">{SCOPE_NOTE}</p>
    </div>
  );
}

export function PassportDoc({ p, a }: { p: Project; a: Calc }) {
  const qr = useMemo(() => qrSvg(ownerUrl(p, window.location.href)), [p]);
  return <PassportBody p={p} a={a} qr={qr} />;
}

export function OwnerView({ project, onAdd }: { project: Project; onAdd: () => void }) {
  const a = useMemo(() => calcAll(project.lines, project.cfg), [project]);
  return (
    <main className="owner">
      <PassportBody p={project} a={a} />
      <div className="owner-act">
        <button className="btn ghost" type="button" onClick={onAdd}>Открыть проект в Ampli</button>
      </div>
    </main>
  );
}
