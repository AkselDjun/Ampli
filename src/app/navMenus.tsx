import { plural } from '../core/format';
import { initials, recentProjects, whenLabel } from '../core/recent';
import type { Project } from '../core/types';
import { IconBook, IconCap, IconCart, IconCompare, IconFolder, IconGrid, IconHeat, IconLan, IconPlus, IconRooms, IconWire } from '../ui/Icons';
import type { MenuGroup } from '../ui/MenuButton';
import type { NavActions } from './types';

export const RECENT_LIMIT = 5;

export const projectMenu = (list: readonly Project[], cur: string, now: number, go: NavActions): MenuGroup[] => [
  {
    id: 'recent',
    title: 'Недавние',
    items: recentProjects(list, cur, RECENT_LIMIT).map(x => ({
      id: x.id,
      label: x.name || 'Без названия',
      hint: x.lines.length + ' ' + plural(x.lines.length, ['группа', 'группы', 'групп']) + ' · ' + whenLabel(x.updated, now),
      mark: initials(x.name),
      current: x.id === cur,
      run: () => go.project(x.id)
    }))
  },
  {
    id: 'all',
    items: [
      { id: 'new', label: 'Новый проект', icon: <IconPlus />, run: go.newProject },
      { id: 'all', label: 'Все проекты', hint: 'Файлы, ссылки и резервные копии', icon: <IconGrid />, run: go.projects }
    ]
  }
];

export const toolsMenu = (go: NavActions): MenuGroup[] => [
  {
    id: 'build',
    title: 'Собрать',
    items: [
      { id: 'rooms', label: 'Комнаты', hint: 'Группы по списку помещений', icon: <IconRooms />, run: go.rooms },
      { id: 'old', label: 'Старая проводка', hint: 'Обследование и заключение', icon: <IconWire />, run: go.oldWiring }
    ]
  },
  {
    id: 'compare',
    title: 'Сравнить',
    items: [{ id: 'compare', label: 'Сравнение вариантов', hint: 'Что изменится, если убрать или добавить', icon: <IconCompare />, run: go.compare }]
  },
  {
    id: 'calc',
    title: 'Посчитать',
    items: [
      { id: 'floor', label: 'Тёплый пол', hint: 'Мат, кабель, терморегулятор', icon: <IconHeat />, run: go.floor },
      { id: 'weak', label: 'Слаботочка', hint: 'Интернет, ТВ, камеры, домофон', icon: <IconLan />, run: go.weak }
    ]
  },
  {
    id: 'shop',
    title: 'Закупка',
    items: [{ id: 'shop', label: 'Где купить', hint: 'Список из спецификации и ваши прайсы', icon: <IconCart />, run: go.shop }]
  }
];

export const settingsMenu = (go: NavActions): MenuGroup[] => [
  {
    id: 'data',
    items: [
      { id: 'lib', label: 'Мои данные', hint: 'Реквизиты, цены, шаблоны, тема', icon: <IconBook />, run: go.library },
      { id: 'share', label: 'Обмен и резервные копии', hint: 'Файлы, пароль, замок, отчёт о проблеме', icon: <IconFolder />, run: go.share }
    ]
  },
  {
    id: 'help',
    items: [{ id: 'tour', label: 'Обучение', hint: 'Короткий тур по приложению', icon: <IconCap />, run: go.tour }]
  }
];
