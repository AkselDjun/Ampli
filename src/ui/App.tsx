import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { calcAll } from '../core/calc';
import type { LineType } from '../core/types';
import { blank, sample } from '../core/templates';
import { cur, init, reducer } from '../store/reducer';
import { TYPES } from '../core/norms';
import { HoverTips, Toaster } from './common';
import { toast, toastBad, toastOk, toastUndo } from './toast';
import { backupDue, keepData, snoozeBackup } from '../store/backup';
import { exportBackup } from './download';
import { BOOT_KEY, REVISION_KEY, changes, dropLegacy, loadBoot, mergeLists, ProjectConflictError, readProjects, saveBoot, saveStore, tabId, writeProjectsChecked } from '../store/storage';
import { libReducer, loadLib, saveLib } from '../store/lib';
import { LibContext } from '../store/LibContext';
import { gcPhotos, photoKeys } from '../store/photos';
import { referencedPhotoIds } from '../core/photos';
import { useBackClose } from './back';
import type { Cmd } from './Palette';
import { setTheme } from './theme';
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
import { hasLink, readEstimateHash, readOwnerHash, readShareHash } from '../core/links';
import type { EstimateShare } from '../core/links';
import { LINK_FAIL_TEXT, getCodec, loadCodec } from './linkCodec';
import { uniqName } from '../core/project';
import type { Project } from '../core/types';
import type { PrintMode } from './WorkSheet';
import type { FixAct } from '../core/fixes';
import type { CheckFix } from './Checks';
import { chapterHintPending, freshPending, markChapterHint, markFreshSeen, markSampleHint, onboardingPending, sampleHintPending } from '../features/onboarding/storage';
import type { TourFinish } from './Onboarding';
import { APP_SHEET, APP_VIEW } from '../app/types';
import type { AppView, ReportRequest, SaveStatus } from '../app/types';
import { useSheetStack } from '../app/useSheetStack';
import { AppHeader } from '../app/AppHeader';
import { AppTabs } from '../app/AppTabs';
import { sheetForTourScene } from '../app/navigation';
import { TOUR_CHAPTER, TOUR_MODE, TOUR_SCENE } from '../features/onboarding/model';
import type { TourChapter, TourMode, TourScene } from '../features/onboarding/model';

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
  const [boot] = useState(loadBoot);
  const [state, dispatch] = useReducer(reducer, boot, init);
  const [lib, libDispatch] = useReducer(libReducer, undefined, loadLib);
  const [view, setView] = useState<AppView>(APP_VIEW.GROUPS);
  const { sheet, setSheet, pushSheet, nav } = useSheetStack();
  const [whyOpen, setWhyOpen] = useState(false);
  const [printModes, setPrintModes] = useState<PrintMode[]>(['report']);
  const [printing, setPrinting] = useState(false);
  const [pal, setPal] = useState(false);
  const [repWant, setRepWant] = useState<ReportRequest | undefined>(undefined);
  const [workWant, setWorkWant] = useState<ReportRequest | undefined>(undefined);
  const scrollPos = useRef(0);
  const [incoming, setIncoming] = useState<Project | null>(() => {
    const h = readShareHash(window.location.hash);
    const c = getCodec();
    return h && c ? c.unpackProject(h) : null;
  });
  const [shared, setShared] = useState<EstimateShare | null>(() => {
    const h = readEstimateHash(window.location.hash);
    const c = getCodec();
    return h && c ? c.unpackEstimate(h) : null;
  });
  const [owner, setOwner] = useState<Project | null>(() => {
    const h = readOwnerHash(window.location.hash);
    const c = getCodec();
    return h && c ? c.unpackProject(h) : null;
  });
  const [tourOpen, setTourOpen] = useState(() => boot.source === 'empty' && !hasLink(window.location.hash) && onboardingPending());
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
  const onTourScene = useCallback((scene: TourScene) => {
    setPal(false);
    if (scene === TOUR_SCENE.HOME) {
      setSheet(null);
      setView(APP_VIEW.GROUPS);
    } else if (scene === TOUR_SCENE.EDITOR || scene === TOUR_SCENE.WIRING) {
      setSheet(null);
      if (p.lines[0]) dispatch({ t: 'select', id: p.lines[0].id });
      setView(isWide() ? APP_VIEW.GROUPS : APP_VIEW.EDITOR);
    } else {
      setView(APP_VIEW.GROUPS);
      if (scene === TOUR_SCENE.REPORT || scene === TOUR_SCENE.ESTIMATE) setRepWant({ tab: scene === TOUR_SCENE.ESTIMATE ? 'estimate' : 'groups', n: Date.now() });
      if (scene === TOUR_SCENE.PANEL || scene === TOUR_SCENE.WORK) setWorkWant({ tab: scene === TOUR_SCENE.PANEL ? 'meas' : 'check', n: Date.now() });
      setSheet(sheetForTourScene(scene));
    }
  }, [p.lines, setSheet]);
  const [tourChapter, setTourChapter] = useState<TourChapter | undefined>(undefined);
  const [tourMode, setTourMode] = useState<TourMode>(TOUR_MODE.FULL);
  const [freshAsk] = useState(() => !tourOpen && !incoming && !shared && !owner && freshPending());
  const freshDone = useRef(false);
  const busy = sheet !== null || (view === APP_VIEW.EDITOR && !isWide());
  useEffect(() => {
    if (!freshAsk || freshDone.current || busy) return;
    const t = window.setTimeout(() => {
      freshDone.current = true;
      markFreshSeen();
      toast('В Ampli новое: частный дом, укладка в мощность, карта проводки и смета в трёх вариантах.', { label: 'Показать', run: () => { setSheet(null); setTourMode(TOUR_MODE.FRESH); setTourOpen(true); } });
    }, 1500);
    return () => window.clearTimeout(t);
  }, [freshAsk, busy, setSheet]);
  const [hintCh, setHintCh] = useState<TourChapter | null>(null);
  useEffect(() => {
    const ch = sheet === APP_SHEET.WORK ? TOUR_CHAPTER.BUILD : (sheet === APP_SHEET.REPORT ? TOUR_CHAPTER.HANDOVER : null);
    if (!ch || tourOpen || onboardingPending() || !chapterHintPending(ch)) return;
    const t = window.setTimeout(() => {
      markChapterHint(ch);
      setHintCh(ch);
    }, 0);
    return () => window.clearTimeout(t);
  }, [sheet, tourOpen]);
  const hintOn = hintCh !== null && ((hintCh === TOUR_CHAPTER.BUILD && sheet === APP_SHEET.WORK) || (hintCh === TOUR_CHAPTER.HANDOVER && sheet === APP_SHEET.REPORT));
  const sheetNav = useMemo(() => (hintOn && hintCh ? {
    ...nav,
    hint: {
      text: hintCh === TOUR_CHAPTER.BUILD ? 'Впервые в монтаже? Покажем щиток, карту проводки и чек-лист за минуту.' : 'Впервые в документах? Покажем схему и смету в трёх вариантах за минуту.',
      label: 'Показать',
      run: () => { setHintCh(null); setTourChapter(hintCh); setTourOpen(true); },
      close: () => setHintCh(null)
    }
  } : nav), [hintOn, hintCh, nav]);
  const closeTour = useCallback(() => {
    setTourChapter(undefined);
    setTourMode(TOUR_MODE.FULL);
    setTourOpen(false);
    setSheet(null);
    setView(APP_VIEW.GROUPS);
  }, [setSheet]);
  const listNames = state.list.map(x => x.name);
  const finishTour = useStable((choice: TourFinish) => {
    if (choice !== 'create') return;
    const name = uniqName(listNames, 'Мой объект');
    dispatch({ t: 'addProject', content: blank(), name });
    setSheet(APP_SHEET.ROOMS);
    toastOk('Создан проект: ' + name);
  });

  const saveFail = useRef(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveSeq = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
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

  const disk = useRef({ full: boot.source === 'legacy', idb: true, clear: boot.source === 'legacy', order: boot.order, prev: boot.source === 'boot' ? boot.list : ([] as Project[]) });
  const conflict = useRef(false);
  const revision = useRef<string | null>(localStorage.getItem(REVISION_KEY));
  const tabOwner = useRef(tabId());
  const pendingWrite = useRef<Promise<void>>(Promise.resolve());

  const latest = useRef(state.list);
  useEffect(() => {
    latest.current = state.list;
  }, [state.list]);

  useEffect(() => {
    const d = disk.current;
    if (boot.source === 'legacy') {
      gcPhotos(referencedPhotoIds(boot.list)).catch(() => undefined);
      return;
    }
    const before = photoKeys();
    before.catch(() => undefined);
    readProjects()
      .then(stored => {
        d.full = true;
        d.prev = mergeLists(d.prev, stored, []);
        gcPhotos(referencedPhotoIds(mergeLists(latest.current, stored, [])), before).catch(() => undefined);
        dispatch({ t: 'hydrate', projects: stored, order: d.order, replace: boot.source === 'empty' });
      })
      .catch(() => {
        d.idb = false;
      });
  }, [boot]);

  const { cur: curId, list } = state;

  const asked = useRef(false);
  useEffect(() => {
    if (viewOnly || asked.current || !list.some(x => !x.sample)) return;
    asked.current = true;
    keepData().catch(() => undefined);
  }, [list, viewOnly]);

  useEffect(() => {
    if (viewOnly) return;
    const t = window.setTimeout(() => {
      if (!backupDue(latest.current)) return;
      snoozeBackup();
      toast('Резервная копия проектов не сохранялась больше недели', {
        label: 'Сохранить',
        run: () => { void exportBackup(latest.current).then(ok => ok ? toastOk('Резервная копия подготовлена') : toastBad('Не удалось подготовить резервную копию')); }
      });
    }, 6000);
    return () => window.clearTimeout(t);
  }, [viewOnly]);
  useEffect(() => {
    if (viewOnly) return;
    const d = disk.current;
    if (conflict.current) return;
    const seq = ++saveSeq.current;
    setSaveStatus('saving');
    const ids = list.map(x => x.id);
    const gone = new Set(d.prev.map(x => x.id).filter(id => !ids.includes(id)));
    d.order = d.full ? ids : [...d.order.filter(id => !gone.has(id)), ...ids.filter(id => !d.order.includes(id))];
    const bootOk = saveBoot(list.find(x => x.id === curId) as Project, d.order);
    const fallback = () => {
      const ok = d.full ? saveStore({ cur: curId, list }) : bootOk;
      onSaved(ok);
      if (mounted.current && seq === saveSeq.current) setSaveStatus(ok ? 'saved' : 'error');
    };
    if (!d.idb) {
      fallback();
      return;
    }
    const { put, del } = changes(d.prev, list);
    const clear = d.clear;
    d.prev = list;
    d.clear = false;
    const write = pendingWrite.current.then(() => {
      if (conflict.current) return;
      return writeProjectsChecked(put, del, revision.current, tabOwner.current, clear).then(next => { revision.current = next; });
    });
    pendingWrite.current = write.catch(() => undefined);
    write
      .then(() => {
        if (clear) dropLegacy();
        onSaved(true);
        if (mounted.current && seq === saveSeq.current) setSaveStatus('saved');
      })
      .catch((error: unknown) => {
        if (error instanceof ProjectConflictError) {
          conflict.current = true;
          if (mounted.current) setSaveStatus('conflict');
          try { localStorage.removeItem(BOOT_KEY); } catch (e) { void e; }
          toastBad('Проект изменён в другой вкладке. Обновите страницу перед продолжением работы.');
          return;
        }
        d.prev = [];
        d.clear = clear;
        fallback();
      });
  }, [curId, list, viewOnly]);

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

  useEffect(() => {
    let live = true;
    const apply = (c: NonNullable<ReturnType<typeof getCodec>>, full: boolean) => {
      const hs = window.location.hash;
      const sh = readShareHash(hs);
      const ow = readOwnerHash(hs);
      const es = readEstimateHash(hs);
      const inc = sh ? c.unpackProject(sh) : null;
      const own = ow ? c.unpackProject(ow) : null;
      const est = es ? c.unpackEstimate(es) : null;
      if (full) {
        if (sh) setIncoming(inc);
        setOwner(own);
        setShared(est);
      }
      if (!(sh || ow || es) || inc || own || est) return;
      toastBad('Ссылка повреждена или обрезана, её не удалось открыть. Попросите отправить её ещё раз.');
      try {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (e) {
        void e;
      }
    };
    const handle = (full: boolean) => {
      const c = getCodec();
      if (c) {
        apply(c, full);
        return;
      }
      if (hasLink(window.location.hash)) {
        void loadCodec().then(m => { if (live) apply(m, true); }, () => { if (live) toastBad(LINK_FAIL_TEXT); });
        return;
      }
      if (full) {
        setOwner(null);
        setShared(null);
      }
    };
    handle(false);
    const onHash = () => handle(true);
    window.addEventListener('hashchange', onHash);
    return () => {
      live = false;
      window.removeEventListener('hashchange', onHash);
    };
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
  const renumber = useStable(() => { dispatch({ t: 'sortByZone' }); toastOk('Группы перенумерованы по помещениям'); });
  const balance = useStable(() => { dispatch({ t: 'balance' }); toastOk('Фазы выровнены'); });
  const openProj = useStable(() => setSheet(APP_SHEET.PROJECTS));
  const openNet = useStable(() => setSheet(APP_SHEET.NETWORK));
  const openOld = useStable(() => setSheet(APP_SHEET.OLD_WIRING));
  const openFloor = useStable(() => setSheet(APP_SHEET.FLOOR));
  const openWeak = useStable(() => setSheet(APP_SHEET.WEAK));
  const openMeas = useStable(() => { setWorkWant({ tab: 'meas', n: Date.now() }); setSheet(APP_SHEET.WORK); });
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
  const sampleOpen = !!p.sample && !viewOnly && !tourOpen;
  useEffect(() => {
    if (!sampleOpen || freshAsk || !sampleHintPending() || !window.matchMedia('(max-width:760px)').matches) return;
    const t = window.setTimeout(() => {
      markSampleHint();
      toast('Это пример двухкомнатной квартиры. Нажмите на группу, чтобы изменить её.', { label: 'Начать с нуля', run: onBlank });
    }, 1200);
    return () => window.clearTimeout(t);
  }, [sampleOpen, freshAsk, onBlank]);
  const onSample = useStable(() => { dispatch({ t: 'replace', content: sample() }); toastOk('Загружен пример'); });
  const onCheckFix = useStable((f: CheckFix) => (f === 'net' ? setSheet(APP_SHEET.NETWORK) : dispatch({ t: 'cfg', field: 'supply', value: f === 'phase3' ? 3 : 1 })));
  const openRep = (t: string) => {
    setRepWant({ tab: t, n: Date.now() });
    setSheet(APP_SHEET.REPORT);
  };
  const cmds: Cmd[] = [
    ...p.lines.map((l, i) => ({ id: 'g' + l.id, group: 'Группы', label: 'Г' + (i + 1) + ' ' + (l.name || 'Без названия'), hint: l.zone?.trim() || TYPES[l.type].short, words: 'группа', late: true, run: () => { setSheet(null); dispatch({ t: 'select', id: l.id }); goEdit(); } })),
    { id: 'add-l', group: 'Добавить', label: 'Добавить группу освещения', words: 'свет новая', run: () => addGroup('light') },
    { id: 'add-s', group: 'Добавить', label: 'Добавить розеточную группу', words: 'розетки новая', run: () => addGroup('socket') },
    { id: 'add-p', group: 'Добавить', label: 'Добавить мощный прибор', words: 'плита бойлер новая группа', run: () => addGroup('power') },
    { id: 'rooms', group: 'Добавить', label: 'Собрать группы из комнат', words: 'комнаты', run: () => setSheet(APP_SHEET.ROOMS) },
    { id: 'floor', group: 'Добавить', label: 'Тёплый пол', words: 'нагревательный мат кабель плёнка терморегулятор обогрев', run: () => setSheet(APP_SHEET.FLOOR) },
    { id: 'weak', group: 'Добавить', label: 'Слаботочка: интернет, ТВ, камеры', words: 'utp rj45 lan телевидение домофон коаксиальный роутер коммутатор', run: () => setSheet(APP_SHEET.WEAK) },
    { id: 'rep', group: 'Документы', label: 'Отчёт и спецификация', words: 'отчет', run: () => openRep('groups') },
    { id: 'est', group: 'Документы', label: 'Смета: работы и материалы', words: 'цены стоимость клиент', run: () => openRep('estimate') },
    { id: 'scheme', group: 'Документы', label: 'Однолинейная схема', words: 'схема', run: () => openRep('scheme') },
    { id: 'print', group: 'Документы', label: 'Печать отчёта в PDF', words: 'pdf распечатать', run: () => doPrint('report') },
    { id: 'shop', group: 'Документы', label: 'Где купить', words: 'магазин прайс закупка', run: () => setSheet(APP_SHEET.SHOP) },
    { id: 'cmp', group: 'Документы', label: 'Сравнить варианты', words: 'что если', run: () => setSheet(APP_SHEET.COMPARE) },
    { id: 'work', group: 'Монтаж', label: 'Монтаж и приёмка', words: 'чек-лист протокол паспорт', run: () => setSheet(APP_SHEET.WORK) },
    { id: 'panel', group: 'Монтаж', label: 'Замеры на щитке', words: 'режим на щитке протокол петля изоляция узо', run: openMeas },
    { id: 'proto', group: 'Монтаж', label: 'Печать протокола замеров', words: 'pdf', run: () => doPrint('proto') },
    { id: 'pass', group: 'Монтаж', label: 'Печать паспорта для владельца', words: 'pdf', run: () => doPrint('passport') },
    { id: 'hidden', group: 'Монтаж', label: 'Печать акта скрытых работ', words: 'pdf освидетельствование штробы', run: () => doPrint('hidden') },
    { id: 'accept', group: 'Монтаж', label: 'Печать акта приёмки работ', words: 'pdf сдача гарантия', run: () => doPrint('accept') },
    { id: 'a3', group: 'Документы', label: 'Печать схемы A3 по ГОСТ', words: 'pdf чертёж однолинейная штамп', run: () => doPrint('a3') },
    { id: 'net', group: 'Проект', label: 'Параметры сети', words: 'фазы ввод мощность прокладка', run: () => setSheet(APP_SHEET.NETWORK) },
    { id: 'old', group: 'Проект', label: 'Старая проводка', words: 'алюминий обследование заземление зануление pe tn-c', run: () => setSheet(APP_SHEET.OLD_WIRING) },
    { id: 'proj', group: 'Проект', label: 'Проекты', words: 'открыть новый файл ссылка', run: () => setSheet(APP_SHEET.PROJECTS) },
    { id: 'lib', group: 'Проект', label: 'Мои данные', words: 'реквизиты шаблоны цены логотип тема оформление', run: () => setSheet(APP_SHEET.LIBRARY) },
    { id: 'th-dark', group: 'Вид', label: 'Тёмная тема', words: 'тема оформление ночь', run: () => setTheme('dark') },
    { id: 'th-light', group: 'Вид', label: 'Светлая тема', words: 'тема оформление день', run: () => setTheme('light') },
    { id: 'th-auto', group: 'Вид', label: 'Тема: авто', words: 'тема оформление как в системе', run: () => setTheme('auto') },
    ...(a.phases ? [{ id: 'bal', group: 'Проект', label: 'Выровнять нагрузку по фазам', words: 'фазы', run: () => { dispatch({ t: 'balance' }); toastOk('Фазы выровнены'); } }] : [])
  ];
  const tab = (v: AppView) => {
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
        <AppHeader
          selected={selected}
          selectedIndex={idx}
          saveStatus={saveStatus}
          calc={da}
          onBack={goBack}
          onNetwork={openNet}
          onGroup={pick}
          onCheckFix={onCheckFix}
          onTour={() => { setSheet(null); setTourOpen(true); }}
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
              onDeleted={() => { if (!isWide()) goBack(); }}
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
        <Hold open={sheet === APP_SHEET.PROJECTS}><ProjectsSheet open={sheet === APP_SHEET.PROJECTS} onClose={closeSheet} state={state} p={p} dispatch={dispatch} onLib={() => pushSheet(APP_SHEET.LIBRARY)} /></Hold>
        <Hold open={sheet === APP_SHEET.LIBRARY}><LibSheet open={sheet === APP_SHEET.LIBRARY} onClose={closeSheet} /></Hold>
        <Hold open={sheet === APP_SHEET.COMPARE}><CompareSheet open={sheet === APP_SHEET.COMPARE} onClose={closeSheet} p={p} a={a} /></Hold>
        <Hold open={sheet === APP_SHEET.ROOMS}><RoomsSheet open={sheet === APP_SHEET.ROOMS} onClose={closeSheet} p={p} dispatch={dispatch} /></Hold>
        <Hold open={sheet === APP_SHEET.REPORT}><ReportSheet open={sheet === APP_SHEET.REPORT} onClose={closeSheet} p={p} a={a} onPrint={doPrint} onShop={() => pushSheet(APP_SHEET.SHOP)} dispatch={dispatch} want={repWant} /></Hold>
        <Hold open={pal} eager><Palette open={pal} onClose={() => setPal(false)} cmds={cmds} /></Hold>
        <Hold open={sheet === APP_SHEET.SHOP}><ShopSheet open={sheet === APP_SHEET.SHOP} onClose={closeSheet} a={a} /></Hold>
        <Toaster />
        <HoverTips />
        <Hold open={sheet === APP_SHEET.WORK}><WorkSheet open={sheet === APP_SHEET.WORK} onClose={closeSheet} p={p} a={a} dispatch={dispatch} onPrint={doPrint} want={workWant} /></Hold>
        </SheetNavContext.Provider>
        <IncomingSheet project={incoming} onAccept={acceptIncoming} onDecline={declineIncoming} />
        <Hold open={tourOpen}>{tourOpen && <Onboarding onScene={onTourScene} onClose={closeTour} onFinish={finishTour} chapter={tourChapter} mode={tourMode} />}</Hold>
      </div>
      <Hold open={printing}>{printModes.map(m => <PrintDoc key={m} p={p} a={a} mode={m} />)}</Hold>
    </LibContext.Provider>
  );
}
