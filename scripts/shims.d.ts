declare module 'subset-font' {
  export default function subsetFont(buf: Uint8Array, text: string, opts?: { targetFormat?: string; variationAxes?: Record<string, number> }): Promise<Uint8Array>;
}
declare module 'fontkit';
