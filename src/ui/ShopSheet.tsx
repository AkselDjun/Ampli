import { useMemo, useRef, useState } from 'react';
import type { Calc } from '../core/types';
import { fmt } from '../core/format';
import { buildSpec } from '../core/spec';
import { SHOPS, bestOffers, searchUrl, shopQuery } from '../core/shop';
import type { Offer } from '../core/shop';
import { parsePriceFile } from '../core/pricelist';
import { MAX_LISTS, addList, loadLists, saveLists } from '../store/pricelists';
import type { PriceList } from '../store/pricelists';
import { useLib } from '../store/LibContext';
import { Sheet, TabPanel, Tabs, Tip } from './common';

const BYN = ' BYN';

export function ShopSheet({ open, onClose, a }: { open: boolean; onClose: () => void; a: Calc }) {
  const { dispatch } = useLib();
  const [lists, setLists] = useState<PriceList[]>(loadLists);
  const [pick, setPick] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<{ t: string; bad: boolean } | null>(null);
  const [tab, setTab] = useState('buy');
  const file = useRef<HTMLInputElement>(null);
  const items = useMemo(() => buildSpec(a), [a]);
  const offers = useMemo(() => lists.flatMap(l => l.offers), [lists]);
  const rows = items.map(item => {
    const found = offers.length ? bestOffers(item, offers) : [];
    const chosen: Offer | null = found.length ? found[Math.min(pick[item.name] ?? 0, found.length - 1)] : null;
    return { item, found, chosen };
  });
  const total = rows.reduce((s, r) => s + (r.chosen && r.item.n !== null ? r.chosen.price * r.item.n : 0), 0);
  const matched = rows.filter(r => r.chosen).length;
  const note = (t: string, bad = false) => setMsg({ t, bad });

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    let buf: ArrayBuffer;
    try {
      buf = await f.arrayBuffer();
    } catch (e) {
      void e;
      note('Не удалось прочитать файл', true);
      return;
    }
    const parsed = parsePriceFile(f.name, buf);
    if (!parsed) {
      note('Не нашёл в файле наименования и цены. Подойдёт CSV или Excel (.xlsx) с колонками «Наименование» и «Цена».', true);
      return;
    }
    const next = addList(lists, f.name.replace(/\.[^.]+$/, '').slice(0, 60), parsed.offers);
    if (!saveLists(next)) {
      note('Не хватило места в браузере для этого прайса', true);
      return;
    }
    setLists(next);
    setPick({});
    setTab('buy');
    note('Загружено позиций: ' + parsed.offers.length + (parsed.skipped ? ', пропущено строк: ' + parsed.skipped : ''));
  };

  const removeList = (id: string) => {
    const next = lists.filter(l => l.id !== id);
    saveLists(next);
    setLists(next);
    setPick({});
  };

  const apply = () => {
    let n = 0;
    rows.forEach(r => {
      if (r.chosen) {
        dispatch({ t: 'price', name: r.item.name, value: String(r.chosen.price) });
        n++;
      }
    });
    note(n ? 'Цены подставлены в смету: ' + n + ' поз.' : 'Нет подходящих цен для подстановки', !n);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Где купить" bar={<Tabs scope="shop" label="Разделы закупки" cur={tab} onChange={setTab} items={[{ id: 'buy', label: 'Что купить' }, { id: 'lists', label: 'Прайсы' + (lists.length ? ' (' + lists.length + ')' : '') }]} />} tip="Список закупки собран из вашей спецификации. Кнопки магазинов открывают поиск по нужной позиции. Загрузите прайс поставщика, и приложение подберёт подходящие позиции и самую низкую цену. Цены берутся только из ваших файлов, приложение их не угадывает.">
      <TabPanel scope="shop" id="lists" cur={tab}>
      <h3 className="sec-t">Прайсы поставщиков</h3>
      <div className="data-row">
        <button className="btn" type="button" onClick={() => file.current?.click()}>Загрузить прайс</button>
        <Tip>Файл CSV или Excel (.xlsx) с колонками «Наименование» и «Цена». Цены за штуку, а для кабеля за метр. Можно загрузить до {MAX_LISTS} прайсов, приложение выберет самый дешёвый вариант. Прайсы хранятся только на этом устройстве.</Tip>
        <input
          ref={file}
          className="pj-file"
          type="file"
          accept=".csv,.txt,.xlsx,text/csv"
          aria-label="Файл прайса"
          onChange={e => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {lists.length > 0 && (
        <ul className="pl-list">
          {lists.map(l => (
            <li key={l.id}>
              <span><b>{l.name}</b> <small>{l.offers.length} поз.</small></span>
              <button className="btn ghost sm" type="button" aria-label={'Удалить прайс ' + l.name} onClick={() => removeList(l.id)}>Удалить</button>
            </li>
          ))}
        </ul>
      )}
      </TabPanel>
      <TabPanel scope="shop" id="buy" cur={tab}>
      <h3 className="sec-t">Что купить</h3>
      <ul className="shop-list">
        {rows.map(({ item, found, chosen }, idx) => {
          const q = shopQuery(item);
          return (
            <li className="shop-i" key={idx + item.name}>
              <div className="shop-h">
                <b>{item.name}</b>
                <span className="muted">{item.qty}</span>
              </div>
              <div className="shop-links">
                {SHOPS.map(s => (
                  <a key={s.id} className="chip" href={searchUrl(q, s)} target="_blank" rel="noopener noreferrer">{s.name}</a>
                ))}
                <a className="chip" href={searchUrl(q)} target="_blank" rel="noopener noreferrer">Везде</a>
              </div>
              {offers.length > 0 && (
                <div className="shop-offer">
                  {chosen ? (
                    <>
                      <span className="shop-price">{fmt(chosen.price, 2)}{BYN}</span>
                      <span className="muted">{item.unit === 'м' ? 'за м' : 'за шт'} · {chosen.src}</span>
                      {found.length > 1 ? (
                        <select aria-label={'Вариант для ' + item.name} value={Math.min(pick[item.name] ?? 0, found.length - 1)} onChange={e => setPick(p => ({ ...p, [item.name]: Number(e.target.value) }))}>
                          {found.slice(0, 12).map((o, i) => <option key={i} value={i}>{fmt(o.price, 2)} · {o.src} · {o.name.slice(0, 60)}</option>)}
                        </select>
                      ) : (
                        <small className="muted">{chosen.name}</small>
                      )}
                    </>
                  ) : (
                    <span className="muted">В загруженных прайсах не найдено</span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {offers.length > 0 && (
        <div className="shop-foot">
          <span>Найдено цен: <b>{matched}</b> из {rows.length}. Итого по найденным: <b>{fmt(total, 2)}{BYN}</b></span>
          <button className="btn primary" type="button" onClick={apply} disabled={!matched}>Подставить в смету</button>
        </div>
      )}
      </TabPanel>
      {msg && <p role="status" className="muted" style={{ color: msg.bad ? 'var(--bad)' : 'var(--ok)' }}>{msg.t}</p>}
    </Sheet>
  );
}
