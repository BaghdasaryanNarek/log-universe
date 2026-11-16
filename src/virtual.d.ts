declare module 'virtual:qr' {
  /** production-адрес сайта (https://…), подставляется при сборке */
  export const SITE_URL: string;
  /** QR-код этого адреса в SVG: тёмные модули на светлой подложке, тихая зона 4 модуля, коррекция Q */
  export const QR_SVG: string;
}
