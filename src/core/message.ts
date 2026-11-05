import type { Project } from './types';

export type MsgKind = 'project' | 'owner' | 'estimate';

const where = (p: Project): string => (p.address.trim() ? ' по адресу ' + p.address.trim() : '');
const hello = (p: Project): string => (p.client.trim() ? 'Здравствуйте, ' + p.client.trim() + '!' : 'Здравствуйте!');

export function shareText(kind: MsgKind, p: Project, url: string): string {
  if (kind === 'estimate') return hello(p) + ' Подготовил смету на электромонтаж' + where(p) + '. Посмотреть работы и материалы и согласовать можно по ссылке: ' + url;
  if (kind === 'owner') return hello(p) + ' Паспорт электрощитка' + where(p) + ': какая группа на каком автомате, сколько можно включать и что делать, если автомат выключился. Сохраните ссылку: ' + url;
  return 'Проект «' + (p.name.trim() || 'Без названия') + '»' + where(p) + '. Откройте ссылку, чтобы добавить его себе: ' + url;
}

export function viberUrl(text: string): string {
  return 'viber://forward?text=' + encodeURIComponent(text);
}

export function telegramUrl(text: string, url: string): string {
  const rest = text.includes(url) ? text.replace(url, '').replace(/[\s:]+$/, '') : text;
  return 'https://t.me/share/url?url=' + encodeURIComponent(url) + (rest ? '&text=' + encodeURIComponent(rest) : '');
}
