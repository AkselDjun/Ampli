import { IconCheck, IconDoc, IconList, IconPanel, IconTools } from '../ui/Icons';
import { MenuButton } from '../ui/MenuButton';
import { toolsMenu } from './navMenus';
import { useScrollHide } from '../ui/useScrollHide';
import { APP_VIEW } from './types';
import type { AppTabsProps } from './types';

export function AppTabs({ nav, calc, view, onGroups, onPanel, onWork, onReport }: AppTabsProps) {
  const hide = useScrollHide(view === APP_VIEW.GROUPS || view === APP_VIEW.PANEL, 120);
  return (
    <nav className={'tabs' + (hide ? ' hide' : '')} aria-label="Разделы" data-tour="reports">
      <button className="tab" type="button" onClick={onGroups} aria-current={view === APP_VIEW.GROUPS || view === APP_VIEW.EDITOR ? 'page' : undefined}>
        <IconList />
        <span>Группы</span>
        {calc.issues > 0 && <em className="badge">{calc.issues}</em>}
      </button>
      <button className="tab" type="button" data-tour="panel" onClick={onPanel} aria-current={view === APP_VIEW.PANEL ? 'page' : undefined}>
        <IconPanel />
        <span>Щиток</span>
      </button>
      <button className="tab" type="button" data-tour="work" onClick={onWork}>
        <IconCheck />
        <span>Приёмка</span>
      </button>
      <button className="tab" type="button" data-tour="report" onClick={onReport}>
        <IconDoc />
        <span>Отчёт</span>
      </button>
      <MenuButton
        className="tab"
        label="Ещё"
        trigger={<><IconTools /><span>Ещё</span></>}
        menuClass="tl-menu"
        groups={toolsMenu(nav)}
        up
        end
      />
    </nav>
  );
}
