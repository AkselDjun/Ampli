import { useRef, useState } from 'react';
import { fmt, plural } from '../core/format';
import { useLib } from '../store/LibContext';
import { ArmButton, Sheet, TabPanel, Tabs, Tip } from './common';
import { scaleLogo } from './logo';
import { toastBad } from './toast';

export function LibSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lib, dispatch } = useLib();
  const file = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState('brand');
  const b = lib.brand;
  const nPrices = Object.keys(lib.prices).length;
  const tagName = { l: 'свет', s: 'розетки', p: 'мощный' } as const;
  return (
    <Sheet open={open} onClose={onClose} title="Мои данные" bar={<Tabs scope="lib" label="Разделы данных" cur={tab} onChange={setTab} items={[{ id: 'brand', label: 'Реквизиты' }, { id: 'apps', label: 'Приборы' }, { id: 'tpl', label: 'Шаблоны и цены' }]} />}>
      <TabPanel scope="lib" id="brand" cur={tab}>
      <h3 className="sec-t">Реквизиты для отчёта</h3>
      <div className="meta-grid">
        <div className="f wide"><label className="lbl" htmlFor="bCo">Организация или ФИО</label><input id="bCo" type="text" maxLength={80} autoComplete="off" value={b.company} onChange={e => dispatch({ t: 'brand', field: 'company', value: e.target.value })} /></div>
        <div className="f wide"><label className="lbl" htmlFor="bCt">Контакты</label><input id="bCt" type="text" maxLength={160} autoComplete="off" value={b.contacts} onChange={e => dispatch({ t: 'brand', field: 'contacts', value: e.target.value })} /></div>
        <div className="f wide"><label className="lbl" htmlFor="bSg">Подписант (ФИО, должность)</label><input id="bSg" type="text" maxLength={80} autoComplete="off" value={b.signer} onChange={e => dispatch({ t: 'brand', field: 'signer', value: e.target.value })} /></div>
      </div>
      <div className="logo-row">
        {b.logo ? <img className="logo-img" src={b.logo} alt="Логотип" /> : <span className="muted">Логотип не загружен</span>}
        <button className="btn" type="button" onClick={() => file.current?.click()}>{b.logo ? 'Заменить логотип' : 'Загрузить логотип'}</button>
        {b.logo && <button className="btn ghost" type="button" onClick={() => dispatch({ t: 'logo', value: '' })}>Убрать логотип</button>}
        <input
          ref={file}
          className="pj-file"
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden="true"
          onChange={e => {
            const f = e.target.files && e.target.files[0];
            const input = e.target;
            if (!f) return;
            scaleLogo(f).then(
              v => dispatch({ t: 'logo', value: v }),
              () => toastBad('Не удалось прочитать изображение. Подойдёт PNG, JPG или SVG.')
            );
            input.value = '';
          }}
        />
      </div>

      </TabPanel>
      <TabPanel scope="lib" id="apps" cur={tab}>
      <div className="sec-row">
        <h3 className="sec-t">Мои приборы</h3>
        <span className="muted">{lib.apps.length} {plural(lib.apps.length, ['прибор', 'прибора', 'приборов'])}</span>
      </div>
      {lib.apps.length === 0 && <p className="muted">Пока пусто. Здесь появятся приборы, которые вы сохраните из карточки группы кнопкой «Сохранить приборы группы в мои».</p>}
      <div className="lib-list">
        {lib.apps.map(a => (
          <div className="lib-r" key={a.id}>
            <span className="lib-n">{a.name}</span>
            <span className="muted">{fmt(a.w, 0)} Вт · {tagName[a.tag]}</span>
            <button className="icon-btn" type="button" aria-label={'Удалить прибор ' + a.name} onClick={() => dispatch({ t: 'delApp', id: a.id })}>×</button>
          </div>
        ))}
      </div>

      </TabPanel>
      <TabPanel scope="lib" id="tpl" cur={tab}>
      <div className="sec-row">
        <h3 className="sec-t">Мои шаблоны</h3>
        <span className="muted">{lib.templates.length} {plural(lib.templates.length, ['шаблон', 'шаблона', 'шаблонов'])}</span>
      </div>
      {lib.templates.length === 0 && <p className="muted">Пока пусто. Сохраните текущий проект как шаблон в окне «Проекты», вкладка «Обмен и данные».</p>}
      <div className="lib-list">
        {lib.templates.map(t => (
          <div className="lib-r" key={t.id}>
            <span className="lib-n">{t.name}</span>
            <span className="muted">{t.lines.length} {plural(t.lines.length, ['группа', 'группы', 'групп'])}</span>
            <ArmButton className="btn danger" label="Удалить" armedLabel="Точно?" onRun={() => dispatch({ t: 'delTpl', id: t.id })} />
          </div>
        ))}
      </div>

      <div className="sec-row">
        <h3 className="sec-t">Цены в смете<Tip>Цены вводятся в отчёте, на вкладке «Смета», и запоминаются по названию позиции.</Tip></h3>
        <span className="muted">{nPrices} {plural(nPrices, ['позиция', 'позиции', 'позиций'])}</span>
      </div>
      <div className="data-row">
        <ArmButton className="btn ghost" label="Очистить все цены" armedLabel="Точно очистить?" disabled={nPrices === 0} onRun={() => dispatch({ t: 'clearPrices' })} />
      </div>
      </TabPanel>
    </Sheet>
  );
}
