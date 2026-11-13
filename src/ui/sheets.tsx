import type { JSX } from 'react';
import { Suspense, useEffect, useRef, useState } from 'react';
import type { Calc, Project } from '../core/types';
import type { TplKey } from '../core/templates';
import { TPL_LIST, TPL_NAME, contentFor } from '../core/templates';
import { MAX_PROJECTS, cfgErr, fieldErr } from '../core/limits';
import { cfgN } from '../core/calc';
import { BOX_NAME, IN_CABLE } from '../core/norms';
import { dfmt, fmt, fs, plural } from '../core/format';
import { STATUS } from '../core/norms';
import { buildSpec } from '../core/spec';
import { cableName, protName } from '../core/protection';
import { reportText } from '../core/report';
import { buildXlsx, exportName, exportTables, toCsv } from '../core/export';
import { download, exportBackup } from './download';
import { IconChev, IconDownload, IconWire } from './Icons';
import { normProject, slug } from '../core/project';
import type { Action } from '../store/reducer';
import { Assumptions } from './Assumptions';
import { ArmButton, DoneFoot, Err, Seg, errAttrs, Sheet, Stepper, TabPanel, Tabs, Tip } from './common';
import { Schematic } from './Schematic';
import { toast, toastBad, toastOk } from './toast';
import { IOS_STEPS, install, usePwa } from './pwa';
import { PWA_ENABLED } from '../core/flags';
import { ShareBlock } from './ShareBlock';
import { LaborTable, Totals, totals } from './Labor';
import { PowerFitBlock } from './PowerFit';
import { TierSettings } from './Tiers';
import { useLib } from '../store/LibContext';
import { estimate } from '../core/spec';
import { DrawingA3 } from './parts';
import type { PrintMode } from './WorkSheet';
import { Button, DataTable, Field, MoneyInput } from './kit';
import { APP_VERSION, NORMS_EDITION } from '../core/version';
import { MAX_IMPORT_BYTES, lastBackup, restorePhotos, validateBackup } from '../store/backup';
import { isEvLine } from '../core/ev';

export function NetSheet({
  open, onClose, p, dispatch, onOld, oldLabel
}: {
  open: boolean;
  onClose: () => void;
  p: Project;
  dispatch: (a: Action) => void;
  onOld: () => void;
  oldLabel: string;
}) {
  const c = cfgN(p.cfg);
  return (
    <Sheet open={open} onClose={onClose} title="Параметры сети" tourId="network" kind="panel" sub={p.name || 'Без названия'} footer={<DoneFoot onDone={onClose} status="Расчёт обновляется сразу" />}>
      <div className="f" data-tour="object">
        <span className="lbl-row"><span className="lbl" id="l-obj">Объект</span><Tip label="О режиме частного дома">Частный дом: ввод СИП от опоры, разделение PEN на вводе, повторное заземление, УЗИП тип 1+2 и уличные группы.</Tip></span>
        <Seg<string> name="obj" labelledBy="l-obj" value={c.house ? 'house' : 'flat'} items={[['flat', 'Квартира'], ['house', 'Частный дом']]} onChange={v => dispatch({ t: 'cfg', field: 'obj', value: v === 'house' ? 'house' : '' })} />
      </div>
      {c.house && (
        <div className="set-grid">
          <div className="f">
            <span className="lbl-row"><span className="lbl">Ввод СИП от опоры, м</span><Tip label="О вводе СИП">Длина ответвления от опоры ВЛ до дома. По ней и току ввода подбирается сечение СИП-4 с потерей не больше 2 %.</Tip></span>
            <Stepper value={p.cfg.sip ?? ''} d={5} min={0} max={500} step={1} label="Длина ввода СИП от опоры, м" onChange={v => dispatch({ t: 'cfg', field: 'sip', value: v })} onStep={d => dispatch({ t: 'cfgStep', field: 'sip', d })} err={cfgErr('sip', p.cfg.sip ?? '')} errId="e-cfg-sip" />
            <Err e={cfgErr('sip', p.cfg.sip ?? '')} id="e-cfg-sip" />
          </div>
          <div className="f">
            <span className="lbl-row"><span className="lbl">Повторное заземление, Ом</span><Tip label="О повторном заземлении">Замер сопротивления контура на вводе. Норма не больше 30 Ом. Пусто, пока замера нет.</Tip></span>
            <Stepper value={p.cfg.rz ?? ''} d={1} min={0} max={500} step={0.5} label="Сопротивление повторного заземления, Ом" onChange={v => dispatch({ t: 'cfg', field: 'rz', value: v })} onStep={d => dispatch({ t: 'cfgStep', field: 'rz', d })} err={cfgErr('rz', p.cfg.rz ?? '')} errId="e-cfg-rz" />
            <Err e={cfgErr('rz', p.cfg.rz ?? '')} id="e-cfg-rz" />
          </div>
        </div>
      )}
      <div className="f">
        <span className="lbl" id="l-sup">Питание</span>
        <Seg<number> name="sup" labelledBy="l-sup" value={c.supply} items={[[1, '1 фаза · 230 В'], [3, '3 фазы · 400 В']]} onChange={v => dispatch({ t: 'cfg', field: 'supply', value: v })} />
      </div>
      <div className="f" data-tour="alloc">
        <span className="lbl-row"><span className="lbl">Выделенная мощность, кВт</span><Tip label="О выделенной мощности">{'Из технических условий на ' + (c.house ? 'дом' : 'квартиру') + '. С ней сравнивается расчётная мощность в табло вверху.'}</Tip></span>
        <Stepper value={p.cfg.alloc} d={1} min={1} step={0.5} label="Выделенная мощность, кВт" onChange={v => dispatch({ t: 'cfg', field: 'alloc', value: v })} onStep={d => dispatch({ t: 'cfgStep', field: 'alloc', d })} err={cfgErr('alloc', p.cfg.alloc)} errId="e-cfg-alloc" />
        <Err e={cfgErr('alloc', p.cfg.alloc)} id="e-cfg-alloc" />
      </div>
      <PowerFitBlock p={p} dispatch={dispatch} />
      <div className="f">
        <span className="lbl-row"><span className="lbl" id="l-met">Прокладка кабеля</span><Tip label="О прокладке">Скрытая: кабель в трубе в стене или кладке (способы 2 и 5A, табл. 52Н ГОСТ 30331.15). Открытая: в коробе или по поверхности (способы 4A и 11).</Tip></span>
        <Seg<string> name="met" labelledBy="l-met" value={c.method} items={[['wall', 'Скрытая'], ['open', 'Открытая']]} onChange={v => dispatch({ t: 'cfg', field: 'method', value: v })} />
      </div>
      <div className="f">
        <span className="lbl-row"><span className="lbl" id="l-prot">Защита групп</span></span>
        <Seg<string> name="prot" labelledBy="l-prot" value={c.rcdMode ? 'rcd' : 'rcbo'} items={[['rcbo', 'Дифавтомат на группу'], ['rcd', 'УЗО на помещение + автоматы']]} onChange={v => dispatch({ t: 'cfg', field: 'prot', value: v })} />
        <small className="muted">{c.rcdMode ? 'Одно УЗО на помещение, за ним автоматы, у каждого УЗО своя шина N. Помещение указывается в карточке группы.' : 'При утечке отключится только одна группа, но щиток получится шире.'}</small>
      </div>
      <div className="f">
        <span className="lbl-row"><span className="lbl" id="l-afdd">УЗДП, защита от дугового пробоя</span><Tip label="Об УЗДП">Отключает линию при искрении в плохом контакте или повреждённом кабеле, которое автомат и УЗО не видят. Нормы РБ для квартир его не требуют: ставится по желанию, чаще на розетки спален и детских. Только для однофазных групп.</Tip></span>
        <Seg<string> name="afdd" labelledBy="l-afdd" value={c.afdd} items={[['off', 'Нет'], ['sock', 'На розетки'], ['all', 'На все группы']]} onChange={v => dispatch({ t: 'cfg', field: 'afdd', value: v })} />
      </div>
      <fieldset className="net-opts">
        <legend className="lbl">Защита всего щитка</legend>
        <label>
          <input type="checkbox" checked={c.vr} onChange={e => dispatch({ t: 'cfg', field: 'vr', value: e.target.checked ? 'on' : '' })} />
          <span><b>Реле контроля напряжения</b><small>{c.house ? 'Отключит дом при скачке напряжения или обрыве нуля на линии' : 'Отключит квартиру при скачке напряжения или обрыве нуля в подъезде'}</small></span>
        </label>
        <label>
          <input type="checkbox" checked={c.spd} onChange={e => dispatch({ t: 'cfg', field: 'spd', value: e.target.checked ? 'on' : '' })} />
          <span><b>{c.house ? 'УЗИП тип 1+2' : 'УЗИП тип 2'}</b><small>{c.house ? 'Воздушный ввод: защита от грозовых импульсов с линии и перенапряжений в сети' : 'Защита техники от импульсных перенапряжений при грозе и переключениях в сети'}</small></span>
        </label>
      </fieldset>
      <details className="bd-help net-more">
        <summary>Для точного расчёта<small>{[IN_CABLE[c.inCable]].concat(c.grpCable !== 'vvg' ? ['группы ' + IN_CABLE[c.grpCable]] : []).concat([c.boxAuto ? 'коробки по прокладке' : 'коробки ' + BOX_NAME[c.box], 'петля сети ' + fmt(c.zs, 2) + ' Ом', 'одновременность ' + fs(c.ko), 'поправка на группировку ' + fs(c.k), c.safe ? 'сечение с запасом' : 'сечение по норме']).concat(c.margin > 1 ? ['запас по автомату ' + fs(c.margin)] : []).concat(c.feeder > 0 ? ['потеря до щитка ' + fs(c.feeder) + ' %'] : []).join(' · ')}</small></summary>
        <div className="net-more-b">
          <div className="f">
            <span className="lbl-row"><span className="lbl" id="l-inc">Кабель ввода</span><Tip label="О кабеле ввода">{c.house ? 'Марка кабеля от ВРУ или ящика учёта до щитка дома. Сечение подбирается расчётом.' : 'Марка кабеля от этажного щита до щитка квартиры. Сечение подбирается расчётом.'}</Tip></span>
            <Seg<string> name="inc" labelledBy="l-inc" value={c.inCable} items={(Object.keys(IN_CABLE) as (keyof typeof IN_CABLE)[]).map(k => [k, IN_CABLE[k]])} onChange={v => dispatch({ t: 'cfg', field: 'inCable', value: v })} />
          </div>
          <div className="f">
            <span className="lbl-row"><span className="lbl" id="l-gc">Кабель групп</span><Tip label="О кабеле групп">Марка кабеля от щитка до приборов. Попадает в схему, спецификацию, смету и закупку.</Tip></span>
            <Seg<string> name="gc" labelledBy="l-gc" value={c.grpCable} items={(Object.keys(IN_CABLE) as (keyof typeof IN_CABLE)[]).map(k => [k, IN_CABLE[k]])} onChange={v => dispatch({ t: 'cfg', field: 'grpCable', value: v })} />
          </div>
          <div className="f">
            <span className="lbl-row"><span className="lbl" id="l-box">Распределительные коробки</span><Tip label="О коробках">Для скрытой проводки в бетон и кирпич берут коробки под штукатурку, в гипсокартон с прижимными лапками, для открытой проводки и мокрых зон накладные IP54.</Tip></span>
            <Seg<string> name="box" labelledBy="l-box" value={c.boxAuto ? 'auto' : c.box} items={[['auto', 'Подобрать'], ['brick', 'Бетон, кирпич'], ['gkl', 'Гипсокартон'], ['surface', 'Накладные IP54']]} onChange={v => dispatch({ t: 'cfg', field: 'box', value: v })} />
            {c.boxAuto && <small>Подобрано по прокладке: коробка {BOX_NAME[c.box]}.</small>}
          </div>
          <div className="f">
            <span className="lbl-row"><span className="lbl" id="l-mins">Наименьшее сечение жилы</span><Tip label="О наименьшем сечении">Меньше этого сечения расчёт не возьмёт. По норме: от 1,5 мм² (ГОСТ 30331.15-2001, табл. 52J). С запасом: розетки и мощные приборы от 2,5 мм².</Tip></span>
            <Seg<string> name="mins" labelledBy="l-mins" value={c.safe ? 'safe' : 'norm'} items={[['safe', 'С запасом'], ['norm', 'По норме']]} onChange={v => dispatch({ t: 'cfg', field: 'minS', value: v })} />
          </div>
          <div className="set-grid">
            <div className="f">
              <span className="lbl-row"><span className="lbl">Петля фаза-нуль сети, Ом</span><Tip label="О петле фаза-нуль">{'Сопротивление петли до щитка ' + (c.house ? 'дома' : 'квартиры') + '. Значение по умолчанию ориентировочное: замерьте на вводе или уточните у энергоснабжающей организации. Нужно, чтобы проверить отключение короткого замыкания.'}</Tip></span>
              <Stepper value={p.cfg.zs} d={0.05} min={0.05} max={2} step={0.05} label="Сопротивление петли фаза-нуль питающей сети, Ом" onChange={v => dispatch({ t: 'cfg', field: 'zs', value: v })} onStep={d => dispatch({ t: 'cfgStep', field: 'zs', d })} err={cfgErr('zs', p.cfg.zs)} errId="e-cfg-zs" />
              <Err e={cfgErr('zs', p.cfg.zs)} id="e-cfg-zs" />
            </div>
            <div className="f">
              <span className="lbl-row"><span className="lbl">Потеря до щитка, %</span><Tip label="О потере напряжения до щитка">{'Сколько напряжения теряется от ВРУ до щитка ' + (c.house ? 'дома' : 'квартиры') + '. Вычитается из допуска групп: 3 % для освещения, 5 % для остального (СН 4.04.01-2019, п. 9.14). Не знаете, оставьте 0.'}</Tip></span>
              <Stepper value={p.cfg.feeder} d={0.1} min={0} max={3} step={0.1} label={'Потеря напряжения от ВРУ до щитка ' + (c.house ? 'дома' : 'квартиры') + ', %'} onChange={v => dispatch({ t: 'cfg', field: 'feeder', value: v })} onStep={d => dispatch({ t: 'cfgStep', field: 'feeder', d })} err={cfgErr('feeder', p.cfg.feeder)} errId="e-cfg-feeder" />
              <Err e={cfgErr('feeder', p.cfg.feeder)} id="e-cfg-feeder" />
            </div>
            <div className="f">
              <span className="lbl-row"><span className="lbl">Одновременность, Ко</span><Tip label="О коэффициенте одновременности">Какая часть установленной мощности работает одновременно. Влияет на ввод (ток, автомат, кабель) и оценку утечки на УЗО. Автоматы групп не меняет.</Tip></span>
              <Stepper value={p.cfg.ko} d={0.05} min={0.3} max={1} step={0.05} label="Коэффициент одновременности" onChange={v => dispatch({ t: 'cfg', field: 'ko', value: v })} onStep={d => dispatch({ t: 'cfgStep', field: 'ko', d })} err={cfgErr('ko', p.cfg.ko)} errId="e-cfg-ko" />
              <Err e={cfgErr('ko', p.cfg.ko)} id="e-cfg-ko" />
            </div>
            <div className="f">
              <span className="lbl-row"><span className="lbl">Запас по автомату</span><Tip label="О запасе по автомату">Во сколько раз номинал автомата больше тока группы. 1 без запаса. В плотном щитке автоматы греют друг друга и отключаются раньше номинала, обычно берут 1,1–1,25.</Tip></span>
              <Stepper value={p.cfg.margin ?? 1} d={0.05} min={1} max={1.5} step={0.05} label="Запас по номиналу группового автомата" onChange={v => dispatch({ t: 'cfg', field: 'margin', value: v })} onStep={d => dispatch({ t: 'cfgStep', field: 'margin', d })} err={cfgErr('margin', p.cfg.margin ?? 1)} errId="e-cfg-margin" />
              <Err e={cfgErr('margin', p.cfg.margin ?? 1)} id="e-cfg-margin" />
            </div>
            <div className="f">
              <span className="lbl-row"><span className="lbl">Поправка на группировку</span><Tip label="О поправке на группировку">Одиночный кабель: 1. Если в одной штробе или лотке идут несколько кабелей, они хуже остывают, и допустимый ток кабеля снижается на этот коэффициент.</Tip></span>
              <Stepper value={p.cfg.k} d={0.05} min={0.5} max={1} step={0.05} label="Поправка на группировку кабелей" onChange={v => dispatch({ t: 'cfg', field: 'k', value: v })} onStep={d => dispatch({ t: 'cfgStep', field: 'k', d })} err={cfgErr('k', p.cfg.k)} errId="e-cfg-k" />
              <Err e={cfgErr('k', p.cfg.k)} id="e-cfg-k" />
            </div>
          </div>
        </div>
      </details>
      <button className="netfold net-old" type="button" onClick={onOld}>
        <IconWire />
        <span className="nf-main">Старая проводка<small>{oldLabel || 'алюминий, нет PE, старый щиток: что оставить и что заменить'}</small></span>
        <IconChev className="chev" />
      </button>
    </Sheet>
  );
}

export function ProjectsSheet({
  open, onClose, state, p, dispatch, onLib, onBlank, onSample
}: {
  open: boolean;
  onClose: () => void;
  state: { list: Project[]; cur: string };
  p: Project;
  dispatch: (a: Action) => void;
  onLib: () => void;
  onBlank: () => void;
  onSample: () => void;
}) {
  const { lib, dispatch: libDispatch } = useLib();
  const [tplOpen, setTplOpen] = useState(false);
  const [tab, setTab] = useState('main');
  const [elec, setElec] = useState(true);
  const file = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [last, setLast] = useState(lastBackup);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTplOpen(false);
      setLast(lastBackup());
    }
  }
  const note = (t: string, bad = false) => (bad ? toastBad(t) : toastOk(t));
  const create = (k: TplKey) => {
    const nm = k === 'blank' ? 'Проект ' + (state.list.length + 1) : TPL_NAME[k];
    dispatch({ t: 'addProject', content: contentFor(k, elec), name: nm });
    setTplOpen(false);
    note('Создан проект: ' + nm);
    window.setTimeout(() => {
      nameRef.current?.focus();
      nameRef.current?.select();
    }, 0);
  };
  const exportFile = () => {
    try {
      const text = JSON.stringify({ app: 'ampli', version: 1, appVersion: APP_VERSION, norms: NORMS_EDITION, ...p }, null, 2);
      const u = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = u;
      a.download = 'ampli-' + slug(p.name) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(u), 2000);
      note('Файл сохранён');
    } catch (e) {
      void e;
      note('Не удалось сохранить файл на этом устройстве', true);
    }
  };
  const importText = async (text: string) => {
    if (new Blob([text]).size > MAX_IMPORT_BYTES) {
      note('Файл больше 32 МБ. Импорт отменён', true);
      return;
    }
    let o: unknown;
    try {
      o = JSON.parse(text);
    } catch (e) {
      void e;
      note('Файл не похож на проект Ampli', true);
      return;
    }
    const list = (o as { list?: unknown }).list;
    const restore = (o as { kind?: unknown } | null)?.kind === 'backup';
    if (restore) {
      try { validateBackup(o); } catch {
        note('Резервная копия повреждена или создана несовместимой версией', true);
        return;
      }
    }
    const arr: unknown[] = (Array.isArray(o) ? o : (Array.isArray(list) ? list : [o])).slice(0, MAX_PROJECTS);
    const parsed = arr.map(x => { try { return normProject(x, restore); } catch (e) { void e; return null; } }).filter((x): x is Project => !!x);
    const have = new Set(state.list.map(x => x.id));
    const added = restore ? parsed.filter(x => !have.has(x.id)) : parsed;
    if (!parsed.length) {
      note('В файле нет проекта Ampli', true);
      return;
    }
    if (!added.length) {
      note('Все проекты из копии уже есть на этом устройстве');
      return;
    }
    try {
      if (restore) await restorePhotos(o);
    } catch (e) {
      void e;
      note('Фотографии из архива не удалось восстановить. Проекты не добавлены', true);
      return;
    }
    dispatch({ t: 'importProjects', projects: added });
    note((restore ? 'Восстановлено проектов: ' : 'Добавлено проектов: ') + added.length);
  };
  const n = state.list.length;
  return (
    <Sheet open={open} onClose={onClose} title="Проекты" tourId="projects" kind="panel" side="left" footer={(
      <>
        <span className="foot-st">{n} {plural(n, ['проект', 'проекта', 'проектов'])} на этом устройстве</span>
        <Button variant="primary" aria-expanded={tplOpen} aria-controls="tpl" onClick={() => { setTab('main'); setTplOpen(!tplOpen); if (!tplOpen) setTimeout(() => document.getElementById('tpl')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }), 0); }}>+ Новый проект</Button>
      </>
    )} bar={<Tabs scope="pj" label="Разделы окна проектов" cur={tab} onChange={setTab} items={[{ id: 'main', label: 'Проекты' }, { id: 'share', label: 'Обмен и данные' }]} />} tip="Проекты хранятся только в этом браузере. Чтобы перенести проект на другое устройство, сохраните его в файл или отправьте ссылкой.">
      <TabPanel scope="pj" id="main" cur={tab}>
      <div className="sec-row">
        <h3 className="sec-t">Все проекты</h3>
        <span className="muted">{n} {plural(n, ['проект', 'проекта', 'проектов'])}</span>
      </div>
      <div className="pj-list">
        {state.list.map(x => {
          const cur = x.id === state.cur;
          return (
            <div className={'pj' + (cur ? ' cur' : '')} key={x.id}>
              <button className="pj-open" type="button" aria-current={cur ? 'true' : undefined} onClick={() => { dispatch({ t: 'openProject', id: x.id }); onClose(); }}>
                <span className="pj-name">{x.name || 'Без названия'}</span>
                <span className="pj-sub">{cur ? 'Открыт · ' : ''}{x.lines.length} {plural(x.lines.length, ['группа', 'группы', 'групп'])} · {dfmt(x.updated)}</span>
              </button>
              <Button onClick={() => { dispatch({ t: 'dupProject', id: x.id }); note('Копия создана'); }}>Копировать</Button>
              <ArmButton variant="danger" label="Удалить" armedLabel="Точно удалить?" onRun={() => { dispatch({ t: 'delProject', id: x.id }); toastOk('Проект удалён: ' + (x.name || 'Без названия')); }} />
            </div>
          );
        })}
      </div>
      <div className="tpl" id="tpl" hidden={!tplOpen}>
        <span className="lbl" id="l-stove">Плита</span>
        <Seg<string> name="stove" labelledBy="l-stove" value={elec ? 'elec' : 'gas'} items={[['elec', 'Электрическая'], ['gas', 'Газовая']]} onChange={v => setElec(v === 'elec')} />
        <span className="lbl">С чего начать</span>
        <div className="tpl-grid">
          {TPL_LIST.map(t => (
            <button key={t.key} className="tpl-b" type="button" onClick={() => create(t.key)}>
              <b>{t.title}</b>
              <span>{t.sub}</span>
            </button>
          ))}
        </div>
        {lib.templates.length > 0 && (
          <>
            <span className="lbl">Мои шаблоны</span>
            <div className="tpl-grid">
              {lib.templates.map(t => (
                <button key={t.id} className="tpl-b" type="button" onClick={() => {
                  dispatch({ t: 'addProject', content: { sample: false, cfg: t.cfg, lines: t.lines, floor: t.floor, weak: t.weak }, name: t.name });
                  setTplOpen(false);
                  note('Создан проект: ' + t.name);
                }}>
                  <b>{t.name}</b>
                  <span>{t.lines.length} {plural(t.lines.length, ['группа', 'группы', 'групп'])}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <h3 className="sec-t">Текущий проект</h3>
      <div className="meta-grid">
        <Field id="mName" label="Название" wide><input id="mName" ref={nameRef} type="text" autoComplete="off" maxLength={80} value={p.name} onChange={e => dispatch({ t: 'meta', field: 'name', value: e.target.value })} /></Field>
        <Field id="mAddr" label="Объект, адрес" wide><input id="mAddr" type="text" autoComplete="off" maxLength={120} value={p.address} onChange={e => dispatch({ t: 'meta', field: 'address', value: e.target.value })} /></Field>
        <Field id="mClient" label="Заказчик"><input id="mClient" type="text" autoComplete="off" maxLength={80} value={p.client} onChange={e => dispatch({ t: 'meta', field: 'client', value: e.target.value })} /></Field>
        <Field id="mAuthor" label="Исполнитель"><input id="mAuthor" type="text" autoComplete="off" maxLength={80} value={p.author} onChange={e => dispatch({ t: 'meta', field: 'author', value: e.target.value })} /></Field>
      </div>
      <div className="data-row pj-reset">
        <span className="muted">Заменить группы текущего проекта:</span>
        <ArmButton variant="ghost" size="sm" label="Загрузить пример" onRun={() => { onSample(); onClose(); }} />
        <ArmButton variant="ghost" size="sm" label="Начать с нуля" onRun={() => { onBlank(); onClose(); }} />
      </div>
      </TabPanel>
      <TabPanel scope="pj" id="share" cur={tab}>
      <h3 className="sec-t">Перенести на другое устройство</h3>
      <p className="muted">Ссылка открывает этот проект на другом телефоне или компьютере. Файл подходит для архива и отправки почтой.</p>
      <ShareBlock p={p} />
      <div className="data-row">
        <Button variant="ghost" onClick={exportFile}>Сохранить в файл</Button>
        <Button variant="ghost" onClick={() => file.current?.click()}>Открыть из файла</Button>
        <input
          className="pj-file"
          ref={file}
          type="file"
          accept=".json,application/json"
          tabIndex={-1}
          aria-hidden="true"
          onChange={e => {
            const f = e.target.files && e.target.files[0];
            const input = e.target;
            if (!f) return;
            if (f.size > MAX_IMPORT_BYTES) {
              note('Файл больше 32 МБ. Импорт отменён', true);
              input.value = '';
              return;
            }
            const rd = new FileReader();
            rd.onload = () => {
              void importText(String(rd.result));
              input.value = '';
            };
            rd.onerror = () => note('Не удалось прочитать файл', true);
            rd.readAsText(f);
          }}
        />
      </div>
      <h3 className="sec-t">Резервная копия</h3>
      <p className="muted">Все проекты в одном файле. Сохраняйте его раз в неделю: если браузер очистит данные или телефон сломается, проекты можно вернуть кнопкой «Открыть из файла». {last ? 'Последняя копия: ' + dfmt(last) + '.' : 'Копия ещё не сохранялась.'}</p>
      <div className="data-row">
        <Button variant="ghost" onClick={() => { void exportBackup(state.list).then(ok => {
          if (ok) {
            setLast(lastBackup());
            note('Резервная копия подготовлена');
          } else note('Не удалось сохранить файл на этом устройстве', true);
        }); }}>Сохранить резервную копию</Button>
      </div>
      <h3 className="sec-t">Шаблон</h3>
      <p className="muted">Группы и параметры этого проекта станут заготовкой для новых проектов.</p>
      <div className="data-row">
        <Button variant="ghost" onClick={() => { libDispatch({ t: 'addTpl', name: p.name || 'Мой шаблон', cfg: p.cfg, lines: p.lines, floor: p.floor, weak: p.weak }); note('Шаблон сохранён: ' + (p.name || 'Мой шаблон')); }}>Сохранить как шаблон</Button>
      </div>
      <h3 className="sec-t">Мои данные</h3>
      <p className="muted">Реквизиты для отчёта, шаблоны и цены.</p>
      <div className="data-row">
        <Button variant="ghost" onClick={onLib}>Открыть мои данные</Button>
      </div>
      <InstallBlock />
      </TabPanel>
    </Sheet>
  );
}

export function ReportSheet({
  open, onClose, p, a, onPrint, onShop, dispatch, tab: tabIn, onTab
}: {
  open: boolean;
  onClose: () => void;
  p: Project;
  a: Calc;
  dispatch: (x: Action) => void;
  tab?: string;
  onPrint: (m: PrintMode) => void;
  onShop: () => void;
  onTab?: (tab: string) => void;
}) {
  const [fallback, setFallback] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (fallback !== null && ta.current) {
      ta.current.focus();
      ta.current.select();
    }
  }, [fallback]);
  const copy = async () => {
    const txt = reportText(p, a, lib.prices);
    try {
      await navigator.clipboard.writeText(txt);
      setFallback(null);
      toastOk('Отчёт скопирован');
    } catch (e) {
      void e;
      setFallback(txt);
      toast('Текст выделен, скопируйте его вручную');
    }
  };
  const saveFile = (kind: 'xlsx' | 'csv') => {
    const tables = exportTables(a, lib.prices, lib.labor, p.work);
    if (kind === 'xlsx') download(exportName(p.name, 'xlsx'), buildXlsx(tables), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    else download(exportName(p.name, 'csv'), toCsv(...tables), 'text/csv;charset=utf-8');
    toastOk(kind === 'xlsx' ? 'Файл Excel сохранён' : 'Файл CSV сохранён');
  };
  const three = a.c.supply === 3;
  const { lib, dispatch: libDispatch } = useLib();
  const est = estimate(buildSpec(a), lib.prices);
  const empty = !a.rows.some(x => x.r.In);
  const [ownTab, setOwnTab] = useState(tabIn ?? 'groups');
  const tab = tabIn ?? ownTab;
  const setTab = (t: string) => {
    setOwnTab(t);
    onTab?.(t);
  };
  return (
    <Sheet open={open} onClose={onClose} title="Отчёт и спецификация" tourId="report" sub={p.name || 'Без названия'} footer={tab === 'scheme' ? (
      <>
        <span className="foot-st">Лист А3 по ГОСТ 21.613</span>
        <Button variant="primary" disabled={empty} onClick={() => onPrint('a3')}>Печать А3 по ГОСТ</Button>
      </>
    ) : (
      <>
        <span className="foot-st">{empty ? 'Добавьте группу с приборами, чтобы напечатать отчёт' : ''}</span>
        <Button disabled={empty} onClick={copy}>Скопировать отчёт</Button>
        <Button variant="primary" disabled={empty} onClick={() => onPrint('report')}>Печать / PDF</Button>
      </>
    )} bar={<Tabs scope="rep" label="Разделы отчёта" cur={tab} onChange={setTab} items={[{ id: 'groups', label: 'Группы' }, { id: 'scheme', label: 'Схема' }, { id: 'estimate', label: 'Смета' }, { id: 'notes', label: 'Основания' }]} />}>
      {fallback !== null && <textarea ref={ta} readOnly value={fallback} aria-label="Текст отчёта" />}
      <TabPanel scope="rep" id="groups" cur={tab} lazy>
      {empty && <div className="empty rep-empty">В проекте пока нет групп с приборами. Добавьте группу, и здесь появятся таблица, схема и смета.</div>}
      <h3 className="sec-t">Группы линий</h3>
      <DataTable label="Таблица групп" className="gtab" head={<><th>Гр.</th><th>Название</th>{three && <th>Фаза</th>}<th className="num">Установл., Вт</th><th className="num">Ток, А</th><th>Защита</th><th>Кабель</th><th className="num" title="Потеря напряжения">Потеря U, %</th><th>Статус</th></>} foot={(
        <tr>
          <td className="c-t" colSpan={three ? 3 : 2}>Всего</td>
          <td className="num c-m" data-k="Установлено">{fmt(a.sumInst, 0)}<span className="dt-u"> Вт</span></td>
          <td className="num c-m" data-k="Ток">{fmt(a.Itot, 1)}<span className="dt-u"> А</span></td>
          <td colSpan={4} className="c-v">Расчётная мощность {fmt(a.P / 1000, 1)} кВт</td>
        </tr>
      )}>
        {a.rows.map((x, i) => {
          const r = x.r;
          const head = (
            <>
              <td className="mono c-k">Г{i + 1}</td>
              <td className="c-t">{x.l.name}</td>
              {three && <td className="mono c-m" data-k="Фаза">{r.three ? '3Ф' : (x.l.phase === '3' ? '3Ф' : x.l.phase)}</td>}
            </>
          );
          if (r.empty) {
            return (
              <tr key={x.l.id}>
                {head}
                <td className="num c-x">0</td>
                <td className="num c-x">—</td>
                <td colSpan={4} className="muted c-m">нет приборов</td>
              </tr>
            );
          }
          return (
            <tr key={x.l.id}>
              {head}
              <td className="num c-m">{fmt(r.pInst, 0)}<span className="dt-u"> Вт</span></td>
              <td className="num c-m">{fmt(r.I, 1)}<span className="dt-u"> А</span></td>
              <td className="mono c-v">{r.In ? protName(r) : '—'}</td>
              <td className="mono c-m">{r.In ? cableName(r) : '—'}</td>
              <td className="num c-m" data-k="ΔU">{r.In ? fmt(r.drop, 1) : '—'}<span className="dt-u"> %</span></td>
              <td className="c-s">{r.status === 'ok' ? <span className="st-ok">{STATUS.ok}</span> : <span className={'pill ' + r.status}>{STATUS[r.status]}</span>}</td>
            </tr>
          );
        })}
      </DataTable>
      </TabPanel>
      <TabPanel scope="rep" id="scheme" cur={tab} lazy>
      <h3 className="sec-t">Схема щитка</h3>
      <p className="muted schem-hint">Схема шире экрана: листайте её вбок или поверните телефон. Для печати есть лист А3 в подвале.</p>
      <div className="schem-wrap" role="region" aria-label="Однолинейная схема, прокручивается" tabIndex={0}><Schematic a={a} /></div>
      <details className="bd-help a3-prev">
        <summary>Лист А3 со штампом</summary>
        <p className="muted">Принципиальная схема распределительной сети по ГОСТ 21.613 с таблицей групп и основной надписью. Реквизиты организации берутся из «Мои данные», разработчик из карточки проекта.</p>
        <div className="a3-wrap"><Suspense fallback={null}><DrawingA3 p={p} a={a} company={lib.brand.company} /></Suspense></div>
      </details>
      </TabPanel>
      <TabPanel scope="rep" id="estimate" cur={tab} lazy>
      <div className="copy-row">
        <Button onClick={() => saveFile('xlsx')} data-tip="Смета и группы в Excel"><IconDownload /> Excel</Button>
        <Button onClick={() => saveFile('csv')} data-tip="Смета в CSV"><IconDownload /> CSV</Button>
        <Button onClick={onShop}>Где купить</Button>
      </div>
      {est.rows.length > 0 && est.rows.every(r => r.sum === null) && (
        <div className="sample est-hint">
          Цены пока не заданы, поэтому материалы в итоге не посчитаны. Впишите цену в строке позиции, она запомнится для следующих смет, или{' '}
          <button className="link" type="button" onClick={onShop}>загрузите прайс магазина</button>.
        </div>
      )}
      <h3 className="sec-t">Спецификация</h3>
      <DataTable label="Спецификация" className="spec-t" head={<><th>Позиция</th><th className="num">Количество</th><th className="num">Цена</th><th className="num">Сумма, BYN</th></>} foot={(
        <tr>
          <td className="c-t" colSpan={3}>Материалы</td>
          <td className={'num c-v' + (est.total > 0 ? '' : ' muted')}>{est.total > 0 ? fmt(est.total, 2) + ' BYN' : 'цены не заданы'}</td>
        </tr>
      )}>
        {est.rows.map(({ item, sum }, i) => (
          <tr key={i}>
            <td className="c-t">{item.name}{item.note && <small className="dt-note">{item.note}</small>}</td>
            <td className="num c-m">{item.qty}</td>
            <td className="num c-v">
              <MoneyInput placeholder="0,00" aria-label={'Цена: ' + item.name} {...errAttrs(fieldErr('price', lib.prices[item.name]), 'e-pr-' + i)} value={lib.prices[item.name] ?? ''} onChange={e => libDispatch({ t: 'price', name: item.name, value: e.target.value })} />
              <Err e={fieldErr('price', lib.prices[item.name])} id={'e-pr-' + i} />
            </td>
            <td className={'num c-m' + (sum === null ? ' dt-nil' : '')} data-k="Сумма">{sum === null ? '—' : fmt(sum, 2)}</td>
          </tr>
        ))}
      </DataTable>
      {est.missing > 0 && Object.keys(lib.prices).length > 0 && <p className="muted">Для {est.missing} поз. цена или количество не заданы, они не входят в итог.</p>}
      <LaborTable p={p} a={a} dispatch={dispatch} />
      <Totals {...totals(a, p, lib.prices, lib.labor)} />
      <TierSettings p={p} dispatch={dispatch} />
      <ShareBlock p={p} kind="estimate" />
      </TabPanel>
      <TabPanel scope="rep" id="notes" cur={tab} lazy>
      <h3 className="sec-t">Допущения и источники</h3>
      <Assumptions cfg={cfgN(p.cfg)} ev={p.lines.some(isEvLine)} />
      <div className="foot">
        <p>Допустимые токи медных жил взяты из таблицы 1.3.4 главы 1.3 ПУЭ, на которую ссылается ТКП 339-2022, и умножены на поправку; прокладка по ГОСТ 30331.15. Групповые сети выполняются медными жилами, наименьшее сечение жилы 1,5 мм² (ГОСТ 30331.15-2001, табл. 52J).</p>
        <p>УЗО до 30 мА предусмотрены для розеток и светильников (ТКП 339-2022 с изм. № 1, п. 4.3.18.5) и по практике для мощных приборов, при расчётном токе больше 32 А до 100 мА (СН 4.04.01-2019, п. 16.3.13). Время отключения УЗО в протоколе сравнивается с табл. 4.4.47 и 4.4.48 ТКП 339-2022 в редакции изм. № 1. Потеря напряжения: 3 % для освещения и 5 % для остальных групп, на линиях длиннее 100 м допуск растёт на 0,005 % за метр, но не более чем на 0,5 % (СН 4.04.01-2019, п. 9.14); сопротивление меди 0,0225 Ом·мм²/м. Коэффициенты спроса и одновременности приняты по практике, их сверка с таблицами СН 4.04.01-2019 не выполнена.</p>
        <p>Ввод: до 12 кВт расчётной нагрузки однофазный, больше 12 кВт трёхфазный (СН 4.04.01-2019, п. 9.12). Вводной автомат выбирается на две ступени выше наибольшего группового (п. 10.5). Отключение короткого замыкания проверяется при времени 0,4 с для 230 В (ТКП 339-2022, п. 4.3.5.4, табл. 4.3.1) по сопротивлению петли фаза-нуль питающей сети, которое задаёт пользователь; сопротивление жил считается без учёта индуктивности, расчёт по ГОСТ 28249 не выполнялся.</p>
        <p>ГОСТ 30331.15-2001, п. 525 рекомендует потерю напряжения не более 4 % от номинального напряжения установки; в расчёте применяются пределы СН 4.04.01-2019, п. 9.14. Сечение нулевого проводника принято равным фазному до 16 мм² (п. 524.2). Допустимые токи самого ГОСТ 30331.15 не содержит (п. 523 отсылает к другому стандарту), поэтому значения взяты из ПУЭ и не сверены с таблицами МЭК 364-5-523.</p>
        <p>Длины кабеля в спецификации взяты из длин групп с запасом 10 %. Сам ввод, трассу в щиток и расход мелочи уточняйте по месту.</p>
        <p>Нормативная база: ТКП 339-2022 с изменением № 1 (действует с 01.08.2025); СН 4.04.01-2019 «Системы электрооборудования жилых и общественных зданий»; ПУЭ, табл. 1.3.3 и 1.3.4; ГОСТ 30331.15-2001. Изменение № 2 к СН 4.04.01-2019 (постановление Минстройархитектуры от 17.09.2026 № 75, действует с 07.12.2026) учтено: по п. 14.4 водонагреватели и приборы отопления питаются отдельной линией и подключаются без вилки и розетки; остальные пункты изменения касаются общественных зданий, электрощитовых и ссылок на другие нормы. ТКП 339-2022 остаётся основным документом по защитным мерам. Раздел 8 ТКП 339-2022 исключён изменением № 1, требования к жилым зданиям перенесены в СП 4.04.04-2023, сверка с ним не выполнена.</p>
        <p>Результат предварительный. Проект щитка и монтаж согласуйте с аттестованным электриком.</p>
      </div>
      </TabPanel>
    </Sheet>
  );
}

export function InstallBlock() {
  const s = usePwa();
  let body: JSX.Element | null = null;
  if (!PWA_ENABLED) return null;
  if (s.standalone) body = <p className="muted">Ampli установлен на это устройство и работает без интернета.</p>;
  else if (s.can) {
    body = (
      <div className="data-row">
        <Button onClick={() => { void install(); }}><IconDownload /> Установить приложение</Button>
        <Tip>Ampli откроется с экрана устройства как обычное приложение и будет работать без интернета. Проекты останутся на этом устройстве.</Tip>
      </div>
    );
  } else if (s.ios) body = <p className="muted">На iPhone и iPad Ampli можно добавить на экран «Домой», тогда он работает без интернета. {IOS_STEPS}</p>;
  if (!body) return null;
  return (
    <>
      <h3 className="sec-t">Приложение</h3>
      {body}
    </>
  );
}
