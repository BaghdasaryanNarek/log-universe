export interface Source { id: string; title: string; url?: string }

export const SOURCES: Source[] = [
  { id: 'pogson1856', title: 'N. Pogson. Magnitudes of thirty-six of the minor planets… MNRAS 17 (1856) 12–15', url: 'https://doi.org/10.1093/mnras/17.1.12' },
  { id: 'hyg', title: 'HYG Database v4.4 — D. Nash, astronexus.com. CC BY-SA 4.0 (производный файл stars.bin — под той же лицензией)', url: 'https://codeberg.org/astronexus/hyg' },
  { id: 'simbad', title: 'SIMBAD Astronomical Database, CDS Strasbourg', url: 'https://simbad.cds.unistra.fr' },
  { id: 'gaia-dr3', title: 'Gaia DR3 (ESA): параллакс Проксимы Центавра 768,07 мсек дуги', url: 'https://www.cosmos.esa.int/web/gaia/dr3' },
  { id: 'nssdc-sun', title: 'NASA NSSDC Sun Fact Sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html' },
  { id: 'nssdc-moon', title: 'NASA NSSDC Moon Fact Sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html' },
  { id: 'nssdc-venus', title: 'NASA NSSDC Venus Fact Sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html' },
  { id: 'nssdc-earth', title: 'NASA NSSDC Earth Fact Sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html' },
  { id: 'nssdc-neptune', title: 'NASA NSSDC Neptune Fact Sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/neptunefact.html' },
  { id: 'iau2012', title: 'IAU 2012 Resolution B2: астрономическая единица = 149 597 870 700 м', url: 'https://www.iau.org/static/resolutions/IAU2012_English.pdf' },
  { id: 'iau-units', title: 'IAU: Measuring the Universe — световой год, парсек', url: 'https://www.iau.org/public/themes/measuring/' },
  { id: 'everest2020', title: 'Совместное измерение Непала и Китая (2020): 8848,86 м' },
  { id: 'fai-karman', title: 'FAI: линия Кармана, 100 км' },
  { id: 'esa-xdf', title: 'ESA/Hubble heic1214: Hubble eXtreme Deep Field, самые тусклые объекты ≈ 31ᵐ', url: 'https://esahubble.org/news/heic1214/' },
  { id: 'naked-eye', title: 'Предел невооружённого глаза ≈ +6ᵐ (под тёмным небом до ≈ +6,5ᵐ)' },
  { id: 'wiki-observable', title: 'Observable universe: диаметр ≈ 93 млрд св. лет ≈ 8,8·10²⁶ м', url: 'https://en.wikipedia.org/wiki/Observable_universe' },
];
