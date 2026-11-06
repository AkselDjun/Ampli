# Журнал изменений

## 0.2.2 (2026-11-06)

- Set version to 0.2.1 and release every Monday (#32)

## 0.2.1 (2026-11-06)

- Нумерация версий переведена на 0.x: продукт ещё не достиг MVP, прежние 2.0.0 и 2.1.0 стали 0.1.0 и 0.2.0
- Store projects in IndexedDB, one record per project (#29)
- Protect stored projects with persistent storage and weekly backups (#30)
- Redesign README (#31)

## 0.2.0 (2026-11-06)

- perf/e2e-budgets-lighthouse (#28)
- Use one font family, preload the Cyrillic file and speed up browser install in CI (#27)
- Norm reference tests, accessibility scan, code splitting, CSP and releases (#26)

## 0.1.0 (2026-11-05)

- Эталонные тесты расчёта по нормам РБ и проверка свойств расчёта на случайных проектах
- Версия приложения и редакция норм в каждом отчёте и файле проекта
- Автопроверка доступности (axe) в обеих темах, подписи кнопок совпадают с видимым текстом
- Редко нужные окна загружаются по требованию, React в отдельном кэшируемом файле
- Политика безопасности контента и ограничение размера ссылок на проект
- Общие компоненты Button, IconButton и Field (#25)
- Переключатель темы: как в системе, светлая или тёмная (#24)
- Токены дизайн-системы в одном файле, без голых цветов в стилях (#23)
- CI на каждый пул-реквест, деплой после проверок, бюджет размера сборки (#14)
