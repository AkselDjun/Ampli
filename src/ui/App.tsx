import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { calcAll } from '../core/calc';
import { fmt } from '../core/format';
import type { LineType } from '../core/types';
import { blank } from '../core/templates';
import { cur, init } from '../store/reducer';
import { TYPES } from '../core/norms';
import { Toast } from './common';
import { hreducer, initH } from '../store/history';
import { loadStore, saveStore } from '../store/storage';
import { libReducer, loadLib, saveLib } from '../store/lib';
import { LibContext } from '../store/LibContext';
import { LibSheet } from './LibSheet';
import { gcPhotos } from '../store/photos';
import { referencedPhotoIds } from '../core/photos';
import { CompareSheet } from './CompareSheet';
import { RoomsSheet } from './RoomsSheet';
import { Brand, IconBack, IconBolt, IconCheck, IconDoc, IconList, IconNet, IconPanel } from './Icons';
import { GroupList } from './GroupList';
import { Editor } from './Editor';
import { PanelPane, Summary } from './Side';
import { NetSheet, ProjectsSheet, ReportSheet } from './sheets';
import { PrintDoc } from './PrintDoc';
import { WorkSheet } from './WorkSheet';
import { PanelMode } from './PanelMode';
import { IncomingSheet } from './IncomingSheet';
import { ShopSheet } from './ShopSheet';
import { readOwnerHash, readShareHash, unpackProject } from '../core/share';
import { OwnerView } from './Passport';
import { uniqName } from '../core/project';
import type { Project } from '../core/types';
import type { PrintMode } from './WorkSheet';

type View = 'groups' | 'edit' | 'sum' | 'panel';
type SheetId = 'net' | 'proj' | 'rep' | 'work' | 'lib' | 'cmp' | 'rooms' | 'panel' | 'shop' | null;

const waitPhotos = async (n: number): Promise<void> => {
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('.pd-photo img'));
    if (imgs.length >= n && imgs.every(i => i.complete)) return;
    await new Promise<void>(r => window.setTimeout(r, 100));
  }
};

const isWide = () => window.matchMedia('(min-width:1000px)').matches;

export function App() {
  const [hist, dispatch] = useReducer(hreducer, undefined, () => initH(init(loadStore())));
  const state = hist.now;
  const [lib, libDispatch] = useReducer(libReducer, undefined, loadLib);
  const [view, setView] = useState<View>('groups');
  const [sheet, setSheet] = useState<SheetId>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>('report');
  const scrollPos = useRef(0);
  const [toast, setToast] = useState<{ text: string; label?: string; run?: () => void } | null>(null);
  const [incoming, setIncoming] = useState<Project | null>(() => {
    const h = readShareHash(window.location.hash);
    return h ? unpackProject(h) : null;
  });
  const [owner, setOwner] = useState<Project | null>(() => {
    const h = readOwnerHash(window.location.hash);
    return h ? unpackProject(h) : null;
  });
  const p = cur(state);
  const a = useMemo(() => calcAll(p.lines, p.cfg), [p.lines, p.cfg]);
  const selected = p.lines.find(l => l.id === state.sel) || null;
  const idx = selected ? p.lines.indexOf(selected) : -1;

  useEffect(() => {
    saveLib(lib);
  }, [lib]);

  useEffect(() => {
    gcPhotos(referencedPhotoIds(loadStore().list)).catch(() => undefined);
  }, []);

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

  useEffect(() => {
    const onHash = () => {
      const h = readShareHash(window.location.hash);
      if (h) setIncoming(unpackProject(h));
      const o = readOwnerHash(window.location.hash);
      setOwner(o ? unpackProject(o) : null);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const clearHash = () => {
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (e) {
      void e;
    }
  };
  const declineIncoming = () => {
    setIncoming(null);
    clearHash();
  };
  const acceptIncoming = () => {
    if (incoming) {
      const name = uniqName(state.list.map(x => x.name), incoming.name);
      dispatch({ t: 'importProjects', projects: [{ ...incoming, name }] });
    }
    declineIncoming();
  };

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
    const printNow = () => {
      try {
        window.print();
      } catch (e) {
        void e;
      }
      document.title = prev;
    };
    window.setTimeout(() => {
      const n = (p.photos ?? []).length;
      if (mode === 'proto' && n > 0) waitPhotos(n).then(printNow);
      else printNow();
    }, 50);
  };

  if (owner) {
    return (
      <OwnerView
        project={owner}
        onAdd={() => {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          setIncoming(owner);
          setOwner(null);
        }}
      />
    );
  }

  return (
    <LibContext.Provider value={{ lib, dispatch: libDispatch }}>
      <div id="app" data-view={view}>
        <header className="appbar">
          <div className="in">
            <div className="ab-edit">
              <button className="ab-back" type="button" onClick={goBack} aria-label="Назад к группам"><IconBack /></button>
              <h1 className="ab-title">{selected ? 'Г' + (idx + 1) + ' ' + (selected.name || 'Без названия') : ''}</h1>
              <button className="btn primary sm" type="button" onClick={goBack}>Готово</button>
            </div>
            <div className="ab-main">
              <h1 className="brand"><Brand /><span>Ampli</span></h1>
              <div className="kpis" aria-live="polite">
                <div><span className="lbl">Мощность</span><b>{a.P > 0 ? fmt(a.P / 1000, 1) + ' кВт' : '—'}</b></div>
                <div><span className="lbl">Ток</span><b>{a.Itot > 0 ? fmt(a.Itot, 0) + ' А' : '—'}</b></div>
                <div><span className="lbl">Ввод</span><b>{a.inIn ? 'C' + a.inIn : '—'}</b></div>
              </div>
              <button className="ab-btn" type="button" data-tip="Параметры сети" onClick={() => setSheet('net')} aria-label="Параметры сети">
                <IconNet />
                <span className="ab-txt">Параметры</span>
              </button>
              <button className="ab-btn" type="button" data-tip="Режим на щитке" aria-label="Режим на щитке" onClick={() => setSheet('panel')}>
                <IconPanel />
                <span className="ab-txt">На щитке</span>
              </button>
              <button className="ab-btn desk" type="button" data-tip="Монтаж и приёмка" onClick={() => setSheet('work')}>
                <IconCheck />
                <span className="ab-txt">Приёмка</span>
              </button>
              <button className="ab-btn desk" type="button" data-tip="Отчёт и спецификация" onClick={() => setSheet('rep')}>
                <IconDoc />
                <span className="ab-txt">Отчёт</span>
              </button>
            </div>
          </div>
        </header>

        <main className="workspace">
          <GroupList
            p={p}
            a={a}
            sel={state.sel}
            onSelect={id => { dispatch({ t: 'select', id }); goEdit(); }}
            onAdd={(t: LineType) => {
              dispatch({ t: 'addLine', type: t });
              setToast({ text: 'Добавлена группа: ' + TYPES[t].label, label: isWide() ? undefined : 'Открыть', run: goEdit });
            }}
            onCopy={id => {
              dispatch({ t: 'select', id });
              dispatch({ t: 'dupLine' });
              setToast({ text: 'Создана копия группы', label: 'Отменить', run: () => dispatch({ t: 'undo' }) });
            }}
            onDelete={id => {
              dispatch({ t: 'select', id });
              dispatch({ t: 'delLine' });
              setToast({ text: 'Группа удалена', label: 'Отменить', run: () => dispatch({ t: 'undo' }) });
            }}
            onFix={(id, act) => {
              dispatch({ t: 'select', id });
              if (act.k === 'len') dispatch({ t: 'lineField', field: 'len', value: act.len });
              else dispatch({ t: 'splitLine', mode: act.k });
              setToast({ text: 'Исправлено', label: 'Отменить', run: () => dispatch({ t: 'undo' }) });
            }}
            onOpenProj={() => setSheet('proj')}
            onOpenNet={() => setSheet('net')}
            onRooms={() => setSheet('rooms')}
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
              photos={p.photos ?? []}
            />
            <aside className="col col-res" aria-label="Итоги расчёта">
              <PanelPane a={a} onPick={id => { dispatch({ t: 'select', id }); goEdit(); }} onMove={(id, to) => dispatch({ t: 'moveLine', id, to })} />
              <Summary key={'s' + (view === 'sum')} a={a} solo={view === 'sum'} onBalance={() => dispatch({ t: 'balance' })} />
            </aside>
          </div>
        </main>

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
        <ProjectsSheet open={sheet === 'proj'} onClose={closeSheet} state={state} p={p} dispatch={dispatch} onLib={() => setSheet('lib')} />
        <LibSheet open={sheet === 'lib'} onClose={closeSheet} />
        <CompareSheet open={sheet === 'cmp'} onClose={closeSheet} p={p} a={a} />
        <RoomsSheet open={sheet === 'rooms'} onClose={closeSheet} p={p} dispatch={dispatch} />
        <ReportSheet open={sheet === 'rep'} onClose={closeSheet} p={p} a={a} onPrint={() => doPrint('report')} onCompare={() => setSheet('cmp')} onShop={() => setSheet('shop')} />
        <ShopSheet open={sheet === 'shop'} onClose={closeSheet} a={a} />
        {toast && <Toast text={toast.text} label={toast.label} onAction={toast.run} onClose={() => setToast(null)} />}
        <PanelMode open={sheet === 'panel'} onClose={closeSheet} a={a} dispatch={dispatch} />
        <IncomingSheet project={incoming} onAccept={acceptIncoming} onDecline={declineIncoming} />
        <WorkSheet open={sheet === 'work'} onClose={closeSheet} p={p} a={a} dispatch={dispatch} onPrint={doPrint} />
      </div>
      <PrintDoc p={p} a={a} mode={printMode} />
    </LibContext.Provider>
  );
}
