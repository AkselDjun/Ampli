declare const __APP_VERSION__: string;

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

export const NORMS_EDITION = 'ТКП 339-2022 с изм. № 1, СН 4.04.01-2019 с изм. № 1 (изм. № 2 с 07.12.2026), ПУЭ табл. 1.3.4';
export const NORMS_CHECKED = '05.11.2026';

export const stamp = (date: string): string => 'Ampli ' + APP_VERSION + ' · нормы: ' + NORMS_EDITION + ', сверено ' + NORMS_CHECKED + ' · ' + date;
