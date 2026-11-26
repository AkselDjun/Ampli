import { Suspense } from 'react';
import { Brand, IconBack, IconChev, IconDown, IconGear, IconMoon, IconSun, IconTick } from '../ui/Icons';
import { MenuButton } from '../ui/MenuButton';
import { useNow } from '../ui/now';
import { Button } from '../ui/kit';
import { StageBar } from '../ui/parts';
import { useTheme } from '../ui/theme';
import { initials, whenLabel } from '../core/recent';
import { stageOf } from '../core/stage';
import { netLine } from '../core/netline';
import { navMenus } from './navLoad';
import type { AppHeaderProps } from './types';

const SAVE: Record<AppHeaderProps['saveStatus'], string> = { saving: 'Сохранение…', saved: 'Сохранено', conflict: 'Конфликт вкладок', error: 'Ошибка сохранения проектов' };

export function AppHeader({ p, list, cur, nav, selected, selectedIndex, saveStatus, calc, onBack, onNetwork, onStage, onStageAct }: AppHeaderProps) {
  const time = useNow();
  const name = list.find(x => x.id === cur)?.name ?? '';
  const [theme, setTheme] = useTheme();
  const dark = theme === 'dark' || (theme === 'auto' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const stage = stageOf(p);
  const staged = !p.sample && p.lines.length > 0;
  const net = netLine(calc.c);
  return (
    <header className="appbar">
      <div className="in">
        <div className="ab-edit">
          <button className="ab-back" type="button" onClick={onBack} aria-label="Назад к группам"><IconBack /><span aria-hidden="true">Группы</span></button>
          <div className="ab-tw">
            <h1 className="ab-title">{selected ? 'Группа ' + String(selectedIndex + 1).padStart(2, '0') : ''}</h1>
            <div id="ab-sub" className="ab-sub" />
          </div>
          <Button variant="primary" size="sm" onClick={onBack}>Готово</Button>
        </div>
        <div className="ab-main">
          <span className="logo" aria-hidden="true"><Brand /></span>
          <span className="pj-ava" aria-hidden="true">{initials(name || 'Без названия')}</span>
          <h1 className="vh">Ampli</h1>
          <nav className="crumb" aria-label="Путь">
            <button type="button" className="crumb-a" onClick={nav.projects}>Проекты</button>
            <span className="crumb-s" aria-hidden="true">/</span>
            <span className="crumb-pj">
              <MenuButton
                className="pj-switch"
                box="pj"
                label={'Проект: ' + (name || 'Без названия') + '. Сменить проект'}
                trigger={<><span className="pj-name">{name || 'Без названия'}</span><span className="save-tick"><IconTick wait={saveStatus === 'saving'} /></span><IconDown className="pj-chev" /></>}
                menuClass="pj-menu"
                groups={() => navMenus.get()?.projectMenu(list, cur, time, nav) ?? null}
                load={navMenus.load}
              />
              <button type="button" className="net-sub" onClick={onNetwork} data-tour="network"><span className="vh">Параметры сети: </span><span className="mono">{net}</span><IconChev className="chev" /></button>
            </span>
          </nav>
          {staged && <Suspense fallback={<span className="stg-pill stg-wait" aria-hidden="true" />}><StageBar pill n={stage} sentAt={p.sent ? whenLabel(p.sent.at, time) : undefined} onStage={onStage} onAct={onStageAct} /></Suspense>}
          <button type="button" className="net-chip mono" onClick={onNetwork} data-tip="Параметры сети"><span className="vh">Параметры сети: </span>{net}</button>
          <span className="grow" />
          <span className={'save-indicator' + (saveStatus === 'error' || saveStatus === 'conflict' ? ' bad' : '')} aria-live="polite"><IconTick wait={saveStatus === 'saving'} />{SAVE[saveStatus]}</span>
          <button type="button" className="ab-ib ab-theme" aria-label={dark ? 'Светлая тема' : 'Тёмная тема'} data-tip="Сменить тему" onClick={() => setTheme(dark ? 'light' : 'dark')}>{dark ? <IconSun /> : <IconMoon />}</button>
          <MenuButton
            className="ab-ib ab-gear"
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
