import { IconCheck, IconDoc, IconDown, IconList, IconPanel, IconTools } from '../ui/Icons';
import { MenuButton } from '../ui/MenuButton';
import { navMenus } from './navLoad';
import { useScrollHide } from '../ui/useScrollHide';
import { APP_SHEET, APP_VIEW } from './types';
import type { AppTabsProps } from './types';

export function AppTabs({ nav, calc, view, page, open, onGroups, onPanel, onWork, onReport }: AppTabsProps) {
  const hide = useScrollHide(!page && (view === APP_VIEW.GROUPS || view === APP_VIEW.PANEL), 120);
  const cur = page === APP_SHEET.WORK ? 'work' : page === APP_SHEET.REPORT ? 'report' : view === APP_VIEW.PANEL ? 'panel' : 'groups';
  const at = (k: string) => (cur === k ? 'page' : undefined);
  return (
    <nav className={'tabs' + (hide ? ' hide' : '')} aria-label="Разделы" data-tour="reports">
      <button className="tab" type="button" onClick={onGroups} aria-current={at('groups')}>
        <IconList />
        <span>Группы</span>
        {calc.rows.length > 0 && <em className={'cnt' + (calc.issues > 0 ? ' bad' : '')}><span className="vh">: </span>{calc.rows.length}</em>}
      </button>
      <button className="tab" type="button" data-tour="panel" onClick={onPanel} aria-current={at('panel')}>
        <IconPanel />
        <span>Щиток</span>
      </button>
      <button className="tab" type="button" data-tour="work" onClick={onWork} aria-current={at('work')}>
        <IconCheck />
        <span>Приёмка</span>
        {open > 0 && <em className="cnt"><span className="vh">, не отмечено: </span>{open}</em>}
      </button>
      <button className="tab" type="button" data-tour="report" onClick={onReport} aria-current={at('report')}>
        <IconDoc />
        <span>Отчёт</span>
      </button>
      <MenuButton
        className="tab tab-tools"
        box="tab-tl"
        label="Инструменты"
        tip="Комнаты, сравнение, тёплый пол, закупка"
        trigger={<><IconTools /><span>Инструменты</span><IconDown className="dd" /></>}
        menuClass="tl-menu"
        groups={() => navMenus.get()?.toolsMenu(nav) ?? null}
        load={navMenus.load}
        up
        end
      />
    </nav>
  );
}
