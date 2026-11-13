import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { calcAll } from '../core/calc';
import type { LineType } from '../core/types';
import { blank, sample } from '../core/templates';
import { cur, init, reducer } from '../store/reducer';
import { TYPES } from '../core/norms';
import { HoverTips, Toaster } from './common';
import { toast, toastOk, toastUndo } from './toast';
import { loadBoot } from '../store/storage';
import { libReducer, loadLib, saveLib } from '../store/lib';
import { LibContext } from '../store/LibContext';
import { useBackClose } from './back';
import { updatedFrom } from './release';
import { APP_VERSION } from '../core/version';
import { GroupList } from './GroupList';
import { Editor } from './Editor';
import { PanelPane, Summary } from './Side';
import { SheetNavContext } from './sheetnav';
import { CompareSheet, EstimateView, FloorSheet, LibSheet, NetSheet, OldSheet, OwnerView, Palette, PrintDoc, ProjectsSheet, Onboarding, ReportSheet, RoomsSheet, ShopSheet, WeakSheet, WorkSheet, preloadParts } from './parts';
import { Hold, useStable } from './hold';
import { oldStarted, oldVerdict } from '../core/oldwire';
import { IncomingSheet } from './IncomingSheet';
import { uniqName } from '../core/project';
import type { FixAct } from '../core/fixes';
import type { CheckFix } from './Checks';
import { onboardingPending } from '../features/onboarding/storage';
import { APP_SHEET, APP_VIEW } from '../app/types';
import type { AppView } from '../app/types';
import { AppHeader } from '../app/AppHeader';
import { AppTabs } from '../app/AppTabs';
import { readLocation } from '../app/location';
import { useAppLocation } from '../app/useAppLocation';
import { useProjectPersistence } from '../app/useProjectPersistence';
import { useTour } from '../app/useTour';
import { usePrint } from '../app/usePrint';
import { paletteCommands } from '../app/paletteCommands';
import { BP, mediaMatches, useMedia } from './media';

export function App() {
  const [boot] = useState(loadBoot);
  const [state, dispatch] = useReducer(reducer, boot, init);
  const [lib, libDispatch] = useReducer(libReducer, undefined, loadLib);
  const [view, setView] = useState<AppView>(APP_VIEW.GROUPS);
  const [tourAtStart] = useState(() => boot.source === 'empty' && !readLocation().link && onboardingPending());
  const loc = useAppLocation({ bootSheet: !tourAtStart });
  const { sheet, setSheet, pushSheet, openSheet, tabOf, setTab, incoming, shared, owner } = loc;
  const wide = useMedia(BP.desktop);
  const [whyOpen, setWhyOpen] = useState(false);
  const [pal, setPal] = useState(false);
  const scrollPos = useRef(0);
  const p = cur(state);
  const { lines: pLines, cfg: pCfg, weak: pWeak, floor: pFloor } = p;
  const a = useMemo(() => calcAll(pLines, pCfg, { weak: pWeak, floor: pFloor }), [pLines, pCfg, pWeak, pFloor]);
  const dp = useDeferredValue(p);
  const da = useDeferredValue(a);
  const [hot, setHot] = useState<string | null>(null);
  const oldLabel = oldStarted(p.old) ? oldVerdict(p.old, a).label : '';
  const dOldLabel = oldStarted(dp.old) ? oldVerdict(dp.old, da).label : '';
  const selected = p.lines.find(l => l.id === state.sel) || null;
  const idx = selected ? p.lines.indexOf(selected) : -1;
  const viewOnly = !!shared || !!owner;
  const { saveStatus, onSaved } = useProjectPersistence({ boot, state, dispatch, viewOnly });
  const { printing, printModes, doPrint } = usePrint(p);

  useEffect(() => {
    if (!viewOnly) onSaved(saveLib(lib));
  }, [lib, viewOnly, onSaved]);

  useEffect(() => {
    const t = window.setTimeout(() => { preloadParts().catch(() => undefined); }, 1500);
    if (updatedFrom()) toastOk('Ampli обновлён до версии ' + APP_VERSION + '. Что нового: Мои данные, Оформление');
    return () => window.clearTimeout(t);
  }, []);

  const [viewOf, setViewOf] = useState(state.cur);
  if (viewOf !== state.cur) {
    setViewOf(state.cur);
    setView(APP_VIEW.GROUPS);
  }
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.cur]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPal(v => !v);
        return;
      }
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !document.querySelector('.sheet:not([hidden]) [role="dialog"], dialog[open]')) {
        e.preventDefault();
        setPal(true);
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);

  const acceptIncoming = () => {
    if (incoming) {
      const name = uniqName(state.list.map(x => x.name), incoming.name);
      dispatch({ t: 'importProjects', projects: [{ ...incoming, name }] });
      toastOk('Проект добавлен: ' + name);
    }
    loc.dropIncoming();
  };

  const closeSheet = useCallback(() => setSheet(null), [setSheet]);
  const onRepTab = useCallback((t: string) => setTab(APP_SHEET.REPORT, t), [setTab]);
  const onWorkTab = useCallback((t: string) => setTab(APP_SHEET.WORK, t), [setTab]);
  const goEdit = () => {
    if (mediaMatches(BP.desktop)) return;
    scrollPos.current = window.scrollY;
    setView(APP_VIEW.EDITOR);
    window.scrollTo(0, 0);
  };
  const goBack = () => {
    setView(APP_VIEW.GROUPS);
    window.setTimeout(() => window.scrollTo(0, scrollPos.current), 0);
  };
  useBackClose(view !== APP_VIEW.GROUPS, goBack);
  const addGroup = useStable((t: LineType) => {
    dispatch({ t: 'addLine', type: t });
    toast('Добавлена группа: ' + TYPES[t].label, mediaMatches(BP.desktop) ? {} : { label: 'Открыть', run: goEdit });
  });
  const pick = useStable((id: string) => { dispatch({ t: 'select', id }); goEdit(); });
  const copyLine = useStable((id: string) => {
    dispatch({ t: 'dupLine', id });
    toastOk('Создана копия группы');
  });
  const deleteLine = useStable((id: string) => {
    dispatch({ t: 'delLine', id });
    toastOk('Группа удалена');
  });
  const fixLine = useStable((id: string, act: FixAct) => {
    if (act.k === 'len') dispatch({ t: 'lineField', id, field: 'len', value: act.len });
    else dispatch({ t: 'splitLine', id, mode: act.k });
    toastOk('Исправлено');
  });
  const moveLine = useStable((id: string, to: string) => { dispatch({ t: 'moveLine', id, to }); toastOk('Порядок групп изменён'); });
  const renumber = useStable(() => { dispatch({ t: 'sortByZone' }); toastOk('Группы перенумерованы по помещениям'); });
  const balance = useStable(() => { dispatch({ t: 'balance' }); toastOk('Фазы выровнены'); });
  const openProj = useStable(() => setSheet(APP_SHEET.PROJECTS));
  const openNet = useStable(() => setSheet(APP_SHEET.NETWORK));
  const openOld = useStable(() => setSheet(APP_SHEET.OLD_WIRING));
  const openFloor = useStable(() => setSheet(APP_SHEET.FLOOR));
  const openWeak = useStable(() => setSheet(APP_SHEET.WEAK));
  const openMeas = useStable(() => openSheet(APP_SHEET.WORK, 'meas'));
  const openRooms = useStable(() => setSheet(APP_SHEET.ROOMS));
  const onBlank = useStable(() => {
    const was = { sample: !!p.sample, cfg: p.cfg, lines: p.lines };
    const name = p.name;
    dispatch({ t: 'replace', content: blank() });
    toastUndo('Проект очищен', () => {
      dispatch({ t: 'replace', content: was });
      dispatch({ t: 'meta', field: 'name', value: name });
    });
  });
  const onSample = useStable(() => {
    const was = { sample: !!p.sample, cfg: p.cfg, lines: p.lines };
    const name = p.name;
    dispatch({ t: 'replace', content: sample() });
    toastUndo('Загружен пример', () => {
      dispatch({ t: 'replace', content: was });
      dispatch({ t: 'meta', field: 'name', value: name });
    });
  });
  const onCheckFix = useStable((f: CheckFix) => (f === 'net' ? setSheet(APP_SHEET.NETWORK) : dispatch({ t: 'cfg', field: 'supply', value: f === 'phase3' ? 3 : 1 })));
  const closePalette = useCallback(() => setPal(false), []);
  const busy = sheet !== null || (view === APP_VIEW.EDITOR && !wide);
  const tour = useTour({
    atStart: tourAtStart,
    quiet: !!incoming || viewOnly,
    sheet,
    nav: loc.nav,
    busy,
    lines: p.lines,
    names: state.list.map(x => x.name),
    sample: !!p.sample && !viewOnly,
    dispatch,
    setSheet,
    openSheet,
    setView,
    closePalette,
    onBlank
  });
  const { tourOpen, sheetNav } = tour;
  const cmds = paletteCommands({ p, a, dispatch, setSheet, openSheet, pick, addGroup, doPrint });
  const tab = (v: AppView) => {
    setView(v);
    window.scrollTo(0, 0);
  };

  if (shared) {
    return (
      <Suspense fallback={null}>
        <EstimateView
          data={shared}
          onClose={loc.closeShared}
        />
      </Suspense>
    );
  }

  if (owner) {
    return (
      <Suspense fallback={null}>
        <OwnerView
          project={owner}
          onAdd={loc.ownerToIncoming}
        />
      </Suspense>
    );
  }

  return (
    <LibContext.Provider value={{ lib, dispatch: libDispatch }}>
      <div id="app" data-view={view}>
        <nav className="skip" aria-label="Быстрый переход">
          <a href="#groups">К списку групп</a>
          <a href="#editor" className="skip-ed">К карточке группы</a>
        </nav>
        <AppHeader
          selected={selected}
          selectedIndex={idx}
          saveStatus={saveStatus}
          calc={da}
          onBack={goBack}
          onNetwork={openNet}
          onGroup={pick}
          onCheckFix={onCheckFix}
          onTour={tour.startTour}
          onPanel={openMeas}
          onWork={() => setSheet(APP_SHEET.WORK)}
          onReport={() => setSheet(APP_SHEET.REPORT)}
          onCompare={() => setSheet(APP_SHEET.COMPARE)}
          onSearch={() => setPal(true)}
        />

        <main className="workspace">
          <GroupList
            p={dp}
            a={da}
            sel={state.sel}
            onSelect={pick}
            onAdd={addGroup}
            onCopy={copyLine}
            onDelete={deleteLine}
            onFix={fixLine}
            onRenumber={renumber}
            onOpenProj={openProj}
            onOpenNet={openNet}
            onOpenOld={openOld}
            onOpenFloor={openFloor}
            onOpenWeak={openWeak}
            oldLabel={dOldLabel}
            hot={hot}
            onHot={setHot}
            onRooms={openRooms}
            onBlank={onBlank}
            onSample={onSample}
          />
          <div className="main-col">
            <Editor
              l={selected}
              idx={idx}
              a={a}
              dispatch={dispatch}
              whyOpen={whyOpen}
              setWhyOpen={setWhyOpen}
              onDeleted={() => { if (!mediaMatches(BP.desktop)) goBack(); }}
              photos={p.photos ?? []}
            />
            <aside className="col col-res" aria-label="Итоги расчёта">
              <PanelPane a={da} sel={state.sel} hot={hot} onHot={setHot} onPick={pick} onMove={moveLine} />
              <Summary key={'s' + (view === APP_VIEW.PANEL)} a={da} solo={view === APP_VIEW.PANEL} onBalance={balance} />
            </aside>
          </div>
        </main>

        <AppTabs
          calc={da}
          view={view}
          onGroups={() => tab(APP_VIEW.GROUPS)}
          onPanel={() => tab(APP_VIEW.PANEL)}
          onWork={() => setSheet(APP_SHEET.WORK)}
          onReport={() => setSheet(APP_SHEET.REPORT)}
        />

        <SheetNavContext.Provider value={sheetNav}>
        <Hold open={sheet === APP_SHEET.NETWORK}><NetSheet open={sheet === APP_SHEET.NETWORK} onClose={closeSheet} p={p} dispatch={dispatch} onOld={() => pushSheet(APP_SHEET.OLD_WIRING)} oldLabel={oldLabel} /></Hold>
        <Hold open={sheet === APP_SHEET.FLOOR}><FloorSheet open={sheet === APP_SHEET.FLOOR} onClose={closeSheet} p={p} dispatch={dispatch} /></Hold>
        <Hold open={sheet === APP_SHEET.WEAK}><WeakSheet open={sheet === APP_SHEET.WEAK} onClose={closeSheet} p={p} dispatch={dispatch} /></Hold>
        <Hold open={sheet === APP_SHEET.OLD_WIRING}><OldSheet open={sheet === APP_SHEET.OLD_WIRING} onClose={closeSheet} p={p} a={a} dispatch={dispatch} onPrint={doPrint} /></Hold>
        <Hold open={sheet === APP_SHEET.PROJECTS}><ProjectsSheet open={sheet === APP_SHEET.PROJECTS} onClose={closeSheet} state={state} p={p} dispatch={dispatch} onLib={() => pushSheet(APP_SHEET.LIBRARY)} onBlank={onBlank} onSample={onSample} /></Hold>
        <Hold open={sheet === APP_SHEET.LIBRARY}><LibSheet open={sheet === APP_SHEET.LIBRARY} onClose={closeSheet} /></Hold>
        <Hold open={sheet === APP_SHEET.COMPARE}><CompareSheet open={sheet === APP_SHEET.COMPARE} onClose={closeSheet} p={p} a={a} /></Hold>
        <Hold open={sheet === APP_SHEET.ROOMS}><RoomsSheet open={sheet === APP_SHEET.ROOMS} onClose={closeSheet} p={p} dispatch={dispatch} /></Hold>
        <Hold open={sheet === APP_SHEET.REPORT}><ReportSheet open={sheet === APP_SHEET.REPORT} onClose={closeSheet} p={p} a={a} onPrint={doPrint} onShop={() => pushSheet(APP_SHEET.SHOP)} dispatch={dispatch} tab={tabOf(APP_SHEET.REPORT)} onTab={onRepTab} /></Hold>
        <Hold open={pal} eager><Palette open={pal} onClose={closePalette} cmds={cmds} /></Hold>
        <Hold open={sheet === APP_SHEET.SHOP}><ShopSheet open={sheet === APP_SHEET.SHOP} onClose={closeSheet} a={a} /></Hold>
        <Toaster />
        <HoverTips />
        <Hold open={sheet === APP_SHEET.WORK}><WorkSheet open={sheet === APP_SHEET.WORK} onClose={closeSheet} p={p} a={a} dispatch={dispatch} onPrint={doPrint} tab={tabOf(APP_SHEET.WORK)} onTab={onWorkTab} /></Hold>
        </SheetNavContext.Provider>
        <IncomingSheet project={incoming} onAccept={acceptIncoming} onDecline={loc.dropIncoming} />
        <Hold open={tourOpen}>{tourOpen && <Onboarding onScene={tour.onTourScene} onClose={tour.closeTour} onFinish={tour.finishTour} chapter={tour.tourChapter} mode={tour.tourMode} />}</Hold>
      </div>
      <Hold open={printing}>{printModes.map(m => <PrintDoc key={m} p={p} a={a} mode={m} />)}</Hold>
    </LibContext.Provider>
  );
}
