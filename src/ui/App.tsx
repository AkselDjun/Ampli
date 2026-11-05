import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { calcAll } from '../core/calc';
import type { LineType } from '../core/types';
import { blank, sample } from '../core/templates';
import { cur, init, reducer } from '../store/reducer';
import { TYPES } from '../core/norms';
import { HoverTips, Toaster } from './common';
import { toast, toastBad, toastOk } from './toast';
import { loadStore, saveStore } from '../store/storage';
import { libReducer, loadLib, saveLib } from '../store/lib';
import { LibContext } from '../store/LibContext';
import { gcPhotos } from '../store/photos';
import { referencedPhotoIds } from '../core/photos';
import { useBackClose } from './back';
import { Brand, IconBack, IconCheck, IconDoc, IconList, IconPanel } from './Icons';
import { Palette } from './Palette';
import type { Cmd } from './Palette';
import { setTheme } from './theme';
import { updatedFrom } from './release';
import { APP_VERSION } from '../core/version';
import { GroupList } from './GroupList';
import { Editor } from './Editor';
import { PanelPane, Summary } from './Side';
import { Totals } from './Totals';
import { Checks } from './Checks';
import { SheetNavContext } from './sheetnav';
import { CompareSheet, EstimateView, FloorSheet, LibSheet, NetSheet, OldSheet, OwnerView, PanelMode, PrintDoc, ProjectsSheet, ReportSheet, RoomsSheet, ShopSheet, WeakSheet, WorkSheet, preloadParts } from './parts';
import { Hold, useStable } from './hold';
import { oldStarted, oldVerdict } from '../core/oldwire';
import { IncomingSheet } from './IncomingSheet';
import { readEstimateHash, readOwnerHash, readShareHash, unpackEstimate, unpackProject } from '../core/share';
import type { EstimateShare } from '../core/share';
import { uniqName } from '../core/project';
import type { Project } from '../core/types';
import type { PrintMode } from './WorkSheet';
import type { FixAct } from '../core/fixes';
import type { CheckFix } from './Checks';
import { Button } from './kit';

type View = 'groups' | 'edit' | 'panel';
type SheetId = 'net' | 'proj' | 'rep' | 'work' | 'lib' | 'cmp' | 'rooms' | 'panel' | 'shop' | 'old' | 'floor' | 'weak' | null;

const SHEET_TITLE: Record<NonNullable<SheetId>, string> = { net: 'Параметры сети', proj: 'Проекты', rep: 'Отчёт и спецификация', work: 'Монтаж и приёмка', lib: 'Мои данные', cmp: 'Сравнение', rooms: 'Комнаты', panel: 'На щитке', shop: 'Где купить', old: 'Старая проводка', floor: 'Тёплый пол', weak: 'Слаботочка' };

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
  const [state, dispatch] = useReducer(reducer, undefined, () => init(loadStore()));
  const [lib, libDispatch] = useReducer(libReducer, undefined, loadLib);
  const [view, setView] = useState<View>('groups');
  const [stack, setStack] = useState<NonNullable<SheetId>[]>([]);
  const sheet: SheetId = stack.length ? stack[stack.length - 1] : null;
  const setSheet = useCallback((id: SheetId) => setStack(id ? [id] : []), []);
  const pushSheet = (id: NonNullable<SheetId>) => setStack(s => [...s.filter(x => x !== id), id]);
  const nav = { back: stack.length > 1 ? () => setStack(s => s.slice(0, -1)) : undefined, to: stack.length > 1 ? SHEET_TITLE[stack[stack.length - 2]] : undefined };
  const [whyOpen, setWhyOpen] = useState(false);
  const [printModes, setPrintModes] = useState<PrintMode[]>(['report']);
  const [printing, setPrinting] = useState(false);
  const [pal, setPal] = useState(false);
  const [repWant, setRepWant] = useState<{ tab: string; n: number } | undefined>(undefined);
  const scrollPos = useRef(0);
  const [incoming, setIncoming] = useState<Project | null>(() => {
    const h = readShareHash(window.location.hash);
    return h ? unpackProject(h) : null;
  });
  const [shared, setShared] = useState<EstimateShare | null>(() => {
    const h = readEstimateHash(window.location.hash);
    return h ? unpackEstimate(h) : null;
  });
  const [owner, setOwner] = useState<Project | null>(() => {
    const h = readOwnerHash(window.location.hash);
    return h ? unpackProject(h) : null;
  });
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

  const saveFail = useRef(false);
  const onSaved = (ok: boolean) => {
    if (!ok && !saveFail.current) toastBad('Не удалось сохранить изменения: в браузере закончилось место. Удалите лишние проекты или фото и сохраните проект в файл.');
    saveFail.current = !ok;
  };
  const viewOnly = !!shared || !!owner;

  useEffect(() => {
    if (!viewOnly) onSaved(saveLib(lib));
  }, [lib, viewOnly]);

  useEffect(() => {
    const t = window.setTimeout(() => { preloadParts().catch(() => undefined); }, 1500);
    if (updatedFrom()) toastOk('Ampli обновлён до версии ' + APP_VERSION + '. Что нового: Мои данные, Оформление');
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  useEffect(() => {
    gcPhotos(referencedPhotoIds(loadStore().list)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!viewOnly) onSaved(saveStore({ cur: state.cur, list: state.list }));
  }, [state.cur, state.list, viewOnly]);

  const [viewOf, setViewOf] = useState(state.cur);
  if (viewOf !== state.cur) {
    setViewOf(state.cur);
    setView('groups');
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

  useEffect(() => {
    const onHash = () => {
      const h = readShareHash(window.location.hash);
      if (h) setIncoming(unpackProject(h));
      const o = readOwnerHash(window.location.hash);
      setOwner(o ? unpackProject(o) : null);
      const e = readEstimateHash(window.location.hash);
      setShared(e ? unpackEstimate(e) : null);
    };
    const bad = () => {
      const hs = window.location.hash;
      const r = readShareHash(hs) ?? readOwnerHash(hs) ?? readEstimateHash(hs);
      if (!r) return;
      const okp = readShareHash(hs) ? unpackProject(r) : readOwnerHash(hs) ? unpackProject(r) : unpackEstimate(r);
      if (okp) return;
      toastBad('Ссылка повреждена или обрезана, её не удалось открыть. Попросите отправить её ещё раз.');
      try {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (e) {
        void e;
      }
    };
    bad();
    const onHash2 = () => { onHash(); bad(); };
    window.addEventListener('hashchange', onHash2);
    return () => window.removeEventListener('hashchange', onHash2);
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
      toastOk('Проект добавлен: ' + name);
    }
    declineIncoming();
  };

  const closeSheet = useCallback(() => setSheet(null), [setSheet]);
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
  useBackClose(view !== 'groups', goBack);
  const addGroup = useStable((t: LineType) => {
    dispatch({ t: 'addLine', type: t });
    toast('Добавлена группа: ' + TYPES[t].label, isWide() ? {} : { label: 'Открыть', run: goEdit });
  });
  const pick = useStable((id: string) => { dispatch({ t: 'select', id }); goEdit(); });
  const copyLine = useStable((id: string) => {
    dispatch({ t: 'select', id });
    dispatch({ t: 'dupLine' });
    toastOk('Создана копия группы');
  });
  const deleteLine = useStable((id: string) => {
    dispatch({ t: 'select', id });
    dispatch({ t: 'delLine' });
    toastOk('Группа удалена');
  });
  const fixLine = useStable((id: string, act: FixAct) => {
    dispatch({ t: 'select', id });
    if (act.k === 'len') dispatch({ t: 'lineField', field: 'len', value: act.len });
    else dispatch({ t: 'splitLine', mode: act.k });
    toastOk('Исправлено');
  });
  const moveLine = useStable((id: string, to: string) => { dispatch({ t: 'moveLine', id, to }); toastOk('Порядок групп изменён'); });
  const balance = useStable(() => { dispatch({ t: 'balance' }); toastOk('Фазы выровнены'); });
  const openProj = useStable(() => setSheet('proj'));
  const openNet = useStable(() => setSheet('net'));
  const openOld = useStable(() => setSheet('old'));
  const openFloor = useStable(() => setSheet('floor'));
  const openWeak = useStable(() => setSheet('weak'));
  const openRooms = useStable(() => setSheet('rooms'));
  const onBlank = useStable(() => { dispatch({ t: 'replace', content: blank() }); toastOk('Проект очищен'); });
  const onSample = useStable(() => { dispatch({ t: 'replace', content: sample() }); toastOk('Загружен пример'); });
  const onCheckFix = useStable((f: CheckFix) => (f === 'net' ? setSheet('net') : dispatch({ t: 'cfg', field: 'supply', value: f === 'phase3' ? 3 : 1 })));
  const openRep = (t: string) => {
    setRepWant({ tab: t, n: Date.now() });
    setSheet('rep');
  };
  const cmds: Cmd[] = [
    ...p.lines.map((l, i) => ({ id: 'g' + l.id, group: 'Группы', label: 'Г' + (i + 1) + ' ' + (l.name || 'Без названия'), hint: l.where || TYPES[l.type].short, words: 'группа', run: () => { setSheet(null); dispatch({ t: 'select', id: l.id }); goEdit(); } })),
    { id: 'add-l', group: 'Добавить', label: 'Добавить группу освещения', words: 'свет новая', run: () => addGroup('light') },
    { id: 'add-s', group: 'Добавить', label: 'Добавить розеточную группу', words: 'розетки новая', run: () => addGroup('socket') },
    { id: 'add-p', group: 'Добавить', label: 'Добавить мощный прибор', words: 'плита бойлер новая группа', run: () => addGroup('power') },
    { id: 'rooms', group: 'Добавить', label: 'Собрать группы из комнат', words: 'комнаты', run: () => setSheet('rooms') },
    { id: 'floor', group: 'Добавить', label: 'Тёплый пол', words: 'нагревательный мат кабель плёнка терморегулятор обогрев', run: () => setSheet('floor') },
    { id: 'weak', group: 'Добавить', label: 'Слаботочка: интернет, ТВ, камеры', words: 'utp rj45 lan телевидение домофон коаксиальный роутер коммутатор', run: () => setSheet('weak') },
    { id: 'rep', group: 'Документы', label: 'Отчёт и спецификация', words: 'отчет', run: () => openRep('groups') },
    { id: 'est', group: 'Документы', label: 'Смета: работы и материалы', words: 'цены стоимость клиент', run: () => openRep('estimate') },
    { id: 'scheme', group: 'Документы', label: 'Однолинейная схема', words: 'схема', run: () => openRep('scheme') },
    { id: 'print', group: 'Документы', label: 'Печать отчёта в PDF', words: 'pdf распечатать', run: () => doPrint('report') },
    { id: 'shop', group: 'Документы', label: 'Где купить', words: 'магазин прайс закупка', run: () => setSheet('shop') },
    { id: 'cmp', group: 'Документы', label: 'Сравнить варианты', words: 'что если', run: () => setSheet('cmp') },
    { id: 'work', group: 'Монтаж', label: 'Монтаж и приёмка', words: 'чек-лист протокол паспорт', run: () => setSheet('work') },
    { id: 'panel', group: 'Монтаж', label: 'Режим «На щитке»', words: 'замеры', run: () => setSheet('panel') },
    { id: 'proto', group: 'Монтаж', label: 'Печать протокола замеров', words: 'pdf', run: () => doPrint('proto') },
    { id: 'pass', group: 'Монтаж', label: 'Печать паспорта для владельца', words: 'pdf', run: () => doPrint('passport') },
    { id: 'hidden', group: 'Монтаж', label: 'Печать акта скрытых работ', words: 'pdf освидетельствование штробы', run: () => doPrint('hidden') },
    { id: 'accept', group: 'Монтаж', label: 'Печать акта приёмки работ', words: 'pdf сдача гарантия', run: () => doPrint('accept') },
    { id: 'a3', group: 'Документы', label: 'Печать схемы A3 по ГОСТ', words: 'pdf чертёж однолинейная штамп', run: () => doPrint('a3') },
    { id: 'net', group: 'Проект', label: 'Параметры сети', words: 'фазы ввод мощность прокладка', run: () => setSheet('net') },
    { id: 'old', group: 'Проект', label: 'Старая проводка', words: 'алюминий обследование заземление зануление pe tn-c', run: () => setSheet('old') },
    { id: 'proj', group: 'Проект', label: 'Проекты', words: 'открыть новый файл ссылка', run: () => setSheet('proj') },
    { id: 'lib', group: 'Проект', label: 'Мои данные', words: 'реквизиты шаблоны цены логотип тема оформление', run: () => setSheet('lib') },
    { id: 'th-dark', group: 'Вид', label: 'Тёмная тема', words: 'тема оформление ночь', run: () => setTheme('dark') },
    { id: 'th-light', group: 'Вид', label: 'Светлая тема', words: 'тема оформление день', run: () => setTheme('light') },
    { id: 'th-auto', group: 'Вид', label: 'Тема как в системе', words: 'тема оформление авто', run: () => setTheme('auto') },
    ...(a.phases ? [{ id: 'bal', group: 'Проект', label: 'Выровнять нагрузку по фазам', words: 'фазы', run: () => { dispatch({ t: 'balance' }); toastOk('Фазы выровнены'); } }] : [])
  ];
  const tab = (v: View) => {
    setView(v);
    window.scrollTo(0, 0);
  };
  const doPrint = (mode: PrintMode | PrintMode[] = 'report') => {
    const modes = Array.isArray(mode) ? mode : [mode];
    setPrintModes(modes);
    setPrinting(true);
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
      if (modes.includes('proto') && n > 0) waitPhotos(n).then(printNow);
      else printNow();
    }, 50);
  };

  if (shared) {
    return (
      <Suspense fallback={null}>
        <EstimateView
          data={shared}
          onClose={() => {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
            setShared(null);
          }}
        />
      </Suspense>
    );
  }

  if (owner) {
    return (
      <Suspense fallback={null}>
        <OwnerView
          project={owner}
          onAdd={() => {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
            setIncoming(owner);
            setOwner(null);
          }}
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
        <header className="appbar">
          <div className="in">
            <div className="ab-edit">
              <button className="ab-back" type="button" onClick={goBack} aria-label="Назад к группам"><IconBack /></button>
              <div className="ab-tw">
                <h1 className="ab-title">{selected ? 'Г' + (idx + 1) + ' ' + (selected.name || 'Без названия') : ''}</h1>
                <div id="ab-sub" className="ab-sub" />
              </div>
              <Button variant="primary" size="sm" onClick={goBack}>Готово</Button>
            </div>
            <div className="ab-main">
              <h1 className="brand"><Brand /><span>Ampli</span></h1>
              <div className="hud">
                <Totals a={da} onNet={openNet} />
                <Checks a={da} onGroup={pick} onFix={onCheckFix} />
              </div>
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
            p={dp}
            a={da}
            sel={state.sel}
            onSelect={pick}
            onAdd={addGroup}
            onCopy={copyLine}
            onDelete={deleteLine}
            onFix={fixLine}
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
              onDeleted={() => { if (!isWide()) goBack(); }}
              photos={p.photos ?? []}
            />
            <aside className="col col-res" aria-label="Итоги расчёта">
              <PanelPane a={da} sel={state.sel} hot={hot} onHot={setHot} onPick={pick} onMove={moveLine} />
              <Summary key={'s' + (view === 'panel')} a={da} solo={view === 'panel'} onBalance={balance} />
            </aside>
          </div>
        </main>

        <nav className="tabs" aria-label="Разделы">
          <button type="button" onClick={() => tab('groups')} aria-current={view === 'groups' || view === 'edit' ? 'page' : undefined}>
            <IconList />
            <span>Группы</span>
            {da.issues > 0 && <em className="badge">{da.issues}</em>}
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

        <SheetNavContext.Provider value={nav}>
        <Hold open={sheet === 'net'}><NetSheet open={sheet === 'net'} onClose={closeSheet} p={p} dispatch={dispatch} onOld={() => pushSheet('old')} oldLabel={oldLabel} /></Hold>
        <Hold open={sheet === 'floor'}><FloorSheet open={sheet === 'floor'} onClose={closeSheet} p={p} dispatch={dispatch} /></Hold>
        <Hold open={sheet === 'weak'}><WeakSheet open={sheet === 'weak'} onClose={closeSheet} p={p} dispatch={dispatch} /></Hold>
        <Hold open={sheet === 'old'}><OldSheet open={sheet === 'old'} onClose={closeSheet} p={p} a={a} dispatch={dispatch} onPrint={doPrint} /></Hold>
        <Hold open={sheet === 'proj'}><ProjectsSheet open={sheet === 'proj'} onClose={closeSheet} state={state} p={p} dispatch={dispatch} onLib={() => pushSheet('lib')} /></Hold>
        <Hold open={sheet === 'lib'}><LibSheet open={sheet === 'lib'} onClose={closeSheet} /></Hold>
        <Hold open={sheet === 'cmp'}><CompareSheet open={sheet === 'cmp'} onClose={closeSheet} p={p} a={a} /></Hold>
        <Hold open={sheet === 'rooms'}><RoomsSheet open={sheet === 'rooms'} onClose={closeSheet} p={p} dispatch={dispatch} /></Hold>
        <Hold open={sheet === 'rep'}><ReportSheet open={sheet === 'rep'} onClose={closeSheet} p={p} a={a} onPrint={doPrint} onCompare={() => pushSheet('cmp')} onShop={() => pushSheet('shop')} dispatch={dispatch} want={repWant} /></Hold>
        <Hold open={pal} eager><Palette open={pal} onClose={() => setPal(false)} cmds={cmds} /></Hold>
        <Hold open={sheet === 'shop'}><ShopSheet open={sheet === 'shop'} onClose={closeSheet} a={a} /></Hold>
        <Toaster />
        <HoverTips />
        <Hold open={sheet === 'panel'}><PanelMode open={sheet === 'panel'} onClose={closeSheet} a={a} dispatch={dispatch} /></Hold>
        <Hold open={sheet === 'work'}><WorkSheet open={sheet === 'work'} onClose={closeSheet} p={p} a={a} dispatch={dispatch} onPrint={doPrint} onBoard={() => pushSheet('panel')} /></Hold>
        </SheetNavContext.Provider>
        <IncomingSheet project={incoming} onAccept={acceptIncoming} onDecline={declineIncoming} />
      </div>
      <Hold open={printing}>{printModes.map(m => <PrintDoc key={m} p={p} a={a} mode={m} />)}</Hold>
    </LibContext.Provider>
  );
}
