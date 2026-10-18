import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { calcAll } from '../core/calc';
import { fmt } from '../core/format';
import type { LineType } from '../core/types';
import { blank } from '../core/templates';
import { cur, init } from '../store/reducer';
import { hreducer, initH } from '../store/history';
import { loadStore, saveStore } from '../store/storage';
import { Brand, IconBack, IconBolt, IconCheck, IconDoc, IconList, IconNet, IconPanel } from './Icons';
import { GroupList } from './GroupList';
import { Editor } from './Editor';
import { PanelPane, Summary } from './Side';
import { NetSheet, ProjectsSheet, ReportSheet } from './sheets';
import { PrintDoc } from './PrintDoc';
import { WorkSheet } from './WorkSheet';
import type { PrintMode } from './WorkSheet';

type View = 'groups' | 'edit' | 'sum' | 'panel';
type SheetId = 'net' | 'proj' | 'rep' | 'work' | null;

const isWide = () => window.matchMedia('(min-width:1000px)').matches;

export function App() {
  const [hist, dispatch] = useReducer(hreducer, undefined, () => initH(init(loadStore())));
  const state = hist.now;
  const [view, setView] = useState<View>('groups');
  const [sheet, setSheet] = useState<SheetId>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>('report');
  const scrollPos = useRef(0);
  const p = cur(state);
  const a = useMemo(() => calcAll(p.lines, p.cfg), [p.lines, p.cfg]);
  const selected = p.lines.find(l => l.id === state.sel) || null;
  const idx = selected ? p.lines.indexOf(selected) : -1;

  useEffect(() => {
    saveStore({ cur: state.cur, list: state.list });
  }, [state.cur, state.list]);

  useEffect(() => {
    setView('groups');
    window.scrollTo(0, 0);
  }, [state.cur]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      dispatch({ t: e.shiftKey ? 'redo' : 'undo' });
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);

  const closeSheet = useCallback(() => setSheet(null), []);

  const goEdit = () => {
    if (isWide()) return;
    scrollPos.current = window.scrollY;
    setView('edit');
    window.scrollTo(0, 0);
  };
  const goBack = () => {
    setView('groups');
    window.setTimeout(() => window.scrollTo(0, scrollPos.current), 0);
  };
  const tab = (v: View) => {
    setView(v);
    window.scrollTo(0, 0);
  };
  const doPrint = (mode: PrintMode = 'report') => {
    setPrintMode(mode);
    const prev = document.title;
    document.title = 'Ampli — ' + (p.name || 'расчёт');
    window.setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        void e;
      }
      document.title = prev;
    }, 50);
  };

  return (
    <>
      <div id="app" data-view={view}>
        <header className="appbar">
          <div className="in">
            <div className="ab-edit">
              <button className="ab-back" type="button" onClick={goBack} aria-label="Назад к группам"><IconBack /></button>
              <span className="ab-title">{selected ? 'Г' + (idx + 1) + ' ' + (selected.name || 'Без названия') : ''}</span>
              <button className="btn primary sm" type="button" onClick={goBack}>Готово</button>
            </div>
            <div className="ab-main">
              <div className="brand"><Brand /><span>Ampli</span></div>
              <div className="kpis" aria-live="polite">
                <div><span className="lbl">Мощность</span><b>{a.P > 0 ? fmt(a.P / 1000, 1) + ' кВт' : '—'}</b></div>
                <div><span className="lbl">Ток</span><b>{a.Itot > 0 ? fmt(a.Itot, 0) + ' А' : '—'}</b></div>
                <div><span className="lbl">Ввод</span><b>{a.inIn ? 'C' + a.inIn : '—'}</b></div>
              </div>
              <button className="ab-btn" type="button" onClick={() => setSheet('net')} aria-label="Параметры сети">
                <IconNet />
                <span className="ab-txt">Параметры</span>
              </button>
              <button className="ab-btn desk" type="button" onClick={() => setSheet('work')}>
                <IconCheck />
                <span className="ab-txt">Приёмка</span>
              </button>
              <button className="ab-btn desk" type="button" onClick={() => setSheet('rep')}>
                <IconDoc />
                <span className="ab-txt">Отчёт</span>
              </button>
            </div>
          </div>
        </header>

        <div className="workspace">
          <GroupList
            p={p}
            a={a}
            sel={state.sel}
            onSelect={id => { dispatch({ t: 'select', id }); goEdit(); }}
            onAdd={(t: LineType) => { dispatch({ t: 'addLine', type: t }); goEdit(); }}
            onOpenProj={() => setSheet('proj')}
            onOpenNet={() => setSheet('net')}
            onBlank={() => dispatch({ t: 'replace', content: blank() })}
            canUndo={hist.past.length > 0}
            canRedo={hist.future.length > 0}
            onUndo={() => dispatch({ t: 'undo' })}
            onRedo={() => dispatch({ t: 'redo' })}
          />
          <div className="main-col">
            <Editor
              l={selected}
              idx={idx}
              a={a}
              dispatch={dispatch}
              whyOpen={whyOpen}
              setWhyOpen={setWhyOpen}
              onDeleted={() => { if (!isWide()) goBack(); }}
            />
            <aside className="col col-res" aria-label="Итоги расчёта">
              <Summary a={a} onBalance={() => dispatch({ t: 'balance' })} />
              <PanelPane a={a} />
            </aside>
          </div>
        </div>

        <nav className="tabs" aria-label="Разделы">
          <button type="button" onClick={() => tab('groups')} aria-current={view === 'groups' || view === 'edit' ? 'page' : undefined}>
            <IconList />
            <span>Группы</span>
            {a.issues > 0 && <em className="badge">{a.issues}</em>}
          </button>
          <button type="button" onClick={() => tab('sum')} aria-current={view === 'sum' ? 'page' : undefined}>
            <IconBolt />
            <span>Итоги</span>
          </button>
          <button type="button" onClick={() => tab('panel')} aria-current={view === 'panel' ? 'page' : undefined}>
            <IconPanel />
            <span>Щиток</span>
          </button>
          <button type="button" onClick={() => setSheet('work')}>
            <IconCheck />
            <span>Приёмка</span>
          </button>
          <button type="button" onClick={() => setSheet('rep')}>
            <IconDoc />
            <span>Отчёт</span>
          </button>
        </nav>

        <NetSheet open={sheet === 'net'} onClose={closeSheet} p={p} dispatch={dispatch} />
        <ProjectsSheet open={sheet === 'proj'} onClose={closeSheet} state={state} p={p} dispatch={dispatch} />
        <ReportSheet open={sheet === 'rep'} onClose={closeSheet} p={p} a={a} onPrint={() => doPrint('report')} />
        <WorkSheet open={sheet === 'work'} onClose={closeSheet} p={p} a={a} dispatch={dispatch} onPrint={doPrint} />
      </div>
      <PrintDoc p={p} a={a} mode={printMode} />
    </>
  );
}
