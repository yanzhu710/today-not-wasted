// 今天没白过 · 中国法定节假日与调休数据
// 数据来源：《国务院办公厅关于2026年部分节假日安排的通知》（国办发明电〔2025〕号，2025-11-04 发布）
//          及《国务院办公厅关于2025年部分节假日安排的通知》。
// 结构：每个年份列出放假区间（含节假日名称）与需要上班的调休周末。
// 未收录的年份（如官方尚未公布的下一年）会自动按普通周末处理，并提示以官方通知为准。

export const HOLIDAY_YEARS = {
  2025: {
    blocks: [
      { name: '元旦', start: '2025-01-01', end: '2025-01-01' },
      { name: '春节', start: '2025-01-28', end: '2025-02-04' },
      { name: '清明节', start: '2025-04-04', end: '2025-04-06' },
      { name: '劳动节', start: '2025-05-01', end: '2025-05-05' },
      { name: '端午节', start: '2025-05-31', end: '2025-06-02' },
      { name: '国庆节·中秋节', start: '2025-10-01', end: '2025-10-08' },
    ],
    makeup: ['2025-01-26', '2025-02-08', '2025-04-27', '2025-09-28', '2025-10-11'],
  },
  2026: {
    blocks: [
      { name: '元旦', start: '2026-01-01', end: '2026-01-03' },
      { name: '春节', start: '2026-02-15', end: '2026-02-23' },
      { name: '清明节', start: '2026-04-04', end: '2026-04-06' },
      { name: '劳动节', start: '2026-05-01', end: '2026-05-05' },
      { name: '端午节', start: '2026-06-19', end: '2026-06-21' },
      { name: '中秋节', start: '2026-09-25', end: '2026-09-27' },
      { name: '国庆节', start: '2026-10-01', end: '2026-10-07' },
    ],
    makeup: ['2026-01-04', '2026-02-14', '2026-02-28', '2026-05-09', '2026-09-20', '2026-10-10'],
  },
};

const blockCache = new Map(); // dateKey -> block
const makeupCache = new Map(); // dateKey -> true
for (const [year, data] of Object.entries(HOLIDAY_YEARS)) {
  for (const b of data.blocks) {
    const d = new Date(b.start);
    const end = new Date(b.end);
    while (d <= end) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      blockCache.set(k, b.name);
      d.setDate(d.getDate() + 1);
    }
  }
  for (const k of data.makeup) makeupCache.set(k, true);
}

export function hasHolidayData(year) { return !!HOLIDAY_YEARS[year]; }

// 单日信息：holiday=节假日名称（法定放假日）；makeup=调休上班日；weekend=普通周末
export function dayInfo(dateKey) {
  const holiday = blockCache.get(dateKey) || null;
  const makeup = makeupCache.has(dateKey);
  const d = new Date(dateKey + 'T00:00:00');
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  return { holiday, makeup, weekend, rest: (!!holiday) || (weekend && !makeup) };
}
export function holidayName(dateKey) { return blockCache.get(dateKey) || null; }
export function isMakeupDay(dateKey) { return makeupCache.has(dateKey); }

// 某年所有假期区间（供“下一个假期”等展示）
export function blocksOfYear(year) { return (HOLIDAY_YEARS[year] || {}).blocks || []; }

// 下一个假期（从今天起，含今天）
export function nextHoliday(fromKey) {
  const y = Number(fromKey.slice(0, 4));
  const candidates = [];
  for (const yr of [y, y + 1]) {
    for (const b of blocksOfYear(yr)) candidates.push(b);
  }
  candidates.sort((a, b) => a.start.localeCompare(b.start));
  return candidates.find((b) => b.end >= fromKey) || null;
}

// 某月内的假期天数（法定放假日数，不含普通周末）
export function holidayDaysInMonth(mKey) {
  let n = 0;
  const [y, m] = mKey.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const k = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (blockCache.has(k)) n++;
  }
  return n;
}
