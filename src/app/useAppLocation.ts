import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../core/types';
import type { EstimateShare } from '../core/links';
import { LINK_FAIL_TEXT, getCodec, loadCodec } from '../ui/linkCodec';
import { toastBad } from '../ui/toast';
import { useSheetStack } from './useSheetStack';
import { defaultTab, sheetTabs } from './deepLink';
import { clearLocation, readLocation, subscribeLocation, writeSheetLocation } from './location';
import type { AppLink, AppLocation } from './location';
import type { AppSheet, SheetId, SheetNav } from './types';

type Codec = NonNullable<ReturnType<typeof getCodec>>;

export const BROKEN_LINK_TEXT = 'Ссылка повреждена или обрезана, её не удалось открыть. Попросите отправить её ещё раз.';

interface Opened {
  incoming: Project | null;
  owner: Project | null;
  shared: EstimateShare | null;
}

const NONE: Opened = { incoming: null, owner: null, shared: null };

const unpack = (c: Codec, link: AppLink | undefined): Opened => {
  if (!link) return NONE;
  if (link.kind === 'project') return { ...NONE, incoming: c.unpackProject(link.data) };
  if (link.kind === 'owner') return { ...NONE, owner: c.unpackProject(link.data) };
  return { ...NONE, shared: c.unpackEstimate(link.data) };
};

const opened = (o: Opened): boolean => !!(o.incoming || o.owner || o.shared);

export interface AppLocationApi {
  sheet: SheetId;
  nav: SheetNav;
  setSheet: (sheet: SheetId) => void;
  pushSheet: (sheet: AppSheet) => void;
  openSheet: (sheet: AppSheet, tab?: string) => void;
  tabOf: (sheet: AppSheet) => string | undefined;
  setTab: (sheet: AppSheet, tab: string) => void;
  incoming: Project | null;
  owner: Project | null;
  shared: EstimateShare | null;
  dropIncoming: () => void;
  closeShared: () => void;
  ownerToIncoming: () => void;
}

export function useAppLocation({ bootSheet }: { bootSheet: boolean }): AppLocationApi {
  const { sheet, setSheet, pushSheet, nav: stackNav } = useSheetStack();
  const [shown, setShown] = useState<SheetId>(null);
  const [shownOf, setShownOf] = useState<SheetId>(sheet);
  if (shownOf !== sheet) {
    setShownOf(sheet);
    setShown(null);
  }
  const markShown = useCallback(() => setShown(sheet), [sheet]);
  const nav = useMemo(() => ({ ...stackNav, shown: markShown }), [stackNav, markShown]);
  const [tabs, setTabs] = useState<Partial<Record<AppSheet, string>>>({});
  const [links, setLinks] = useState<Opened>(() => {
    const c = getCodec();
    return c ? unpack(c, readLocation().link) : NONE;
  });

  const openSheet = useCallback((id: AppSheet, tab?: string) => {
    if (tab && sheetTabs(id).includes(tab)) setTabs(t => (t[id] === tab ? t : { ...t, [id]: tab }));
    setSheet(id);
  }, [setSheet]);
  const setTab = useCallback((id: AppSheet, tab: string) => {
    setTabs(t => (t[id] === tab ? t : { ...t, [id]: tab }));
  }, []);
  const tabOf = useCallback((id: AppSheet) => tabs[id] ?? defaultTab(id), [tabs]);
  const sheetTab = sheet ? tabs[sheet] ?? defaultTab(sheet) : undefined;

  const visible = sheet !== null && shown === sheet ? sheet : null;
  useEffect(() => {
    writeSheetLocation(visible, sheetTab);
  }, [visible, sheetTab]);

  const bootLoc = useRef<AppLocation | null>(bootSheet ? readLocation() : null);
  useEffect(() => {
    let live = true;
    const applyLink = (c: Codec, loc: AppLocation, full: boolean) => {
      const next = unpack(c, loc.link);
      if (full) setLinks(prev => ({ incoming: loc.link?.kind === 'project' ? next.incoming : prev.incoming, owner: next.owner, shared: next.shared }));
      if (!loc.link || opened(next)) return;
      toastBad(BROKEN_LINK_TEXT);
      clearLocation();
    };
    const handle = (loc: AppLocation, full: boolean) => {
      const c = getCodec();
      if (c) {
        applyLink(c, loc, full);
        return;
      }
      if (loc.link) {
        void loadCodec().then(m => { if (live) applyLink(m, loc, true); }, () => { if (live) toastBad(LINK_FAIL_TEXT); });
        return;
      }
      if (full) setLinks(prev => ({ ...NONE, incoming: prev.incoming }));
    };
    const boot = bootLoc.current;
    const t = window.setTimeout(() => { if (boot?.sheet) openSheet(boot.sheet, boot.tab); }, 0);
    handle(readLocation(), false);
    const off = subscribeLocation(loc => {
      if (loc.sheet) openSheet(loc.sheet, loc.tab);
      handle(loc, true);
    });
    return () => {
      live = false;
      window.clearTimeout(t);
      off();
    };
  }, [openSheet]);

  const dropIncoming = useCallback(() => {
    setLinks(prev => ({ ...prev, incoming: null }));
    clearLocation();
  }, []);
  const closeShared = useCallback(() => {
    clearLocation();
    setLinks(prev => ({ ...prev, shared: null }));
  }, []);
  const ownerToIncoming = useCallback(() => {
    clearLocation();
    setLinks(prev => ({ incoming: prev.owner, owner: null, shared: null }));
  }, []);

  return { sheet, nav, setSheet, pushSheet, openSheet, tabOf, setTab, ...links, dropIncoming, closeShared, ownerToIncoming };
}
