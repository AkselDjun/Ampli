import { Brand, IconBack, IconCheck, IconDoc, IconDown, IconGear, IconMeter, IconTools } from '../ui/Icons';
import { MenuButton } from '../ui/MenuButton';
import { useNow } from '../ui/now';
import { Checks } from '../ui/Checks';
import { Totals } from '../ui/Totals';
import { Button } from '../ui/kit';
import { navMenus } from './navLoad';
import type { AppHeaderProps } from './types';

export function AppHeader({ list, cur, nav, selected, selectedIndex, saveStatus, calc, onBack, onNetwork, onGroup, onCheckFix, onPanel, onWork, onReport, onCompare }: AppHeaderProps) {
  const time = useNow();
  const name = list.find(x => x.id === cur)?.name ?? '';
  return (
    <header className="appbar">
      <div className="in">
        <div className="ab-edit">
          <button className="ab-back" type="button" onClick={onBack} aria-label="Назад к группам"><IconBack /></button>
          <div className="ab-tw">
            <h1 className="ab-title">{selected ? 'Группа ' + (selectedIndex + 1) : ''}</h1>
            <div id="ab-sub" className="ab-sub" />
          </div>
          <Button variant="primary" size="sm" onClick={onBack}>Готово</Button>
        </div>
        <div className="ab-main">
          <h1 className="brand"><Brand /><span>Ampli</span></h1>
          <MenuButton
            className="pj-switch"
            box="pj"
            label={'Проект: ' + (name || 'Без названия') + '. Сменить проект'}
            trigger={<><span className="pj-slash" aria-hidden="true">/</span><span className="pj-name">{name || 'Без названия'}</span><IconDown className="pj-chev" /></>}
            menuClass="pj-menu"
            groups={() => navMenus.get()?.projectMenu(list, cur, time, nav) ?? null}
            load={navMenus.load}
          />
          <span className="save-indicator" aria-live="polite">{saveStatus === 'saving' ? 'Сохранение…' : saveStatus === 'saved' ? 'Сохранено' : saveStatus === 'conflict' ? 'Конфликт вкладок' : 'Ошибка сохранения проектов'}</span>
          <div className="hud" data-tour="summary">
            <Totals a={calc} onNet={onNetwork} onCompare={onCompare} />
            <Checks a={calc} onGroup={onGroup} onFix={onCheckFix} />
          </div>
          <button className="ab-btn ab-meas" type="button" data-tour="panel" data-tip="Приёмка: замеры на щитке" aria-label="Замеры на щитке" onClick={onPanel}>
            <IconMeter />
            <span className="ab-txt">Замеры</span>
          </button>
          <button className="ab-btn desk" type="button" data-tour="work" data-tip="Приёмка" onClick={onWork}>
            <IconCheck />
            <span className="ab-txt">Приёмка</span>
          </button>
          <button className="ab-btn desk" type="button" data-tour="report" data-tip="Отчёт и спецификация" onClick={onReport}>
            <IconDoc />
            <span className="ab-txt">Отчёт</span>
          </button>
          <MenuButton
            className="ab-btn desk ab-tools"
            box="tl"
            label="Инструменты"
            tip="Комнаты, сравнение, тёплый пол, закупка"
            trigger={<><IconTools /><span className="ab-txt">Инструменты</span></>}
            menuClass="tl-menu"
            groups={() => navMenus.get()?.toolsMenu(nav) ?? null}
            load={navMenus.load}
            end
          />
          <MenuButton
            className="ab-btn ab-gear"
            label="Настройки и обучение"
            tip="Мои данные, обмен, обучение"
            trigger={<IconGear />}
            groups={() => navMenus.get()?.settingsMenu(nav) ?? null}
            load={navMenus.load}
            end
          />
        </div>
      </div>
    </header>
  );
}
