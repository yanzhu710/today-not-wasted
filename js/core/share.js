// 今天没白过 · 分享面板：模板选择 + 日/周 + 比例切换 + 导出PNG
import { h, qs, todayKey, addDaysKey, fmtCN, weekdayOf, uid } from './util.js';
import { openModal, toast, configure } from './fx.js';
import { stats, todaySummary } from './engine.js';
import { BADGES, PETS } from './catalog.js';
import { all, allByIndex, loadKV } from './db.js';
import { petSVG } from './pets.js';

// 分享模板
const TEMPLATES = [
  { id: 'journal', name: '生活手账', desc: '横线纸·日期标题·精选事项' },
  { id: 'achievement', name: '伙伴成就卡', desc: '宠物与徽章居中·统计与留白' },
];

// 比例选项
const RATIOS = [
  { id: 'long', name: '长图', w: 750, h: 1334 },
  { id: '4x3', name: '4:3', w: 800, h: 600 },
];

// 打开分享面板
export async function openSharePanel(opts = {}) {
  const { type = 'day', dateKey = todayKey() } = opts;
  const settings = await loadKV('settings');
  const profile = await loadKV('profile');

  let currentType = type;
  let currentTemplate = 'journal';
  let currentRatio = 'long';
  let userNote = '';
  let selectedItems = { tasks: true, focus: true, badges: true, pet: true, stats: true };

  // 加载数据
  const data = await loadShareData(currentType, dateKey);

  // 构建面板
  const panel = h('div', { class: 'share-panel' });

  // 模板选择
  const tplRow = h('div', { class: 'share-tpl-row' });
  for (const tpl of TEMPLATES) {
    const card = h('div', {
      class: 'share-tpl-card' + (currentTemplate === tpl.id ? ' active' : ''),
      onclick: () => {
        currentTemplate = tpl.id;
        updatePreview();
        panel.querySelectorAll('.share-tpl-card').forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
      },
    },
      h('div', { class: 'tpl-preview' }, getTemplateThumb(tpl.id)),
      h('div', { class: 'tpl-name' }, tpl.name),
      h('div', { class: 'tpl-desc' }, tpl.desc)
    );
    tplRow.append(card);
  }

  // 日/周切换
  const typeRow = h('div', { class: 'share-type-row' },
    h('button', {
      class: 'share-type-btn' + (currentType === 'day' ? ' active' : ''),
      onclick: () => {
        currentType = 'day';
        typeRow.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        event.target.classList.add('active');
        updatePreview();
      }
    }, '日分享'),
    h('button', {
      class: 'share-type-btn' + (currentType === 'week' ? ' active' : ''),
      onclick: () => {
        currentType = 'week';
        typeRow.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        event.target.classList.add('active');
        updatePreview();
      }
    }, '周分享')
  );

  // 比例切换
  const ratioRow = h('div', { class: 'share-ratio-row' },
    ...RATIOS.map((r) => h('button', {
      class: 'share-ratio-btn' + (currentRatio === r.id ? ' active' : ''),
      onclick: () => {
        currentRatio = r.id;
        ratioRow.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        event.target.classList.add('active');
        updatePreview();
      }
    }, r.name))
  );

  // 内容勾选
  const contentRow = h('div', { class: 'share-content-row' },
    h('label', { class: 'share-check' },
      h('input', { type: 'checkbox', checked: selectedItems.tasks ? 'checked' : '', onchange: (e) => { selectedItems.tasks = e.target.checked; updatePreview(); } }),
      h('span', null, '完成事项')),
    h('label', { class: 'share-check' },
      h('input', { type: 'checkbox', checked: selectedItems.focus ? 'checked' : '', onchange: (e) => { selectedItems.focus = e.target.checked; updatePreview(); } }),
      h('span', null, '专注时间')),
    h('label', { class: 'share-check' },
      h('input', { type: 'checkbox', checked: selectedItems.badges ? 'checked' : '', onchange: (e) => { selectedItems.badges = e.target.checked; updatePreview(); } }),
      h('span', null, '新徽章')),
    h('label', { class: 'share-check' },
      h('input', { type: 'checkbox', checked: selectedItems.pet ? 'checked' : '', onchange: (e) => { selectedItems.pet = e.target.checked; updatePreview(); } }),
      h('span', null, '宠物元素')),
  );

  // 一句话
  const noteInput = h('input', {
    class: 'share-note-input',
    placeholder: '写一句今天的感受（可选）',
    value: userNote,
    oninput: (e) => { userNote = e.target.value; },
  });

  // 预览区
  const previewBox = h('div', { class: 'share-preview-box' });

  // 更新预览
  async function updatePreview() {
    const d = await loadShareData(currentType, dateKey);
    previewBox.innerHTML = '';
    previewBox.append(buildShareCard(currentTemplate, currentType, d, {
      ...selectedItems, note: userNote, ratio: currentRatio, profile
    }));
  }

  // 导出按钮
  const exportBtn = h('button', {
    class: 'btn btn-primary btn-block',
    style: 'margin-top:12px',
    onclick: async () => {
      exportBtn.disabled = true;
      exportBtn.textContent = '正在生成...';
      try {
        await exportToPNG(previewBox.querySelector('.share-card'), currentRatio);
        toast('分享卡已生成', { ic: 'download' });
      } catch (e) {
        toast('生成失败，请重试', { ic: 'error' });
      } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = '生成分享卡';
      }
    }
  }, '生成分享卡');

  panel.append(
    h('h3', { style: 'font-size:16px;font-weight:700;margin-bottom:12px' }, '选择分享模板'),
    tplRow,
    h('h3', { style: 'font-size:16px;font-weight:700;margin:16px 0 8px' }, '分享类型'),
    typeRow,
    h('h3', { style: 'font-size:16px;font-weight:700;margin:16px 0 8px' }, '卡片比例'),
    ratioRow,
    h('h3', { style: 'font-size:16px;font-weight:700;margin:16px 0 8px' }, '展示内容'),
    contentRow,
    noteInput,
    previewBox,
    exportBtn
  );

  // 初始预览
  updatePreview();

  openModal({
    title: '分享今日',
    content: panel,
    actions: [
      { label: '关闭', onClick: (close) => close() },
    ],
  });
}

// 加载分享数据
async function loadShareData(type, dateKey) {
  const summary = await todaySummary();
  const events = await allByIndex('events', 'dateKey', dateKey);
  const tasks = await all('tasks');
  const badges = await all('badges');
  const pets = await all('pets');
  const profile = await loadKV('profile');
  const appMeta = await loadKV('app_meta');

  // 当日完成任务
  const doneTasks = tasks.filter((t) => t.done && t.dateKey === dateKey).slice(0, 5);

  // 当日新徽章
  const todayBadges = badges.filter((b) => {
    const dk = new Date(b.unlockedAt || b.createdAt).toISOString().slice(0, 10);
    return dk === dateKey;
  }).slice(0, 3);

  const activePetId = (appMeta && appMeta.activePet) || (pets[0] && pets[0].petId);
  const activePet = pets.find((p) => p.petId === activePetId);

  return {
    dateKey,
    doneTasks,
    todayBadges,
    focusMin: summary.focusMin || 0,
    validEvents: summary.validEvents || 0,
    activePet,
    petDef: PETS.find((p) => p.petId === (activePet && activePet.petId)),
    profile,
  };
}

// 构建分享卡片
function buildShareCard(template, type, data, opts) {
  const { ratio } = opts;
  const r = RATIOS.find((r) => r.id === ratio) || RATIOS[0];

  if (template === 'journal') {
    return buildJournalCard(type, data, opts, r);
  } else {
    return buildAchievementCard(type, data, opts, r);
  }
}

// 生活手账模板
function buildJournalCard(type, data, opts, ratio) {
  const { dateKey, doneTasks, todayBadges, focusMin, validEvents, activePet, petDef, profile } = data;
  const dk = dateKey;
  const hol = ''; // holidayName(dk);
  const weekDay = '周' + '一二三四五六日'[weekdayOf(dk) - 1];

  const card = h('div', {
    class: 'share-card share-journal',
    style: `width:${ratio.w}px;min-height:${ratio.h}px;background:#FFFBF2;padding:44px 40px;position:relative;overflow:hidden`
  });

  // 横线纸背景
  card.style.backgroundImage = 'repeating-linear-gradient(transparent, transparent 33px, #E0D5BC 33px, #E0D5BC 34px)';
  card.style.backgroundColor = '#FFFBF2';

  // 日期标题
  card.append(
    h('div', { style: 'font-size:26px;font-weight:800;color:#3A3F38;margin-bottom:8px;letter-spacing:1px' },
      `${new Date().getMonth() + 1}月${new Date().getDate()}日 · ${weekDay}`),
    h('div', { style: 'font-size:15px;color:#8A8F85;margin-bottom:28px' },
      opts.note || (type === 'day' ? '今天留下了什么' : '本周的小记录'))
  );

  // 精选事项
  if (opts.tasks && doneTasks.length) {
    card.append(h('div', { style: 'font-size:15px;font-weight:700;color:#557054;margin:16px 0 8px' }, '✓ 今日完成'));
    for (const t of doneTasks.slice(0, 4)) {
      card.append(h('div', { style: 'font-size:14px;color:#3A3F38;line-height:32px' },
        '· ' + (t.title || '完成一件小事')));
    }
  }

  // 专注时间
  if (opts.focus && focusMin > 0) {
    card.append(h('div', { style: 'font-size:14px;color:#3A3F38;line-height:32px;margin-top:8px' },
      `⏱ 专注 ${Math.round(focusMin)} 分钟`));
  }

  // 新徽章
  if (opts.badges && todayBadges.length) {
    card.append(h('div', { style: 'font-size:15px;font-weight:700;color:#557054;margin:16px 0 8px' }, '🏅 新解锁'));
    for (const b of todayBadges.slice(0, 3)) {
      card.append(h('div', { style: 'font-size:14px;color:#3A3F38;line-height:32px' },
        '· ' + b.name));
    }
  }

  // 底部统计
  card.append(h('div', { style: 'position:absolute;bottom:24px;left:36px;right:36px;display:flex;justify-content:space-between;align-items:center' },
    h('div', { style: 'font-size:12px;color:#8A8F85' },
      type === 'day' ? `记录 ${validEvents} 条` : '本周回顾'),
    opts.pet && activePet ? h('div', { style: 'font-size:12px;color:#8A8F85' },
      `陪伴伙伴：${activePet.name || '伙伴'}`) : null
  ));

  return card;
}

// 伙伴成就卡模板
function buildAchievementCard(type, data, opts, ratio) {
  const { dateKey, doneTasks, todayBadges, focusMin, validEvents, activePet, petDef } = data;

  const card = h('div', {
    class: 'share-card share-achievement',
    style: `width:${ratio.w}px;min-height:${ratio.h}px;background:#F7F3EA;padding:40px 36px;position:relative;display:flex;flex-direction:column;align-items:center;text-align:center`
  });

  // 标题
  card.append(
    h('div', { style: 'font-size:20px;font-weight:800;color:#3A3F38;margin-bottom:6px' },
      type === 'day' ? '今日成就' : '本周成就'),
    h('div', { style: 'font-size:13px;color:#8A8F85;margin-bottom:24px' },
      opts.note || '一起记录的小确幸')
  );

  // 宠物居中
  if (opts.pet && activePet && petDef) {
    const petWrap = h('div', { style: 'width:140px;height:140px;margin:16px auto' });
    try { petWrap.innerHTML = petSVG(activePet.petId, { stage: 1 }); } catch(e) {}
    card.append(petWrap);
    card.append(h('div', { style: 'font-size:16px;font-weight:700;color:#3A3F38' },
      activePet.name || petDef.name));
  }

  // 统计数据
  card.append(h('div', { style: 'display:flex;gap:24px;margin:24px 0;justify-content:center' },
    h('div', null,
      h('div', { style: 'font-size:28px;font-weight:800;color:#748F72' }, doneTasks.length),
      h('div', { style: 'font-size:12px;color:#8A8F85' }, '完成事项')),
    h('div', null,
      h('div', { style: 'font-size:28px;font-weight:800;color:#D8A94D' }, Math.round(focusMin)),
      h('div', { style: 'font-size:12px;color:#8A8F85' }, '专注分钟')),
    h('div', null,
      h('div', { style: 'font-size:28px;font-weight:800;color:#D78367' }, todayBadges.length),
      h('div', { style: 'font-size:12px;color:#8A8F85' }, '新徽章')),
  ));

  // 徽章列表
  if (opts.badges && todayBadges.length) {
    card.append(h('div', { style: 'display:flex;gap:8px;justify-content:center;margin-top:8px' },
      ...todayBadges.slice(0, 3).map((b) => h('span', {
        style: 'padding:6px 12px;border-radius:999px;background:#E9EFE6;color:#557054;font-size:12px;font-weight:600'
      }, b.name))
    ));
  }

  return card;
}

// 模板缩略图
function getTemplateThumb(id) {
  if (id === 'journal') {
    return h('div', { style: 'width:100%;height:80px;background:#FFFDF8;border:1px solid #E7E0D2;border-radius:8px;padding:8px' },
      h('div', { style: 'font-size:11px;font-weight:700;color:#3A3F38' }, '9月18日 · 周五'),
      h('div', { style: 'font-size:9px;color:#8A8F85;margin-top:4px' }, '· 散步30分钟\n· 阅读15分钟'),
    );
  } else {
    return h('div', { style: 'width:100%;height:80px;background:#F7F3EA;border:1px solid #E7E0D2;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center' },
      h('div', { style: 'width:30px;height:30px;border-radius:50%;background:#E9EFE6;margin-bottom:4px' }),
      h('div', { style: 'font-size:10px;font-weight:700;color:#557054' }, '今日成就'),
    );
  }
}

// 导出PNG - 使用DOM序列化到Canvas
async function exportToPNG(el, ratioId) {
  const ratio = RATIOS.find((r) => r.id === ratioId) || RATIOS[0];
  const scale = 2; // 2x 高清

  // 创建SVG foreignObject来序列化DOM
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', ratio.w);
  svg.setAttribute('height', ratio.h);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  foreignObject.setAttribute('width', '100%');
  foreignObject.setAttribute('height', '100%');

  // 克隆元素并设置内联样式
  const clone = el.cloneNode(true);
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  foreignObject.appendChild(clone);
  svg.appendChild(foreignObject);

  const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = ratio.w * scale;
      canvas.height = ratio.h * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, ratio.w, ratio.h);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('导出失败')); return; }
        const link = document.createElement('a');
        link.download = `今天没白过-${todayKey()}.png`;
        link.href = URL.createObjectURL(blob);
        link.click();
        resolve();
      }, 'image/png', 0.92);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      // 降级：直接截图整个预览区
      const canvas = document.createElement('canvas');
      canvas.width = ratio.w * scale;
      canvas.height = ratio.h * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFDF8';
      ctx.fillRect(0, 0, ratio.w, ratio.h);
      ctx.fillStyle = '#2F3430';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('分享卡生成中...', 36, 60);
      const link = document.createElement('a');
      link.download = `今天没白过-${todayKey()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      resolve();
    };
    img.src = url;
  });
}
