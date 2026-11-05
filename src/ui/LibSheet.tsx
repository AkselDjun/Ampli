import { useRef, useState } from 'react';
import { plural } from '../core/format';
import { useLib } from '../store/LibContext';
import { ArmButton, Seg, Sheet, TabPanel, Tabs, Tip } from './common';
import { scaleLogo } from './logo';
import { toastBad } from './toast';
import { THEME_LABEL, useTheme } from './theme';
import type { Theme } from './theme';
import { Button, Field } from './kit';
import { APP_VERSION, NORMS_CHECKED, NORMS_EDITION } from '../core/version';
import { CHANGELOG_URL } from './release';

export function LibSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lib, dispatch } = useLib();
  const file = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState('brand');
  const b = lib.brand;
  const nPrices = Object.keys(lib.prices).length;
  const [theme, setTheme] = useTheme();
  return (
    <Sheet open={open} onClose={onClose} title="Мои данные" bar={<Tabs scope="lib" label="Разделы данных" cur={tab} onChange={setTab} items={[{ id: 'brand', label: 'Реквизиты' }, { id: 'tpl', label: 'Шаблоны и цены' }, { id: 'view', label: 'Оформление' }]} />}>
      <TabPanel scope="lib" id="brand" cur={tab}>
      <h3 className="sec-t">Реквизиты для отчёта</h3>
      <div className="meta-grid">
        <Field id="bCo" label="Организация или ФИО" wide><input id="bCo" type="text" maxLength={80} autoComplete="off" value={b.company} onChange={e => dispatch({ t: 'brand', field: 'company', value: e.target.value })} /></Field>
        <Field id="bCt" label="Контакты" wide><input id="bCt" type="text" maxLength={160} autoComplete="off" value={b.contacts} onChange={e => dispatch({ t: 'brand', field: 'contacts', value: e.target.value })} /></Field>
        <Field id="bSg" label="Подписант (ФИО, должность)" wide><input id="bSg" type="text" maxLength={80} autoComplete="off" value={b.signer} onChange={e => dispatch({ t: 'brand', field: 'signer', value: e.target.value })} /></Field>
      </div>
      <div className="logo-row">
        {b.logo ? <img className="logo-img" src={b.logo} alt="Логотип" /> : <span className="muted">Логотип не загружен</span>}
        <Button onClick={() => file.current?.click()}>{b.logo ? 'Заменить логотип' : 'Загрузить логотип'}</Button>
        {b.logo && <Button variant="ghost" onClick={() => dispatch({ t: 'logo', value: '' })}>Убрать логотип</Button>}
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
            <ArmButton variant="danger" label="Удалить" armedLabel="Точно?" onRun={() => dispatch({ t: 'delTpl', id: t.id })} />
          </div>
        ))}
      </div>

      <div className="sec-row">
        <h3 className="sec-t">Цены в смете<Tip>Цены вводятся в отчёте, на вкладке «Смета», и запоминаются по названию позиции.</Tip></h3>
        <span className="muted">{nPrices} {plural(nPrices, ['позиция', 'позиции', 'позиций'])}</span>
      </div>
      <div className="data-row">
        <ArmButton variant="ghost" label="Очистить все цены" armedLabel="Точно очистить?" disabled={nPrices === 0} onRun={() => dispatch({ t: 'clearPrices' })} />
      </div>
      </TabPanel>
      <TabPanel scope="lib" id="view" cur={tab}>
      <h3 className="sec-t" id="themeT">Тема оформления</h3>
      <Seg<Theme> name="theme" labelledBy="themeT" value={theme} onChange={setTheme} items={(Object.keys(THEME_LABEL) as Theme[]).map(k => [k, THEME_LABEL[k]])} />
      <p className="muted">«Как в системе» следует настройке телефона или компьютера. Выбор хранится на этом устройстве.</p>
      <h3 className="sec-t">О программе</h3>
      <p className="muted">Ampli {APP_VERSION}. Нормы: {NORMS_EDITION}, сверено {NORMS_CHECKED}.</p>
      <p><a className="link" href={CHANGELOG_URL} target="_blank" rel="noopener noreferrer">Что нового</a></p>
      </TabPanel>
    </Sheet>
  );
}
