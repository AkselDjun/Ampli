import { describe, expect, it } from 'vitest';
import { shareText, telegramUrl, viberUrl } from '../../core/message';
import { sampleProject } from '../../core/project';

const proj = (o: { name?: string; address?: string; client?: string } = {}) => ({ ...sampleProject(), name: '', address: '', client: '', ...o });

describe('messages for messengers', () => {
  it('writes the estimate text with the client and address', () => {
    const t = shareText('estimate', proj({ client: ' Иван ', address: ' Минск, Притыцкого 10 ' }), 'https://a/#e=1');
    expect(t).toBe('Здравствуйте, Иван! Подготовил смету на электромонтаж по адресу Минск, Притыцкого 10. Посмотреть работы и материалы и согласовать можно по ссылке: https://a/#e=1');
  });
  it('writes the owner and project texts without client or address', () => {
    expect(shareText('owner', proj(), 'U')).toBe('Здравствуйте! Паспорт электрощитка: какая группа на каком автомате, сколько можно включать и что делать, если автомат выключился. Сохраните ссылку: U');
    expect(shareText('project', proj(), 'U')).toBe('Проект «Без названия». Откройте ссылку, чтобы добавить его себе: U');
    expect(shareText('project', proj({ name: 'Кв. 5', address: 'Гродно' }), 'U')).toBe('Проект «Кв. 5» по адресу Гродно. Откройте ссылку, чтобы добавить его себе: U');
  });
  it('builds a Viber forward link', () => {
    expect(viberUrl('Смета: https://a/#e=1')).toBe('viber://forward?text=' + encodeURIComponent('Смета: https://a/#e=1'));
  });
  it('builds a Telegram share link with the url apart from the text', () => {
    const u = telegramUrl('Смета по ссылке: https://a/#e=1', 'https://a/#e=1');
    expect(u).toBe('https://t.me/share/url?url=' + encodeURIComponent('https://a/#e=1') + '&text=' + encodeURIComponent('Смета по ссылке'));
    expect(telegramUrl('https://a', 'https://a')).toBe('https://t.me/share/url?url=' + encodeURIComponent('https://a'));
    expect(telegramUrl('Свой текст', 'https://a')).toBe('https://t.me/share/url?url=' + encodeURIComponent('https://a') + '&text=' + encodeURIComponent('Свой текст'));
  });
});
