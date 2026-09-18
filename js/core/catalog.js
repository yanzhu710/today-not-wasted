// 今天没白过 · 种子目录：徽章 120 枚 / 商品 60 件 / 宠物 / 分类 / 清单模板 / 灵感库 / 奖励参数
// 徽章判定函数接收统计对象 S（由 engine.computeStats 生成），返回布尔值。
// 生活分类 ID：study sport cook tidy health work social finance hobby other

export const CATS = [
  { id: 'study', name: '学习阅读' },
  { id: 'sport', name: '运动散步' },
  { id: 'cook', name: '做饭饮食' },
  { id: 'tidy', name: '家务整理' },
  { id: 'health', name: '健康休息' },
  { id: 'work', name: '工作事务' },
  { id: 'social', name: '社交陪伴' },
  { id: 'finance', name: '财务记账' },
  { id: 'hobby', name: '兴趣休闲' },
  { id: 'other', name: '其他' },
];
export const catName = (id) => (CATS.find((c) => c.id === id) || {}).name || '其他';
export const catColor = (id) => (
  { study: '#7A8FB5', sport: '#6FA88B', cook: '#D78367', tidy: '#9AA07B', health: '#B58AA0', work: '#8B8FA8', social: '#D8A94D', finance: '#5F9B8C', hobby: '#C48FB0', other: '#9AA0A6' }[id] || '#9AA0A6'
);

export const LEDGER_OUT = ['餐饮', '交通', '购物', '日用', '住房', '医疗', '学习', '娱乐', '人情', '其他'];
export const LEDGER_IN = ['工资', '奖金', '兼职', '报销', '礼金', '退款', '其他'];

// ---- 积分与成长值参数（奖励一致性：全站唯一规则源）----
export const POINTS = {
  task: { delta: 5, capPerDay: 30, label: '完成任务' },
  habit: { delta: 8, capPerDay: 24, label: '完成习惯' },
  quick: { delta: 3, capPerDay: 9, label: '快捷记录' },
  focus: { label: '有效专注', capPerDay: 30 },
  ledger: { delta: 5, capPerDay: 5, label: '记账' },
  journal: { delta: 5, capPerDay: 5, label: '手账' },
  checklist: { delta: 8, capPerDay: 16, label: '完成清单' },
  weekReview: { delta: 10, capPerDay: 10, label: '周回顾' },
  milestone: { delta: 20, label: '目标里程碑' },
  goal: { delta: 50, label: '完成目标' },
  onboard: { delta: 100, label: '建档欢迎奖励' },
  dailyAllCap: 100, // 普通日常行为积分上限/天（里程碑类不占）
  focusTier: [[15, 5], [30, 8], [60, 12]], // [分钟下限, 奖励]
};
export const GROWTH = {
  task: 2, habit: 3, focus30: 3, journalFirst: 2, ledgerFirst: 2,
  milestone: 5, goal: 10, badge: 5, capPerDay: 25,
};
export const STAGES = [
  { n: 1, name: '初见', min: 0 },
  { n: 2, name: '熟悉', min: 120 },
  { n: 3, name: '默契', min: 360 },
  { n: 4, name: '陪伴', min: 720 },
  { n: 5, name: '同行', min: 1200 },
];
export const stageOf = (g) => { let s = STAGES[0]; for (const st of STAGES) if (g >= st.min) s = st; return s; };
export const stageProgress = (g) => {
  const cur = stageOf(g);
  const next = STAGES.find((s) => s.n === cur.n + 1);
  if (!next) return { cur, next: null, ratio: 1, remain: 0 };
  return { cur, next, ratio: (g - cur.min) / (next.min - cur.min), remain: next.min - g };
};

// ---- 宠物 ----
export const PETS = [
  { petId: 'maotuan', name: '团团', species: '奶油猫', desc: '圆润、安静，喜欢晒着太阳打盹。', unlock: null, palette: { body: '#F6EEDF', shade: '#EADFC8', ear: '#E3C9A8', blush: '#F2C4B3', ink: '#5B5348' } },
  { petId: 'lili', name: '栗栗', species: '棕耳小犬', desc: '活泼、热情，听到“出去玩”会原地转圈。', unlock: { badges: 30 }, unlockText: '累计解锁 30 枚徽章后领取', palette: { body: '#E8C79A', shade: '#D9B384', ear: '#9A6B45', blush: '#F0B9A4', ink: '#5B4A3C' } },
  { petId: 'mituan', name: '米团', species: '垂耳兔', desc: '温柔、慢热，熟悉之后会主动蹭蹭你。', unlock: { stage: 4 }, unlockText: '任一宠物达到成长阶段4「陪伴」后领取', palette: { body: '#F3EEE9', shade: '#E7DFD6', ear: '#CBB6B6', blush: '#EFC0BE', ink: '#635A56' } },
];

// ---- 生活清单模板 ----
export const CHECKLIST_TEMPLATES = [
  { id: 'tpl_shop', title: '购物清单', items: ['蔬菜水果', '肉蛋奶豆', '主食粮油', '零食饮品', '日用清洁', '其他补给'] },
  { id: 'tpl_trip', title: '旅行行李', items: ['证件钱包（身份证/钥匙）', '手机充电器与充电宝', '换洗衣物与睡衣', '洗漱包', '常用药品', '雨伞', '水杯', '预订确认单截图'] },
  { id: 'tpl_clean', title: '周末大扫除', items: ['开窗通风', '物品归位收纳', '扫地拖地', '卫生间清洁', '厨房油污', '换洗床品', '倒垃圾'] },
  { id: 'tpl_move', title: '搬家', items: ['预约车辆与帮手', '打包分类并贴标签', '清理不需要的物品', '结清水电燃气物业', '更新收货地址', '搬入后清点物品'] },
  { id: 'tpl_out', title: '出门前检查', items: ['手机钱包钥匙', '燃气与门窗', '电器插头', '垃圾已倒', '宠物植物已安顿'] },
];

// ---- 生活灵感（本地规则库，不调用 AI）----
export const INSPIRATIONS = [
  { t: '阳台/窗边深呼吸五分钟', d: '打开窗，做 10 次深呼吸，看看远处，让眼睛休息一下。', min: 5, scene: 'home', type: 'relax', cat: 'health' },
  { t: '给自己泡一杯热饮', d: '认真泡一杯茶或咖啡，只用五分钟，慢慢喝完它。', min: 5, scene: 'home', type: 'relax', cat: 'hobby' },
  { t: '顺手擦一遍手机屏幕和桌面', d: '一张湿巾的时间，桌面和手机立刻清爽。', min: 5, scene: 'home', type: 'tidy', cat: 'tidy' },
  { t: '给绿植浇水擦叶子', d: '检查盆土干湿，顺手把叶子上的灰擦掉。', min: 5, scene: 'home', type: 'tidy', cat: 'tidy' },
  { t: '拍一张今天的窗外', d: '记录今天的天气和光影，以后翻回来看很有意思。', min: 5, scene: 'home', type: 'relax', cat: 'hobby' },
  { t: '给家人发一条语音问候', d: '不用长篇大论，说两句今天的事就好。', min: 5, scene: 'home', type: 'social', cat: 'social' },
  { t: '做 20 个深蹲或靠墙静蹲', d: '一组就够，动起来就算数。', min: 5, scene: 'home', type: 'sport', cat: 'sport' },
  { t: '写下今天最想记住的一件事', d: '一句话就够，写进手账里。', min: 5, scene: 'home', type: 'relax', cat: 'other' },
  { t: '清空钱包里的 receipt 纸片', d: '顺手把小票和废纸清理掉，钱包恢复清爽。', min: 5, scene: 'home', type: 'tidy', cat: 'tidy' },
  { t: '在门口放好明天要带的东西', d: '明早出门不慌张的秘密。', min: 5, scene: 'home', type: 'tidy', cat: 'work' },
  { t: '读几页一直想读的书', d: '不求快，读进去两三页就算赢。', min: 15, scene: 'home', type: 'study', cat: 'study' },
  { t: '跟着视频拉伸十分钟', d: '肩颈和腰会感谢你。', min: 15, scene: 'home', type: 'sport', cat: 'sport' },
  { t: '收拾一个抽屉', d: '只整理一个，不要贪多，整理完就停。', min: 15, scene: 'home', type: 'tidy', cat: 'tidy' },
  { t: '给自己认真做一份水果盘', d: '切两三种水果摆个盘，当作下午茶。', min: 15, scene: 'home', type: 'relax', cat: 'cook' },
  { t: '写一段今天的三行日记', d: '今天发生的三件小事，每件一行。', min: 15, scene: 'home', type: 'relax', cat: 'other' },
  { t: '背 10 个外语单词', d: '用 App 或单词书都行，10 个就收工。', min: 15, scene: 'home', type: 'study', cat: 'study' },
  { t: '听一期感兴趣的播客', d: '挑个轻松的话题，边听边做点手工活。', min: 15, scene: 'home', type: 'relax', cat: 'hobby' },
  { t: '把明天的三件要事写下来', d: '只写三件，写完今晚就安心了。', min: 15, scene: 'home', type: 'study', cat: 'work' },
  { t: '给自己做一顿简单晚饭', d: '一个主菜一个青菜就很好，做完记录下来。', min: 30, scene: 'home', type: 'tidy', cat: 'cook' },
  { t: '跟着教程画个小东西', d: '简笔画、水彩、板绘都行，画完发不发随你。', min: 30, scene: 'home', type: 'study', cat: 'hobby' },
  { t: '做一次完整的大扫除角落', d: '这次选一个“重灾区”，比如冰箱或衣柜顶层。', min: 30, scene: 'home', type: 'tidy', cat: 'tidy' },
  { t: '看一集纪录片', d: '挑个感兴趣的领域，看完记一句话。', min: 30, scene: 'home', type: 'study', cat: 'study' },
  { t: '练字或抄写十五分钟', d: '抄什么都行，重要的是手在动、心在静。', min: 30, scene: 'home', type: 'relax', cat: 'hobby' },
  { t: '做 30 分钟力量或瑜伽', d: '跟练视频即可，结束后好好拉伸。', min: 30, scene: 'home', type: 'sport', cat: 'sport' },
  { t: '复盘本周的花销', d: '打开账本看看本周支出，给下周定个小预算。', min: 30, scene: 'home', type: 'study', cat: 'finance' },
  { t: '给房间换一个角落的布置', d: '挪挪椅子、换个摆件，房间就有新空气。', min: 30, scene: 'home', type: 'tidy', cat: 'tidy' },
  { t: '整理电脑桌面和下载文件夹', d: '把桌面清空、下载夹归档，数字空间也要呼吸。', min: 30, scene: 'home', type: 'tidy', cat: 'work' },
  { t: '做一次深度阅读', d: '关掉通知，读 60 分钟难一点的内容，做点笔记。', min: 60, scene: 'home', type: 'study', cat: 'study' },
  { t: '做一个完整的手工/模型/拼图', d: '给自己留一整个小时，专注做完一个小作品。', min: 60, scene: 'home', type: 'relax', cat: 'hobby' },
  { t: '好好做一顿大餐', d: '挑战一道新菜，从备菜到摆盘，做完拍照留念。', min: 60, scene: 'home', type: 'tidy', cat: 'cook' },
  { t: '全身拉伸加泡脚', d: '运动后拉伸，再用热水泡脚，给自己的身体道谢。', min: 60, scene: 'home', type: 'relax', cat: 'health' },
  { t: '整理照片并做本月相册', d: '把手机相册整理一遍，把最好的几张收进本月合集。', min: 60, scene: 'home', type: 'tidy', cat: 'hobby' },
  { t: '早睡一小时', d: '今晚提前一小时上床，手机放远一点。', min: 60, scene: 'home', type: 'relax', cat: 'health' },
  { t: '出门散步十五分钟', d: '小区里、街边都行，不带目的地走一走。', min: 15, scene: 'out', type: 'sport', cat: 'sport' },
  { t: '去附近的公园坐一会儿', d: '看人、看树、看狗，发十五分钟呆。', min: 15, scene: 'out', type: 'relax', cat: 'health' },
  { t: '拍三张今天路过的光影', d: '今天的光很特别吗？拍下来就知道。', min: 15, scene: 'out', type: 'relax', cat: 'hobby' },
  { t: '去菜市场或超市买点新鲜食材', d: '顺便想想今晚吃什么，生活气息最浓的地方。', min: 15, scene: 'out', type: 'tidy', cat: 'cook' },
  { t: '给自己买一小束花', d: '不必理由，桌上有花的日子会亮一点。', min: 15, scene: 'out', type: 'relax', cat: 'hobby' },
  { t: '和朋友约个电话', d: '边走边聊，十五分钟也够叙旧。', min: 15, scene: 'out', type: 'social', cat: 'social' },
  { t: '走一条没走过的近路回家', d: '绕开熟悉的路线，看看会有什么新发现。', min: 15, scene: 'out', type: 'relax', cat: 'sport' },
  { t: '在户外跑或快走 3 公里', d: '配速随意，跑完记得喝水。', min: 30, scene: 'out', type: 'sport', cat: 'sport' },
  { t: '逛一家没进过的店', d: '书店、杂货店、面包店都行，只逛不买也可以。', min: 30, scene: 'out', type: 'relax', cat: 'hobby' },
  { t: '去图书馆或自习室待一小时', d: '换个环境，效率翻倍。', min: 60, scene: 'out', type: 'study', cat: 'study' },
  { t: '城市漫步（Citywalk）一小时', d: '挑个老街区慢慢走，记录三处有趣的细节。', min: 60, scene: 'out', type: 'relax', cat: 'sport' },
  { t: '看一场日落', d: '查好日落时间，提前十分钟到高处或开阔处。', min: 30, scene: 'out', type: 'relax', cat: 'health' },
  { t: '陪家人认真吃一顿饭', d: '不看电视不看手机，就好好吃饭聊天。', min: 60, scene: 'out', type: 'social', cat: 'social' },
  { t: '去户外骑一次车', d: '沿河边或绿道骑一个小时，风很值钱。', min: 60, scene: 'out', type: 'sport', cat: 'sport' },
  { t: '约朋友打一场球', d: '羽毛球、篮球、乒乓球都行，动完记得拉伸。', min: 60, scene: 'out', type: 'sport', cat: 'sport' },
];

// ---- 徽章 120 枚 ----
const gt = (v, n) => v >= n;
const S_of = (S, c) => S.catStats[c] || { count: 0, min: 0, days: new Set() };

function B(id, series, name, cond, points, check) { return { id, series, name, cond, points, check }; }
const SPORT = 'sport', COOK = 'cook', TIDY = 'tidy';

export const BADGES = [
  // 初见启程（10）
  B('A001', '初见启程', '第一步', '完成本机建档', 20, (S) => S.onboarded),
  B('A002', '初见启程', '勾掉第一件', '首次完成任务', 10, (S) => S.firstTask),
  B('A003', '初见启程', '随手有迹', '首次使用快捷记录', 10, (S) => S.firstQuick),
  B('A004', '初见启程', '开始专注', '首次保存≥15分钟专注', 15, (S) => S.firstFocus15),
  B('A005', '初见启程', '习惯萌芽', '首次创建习惯', 10, (S) => S.firstHabitCreated),
  B('A006', '初见启程', '今天做到', '首次完成习惯', 15, (S) => S.firstHabitDone),
  B('A007', '初见启程', '目标启航', '首次创建目标', 10, (S) => S.firstGoalCreated),
  B('A008', '初见启程', '第一笔', '首次保存一笔账', 10, (S) => S.firstLedger),
  B('A009', '初见启程', '写给今天', '首次保存手账', 10, (S) => S.firstJournal),
  B('A010', '初见启程', '回望一周', '首次查看并确认一份周回顾', 20, (S) => S.firstWeekReview),
  // 专注书房（10）
  B('A011', '专注书房', '一小时', '累计有效专注1小时', 10, (S) => gt(S.focusMin, 60)),
  B('A012', '专注书房', '三小时', '累计有效专注3小时', 15, (S) => gt(S.focusMin, 180)),
  B('A013', '专注书房', '五小时', '累计有效专注5小时', 20, (S) => gt(S.focusMin, 300)),
  B('A014', '专注书房', '十小时', '累计有效专注10小时', 25, (S) => gt(S.focusMin, 600)),
  B('A015', '专注书房', '二十小时', '累计有效专注20小时', 30, (S) => gt(S.focusMin, 1200)),
  B('A016', '专注书房', '三十小时', '累计有效专注30小时', 35, (S) => gt(S.focusMin, 1800)),
  B('A017', '专注书房', '五十小时', '累计有效专注50小时', 45, (S) => gt(S.focusMin, 3000)),
  B('A018', '专注书房', '百小时', '累计有效专注100小时', 60, (S) => gt(S.focusMin, 6000)),
  B('A019', '专注书房', '二百小时', '累计有效专注200小时', 80, (S) => gt(S.focusMin, 12000)),
  B('A020', '专注书房', '一年之光', '累计有效专注365小时', 120, (S) => gt(S.focusMin, 21900)),
  // 步履微光（10）
  B('A021', '步履微光', '出门走走', '首次记录运动/散步', 10, (S) => S_of(S, SPORT).count >= 1),
  B('A022', '步履微光', '五次脚印', '累计记录运动/散步5次', 15, (S) => S_of(S, SPORT).count >= 5),
  B('A023', '步履微光', '十次脚印', '累计记录运动/散步10次', 20, (S) => S_of(S, SPORT).count >= 10),
  B('A024', '步履微光', '二十五次', '累计记录运动/散步25次', 25, (S) => S_of(S, SPORT).count >= 25),
  B('A025', '步履微光', '五十次', '累计记录运动/散步50次', 30, (S) => S_of(S, SPORT).count >= 50),
  B('A026', '步履微光', '一千分钟', '累计运动/散步1000分钟', 35, (S) => S_of(S, SPORT).min >= 1000),
  B('A027', '步履微光', '两千五百分钟', '累计运动/散步2500分钟', 45, (S) => S_of(S, SPORT).min >= 2500),
  B('A028', '步履微光', '五千分钟', '累计运动/散步5000分钟', 60, (S) => S_of(S, SPORT).min >= 5000),
  B('A029', '步履微光', '一万分钟', '累计运动/散步10000分钟', 80, (S) => S_of(S, SPORT).min >= 10000),
  B('A030', '步履微光', '百日步履', '在100个不同日期留下运动/散步记录', 120, (S) => S_of(S, SPORT).days.size >= 100),
  // 烟火厨房（10）
  B('A031', '烟火厨房', '开火啦', '首次记录自己做饭', 10, (S) => S_of(S, COOK).count >= 1),
  B('A032', '烟火厨房', '三餐有味', '累计做饭3次', 15, (S) => S_of(S, COOK).count >= 3),
  B('A033', '烟火厨房', '十顿烟火', '累计做饭10次', 20, (S) => S_of(S, COOK).count >= 10),
  B('A034', '烟火厨房', '二十五顿', '累计做饭25次', 25, (S) => S_of(S, COOK).count >= 25),
  B('A035', '烟火厨房', '五十顿', '累计做饭50次', 35, (S) => S_of(S, COOK).count >= 50),
  B('A036', '烟火厨房', '百味日常', '累计做饭100次', 60, (S) => S_of(S, COOK).count >= 100),
  B('A037', '烟火厨房', '七日厨房', '在7个不同日期记录做饭', 20, (S) => S_of(S, COOK).days.size >= 7),
  B('A038', '烟火厨房', '三十日厨房', '在30个不同日期记录做饭', 40, (S) => S_of(S, COOK).days.size >= 30),
  B('A039', '烟火厨房', '六十日厨房', '在60个不同日期记录做饭', 70, (S) => S_of(S, COOK).days.size >= 60),
  B('A040', '烟火厨房', '百日厨房', '在100个不同日期记录做饭', 120, (S) => S_of(S, COOK).days.size >= 100),
  // 整洁小屋（10）
  B('A041', '整洁小屋', '顺手收拾', '首次完成家务/整理记录', 10, (S) => S_of(S, TIDY).count >= 1),
  B('A042', '整洁小屋', '五次整理', '累计完成家务/整理5次', 15, (S) => S_of(S, TIDY).count >= 5),
  B('A043', '整洁小屋', '十五次整理', '累计完成家务/整理15次', 20, (S) => S_of(S, TIDY).count >= 15),
  B('A044', '整洁小屋', '三十次整理', '累计完成家务/整理30次', 30, (S) => S_of(S, TIDY).count >= 30),
  B('A045', '整洁小屋', '六十次整理', '累计完成家务/整理60次', 45, (S) => S_of(S, TIDY).count >= 60),
  B('A046', '整洁小屋', '百次整理', '累计完成家务/整理100次', 70, (S) => S_of(S, TIDY).count >= 100),
  B('A047', '整洁小屋', '清单新手', '首次完成一整张生活清单', 15, (S) => S.checklistDone >= 1),
  B('A048', '整洁小屋', '清单达人', '累计完成20张生活清单', 35, (S) => S.checklistDone >= 20),
  B('A049', '整洁小屋', '清单管家', '累计完成50张生活清单', 60, (S) => S.checklistDone >= 50),
  B('A050', '整洁小屋', '井井有条', '累计完成100张生活清单', 120, (S) => S.checklistDone >= 100),
  // 心绪花笺（10）
  B('A051', '心绪花笺', '写下一句', '首次保存生活手账', 10, (S) => S.journalDays.size >= 1),
  B('A052', '心绪花笺', '三页心情', '在3个不同日期写手账', 15, (S) => S.journalDays.size >= 3),
  B('A053', '心绪花笺', '七页心情', '在7个不同日期写手账', 20, (S) => S.journalDays.size >= 7),
  B('A054', '心绪花笺', '十五页心情', '在15个不同日期写手账', 25, (S) => S.journalDays.size >= 15),
  B('A055', '心绪花笺', '三十页心情', '在30个不同日期写手账', 35, (S) => S.journalDays.size >= 30),
  B('A056', '心绪花笺', '六十页心情', '在60个不同日期写手账', 50, (S) => S.journalDays.size >= 60),
  B('A057', '心绪花笺', '百页心情', '在100个不同日期写手账', 80, (S) => S.journalDays.size >= 100),
  B('A058', '心绪花笺', '照片记忆', '累计保存50篇带照片手账', 60, (S) => S.journalPhotoCount >= 50),
  B('A059', '心绪花笺', '十二次月望', '完成12次月度回顾', 80, (S) => S.monthReviewCount >= 12),
  B('A060', '心绪花笺', '一年手账', '在365个不同日期留下手账', 150, (S) => S.journalDays.size >= 365),
  // 目标远航（10）
  B('A061', '目标远航', '立下目标', '首次创建目标', 10, (S) => S.goalCreated >= 1),
  B('A062', '目标远航', '第一座航标', '首次完成一个目标里程碑', 15, (S) => S.milestoneDone >= 1),
  B('A063', '目标远航', '抵达一次', '首次完成完整目标', 20, (S) => S.goalDone >= 1),
  B('A064', '目标远航', '三次抵达', '累计完成3个目标', 30, (S) => S.goalDone >= 3),
  B('A065', '目标远航', '五次抵达', '累计完成5个目标', 40, (S) => S.goalDone >= 5),
  B('A066', '目标远航', '十次抵达', '累计完成10个目标', 60, (S) => S.goalDone >= 10),
  B('A067', '目标远航', '二十五次抵达', '累计完成25个目标', 80, (S) => S.goalDone >= 25),
  B('A068', '目标远航', '五十次抵达', '累计完成50个目标', 120, (S) => S.goalDone >= 50),
  B('A069', '目标远航', '拆解高手', '完成一个含≥5个步骤的目标', 30, (S) => S.goalWith5StepsDone >= 1),
  B('A070', '目标远航', '百座航标', '累计完成100个目标里程碑', 150, (S) => S.milestoneDone >= 100),
  // 收支有序（10）
  B('A071', '收支有序', '记下第一笔', '首次保存账目', 10, (S) => S.ledgerDays.size >= 1),
  B('A072', '收支有序', '三日有账', '在3个不同日期记账', 15, (S) => S.ledgerDays.size >= 3),
  B('A073', '收支有序', '七日有账', '在7个不同日期记账', 20, (S) => S.ledgerDays.size >= 7),
  B('A074', '收支有序', '三十日有账', '在30个不同日期记账', 35, (S) => S.ledgerDays.size >= 30),
  B('A075', '收支有序', '百日有账', '在100个不同日期记账', 70, (S) => S.ledgerDays.size >= 100),
  B('A076', '收支有序', '三百笔', '累计记录300笔账目', 60, (S) => S.ledgerCount >= 300),
  B('A077', '收支有序', '预算初见', '首次设置月度预算', 15, (S) => S.budgetSet),
  B('A078', '收支有序', '三月复盘', '完成3个月度账本回顾', 30, (S) => S.ledgerReviewMonths.size >= 3),
  B('A079', '收支有序', '十二月复盘', '完成12个月度账本回顾', 80, (S) => S.ledgerReviewMonths.size >= 12),
  B('A080', '收支有序', '千笔成册', '累计记录1000笔账目', 150, (S) => S.ledgerCount >= 1000),
  // 伙伴物语（10）
  B('A081', '伙伴物语', '你好伙伴', '首次领取宠物', 20, (S) => S.petOwned),
  B('A082', '伙伴物语', '有了名字', '首次为宠物命名', 10, (S) => S.petNamed),
  B('A083', '伙伴物语', '第一口', '首次给宠物使用食物', 10, (S) => S.petFoodUsed),
  B('A084', '伙伴物语', '一起玩', '首次使用互动玩具', 10, (S) => S.petToyUsed),
  B('A085', '伙伴物语', '十次互动', '累计完成10次宠物互动', 15, (S) => S.petInteractions >= 10),
  B('A086', '伙伴物语', '五十次互动', '累计完成50次宠物互动', 30, (S) => S.petInteractions >= 50),
  B('A087', '伙伴物语', '熟悉彼此', '宠物达到成长阶段2', 25, (S) => S.petMaxStage >= 2),
  B('A088', '伙伴物语', '默契伙伴', '宠物达到成长阶段3', 40, (S) => S.petMaxStage >= 3),
  B('A089', '伙伴物语', '长久陪伴', '宠物达到成长阶段4', 70, (S) => S.petMaxStage >= 4),
  B('A090', '伙伴物语', '一路同行', '宠物达到成长阶段5', 120, (S) => S.petMaxStage >= 5),
  // 家园收藏（10）
  B('A091', '家园收藏', '第一件礼物', '首次在商城兑换商品', 10, (S) => S.shopPurchases >= 1),
  B('A092', '家园收藏', '换个样子', '首次装备宠物装扮', 10, (S) => S.outfitEquipped),
  B('A093', '家园收藏', '添件家具', '首次摆放家园家具', 10, (S) => S.furniturePlaced),
  B('A094', '家园收藏', '五件收藏', '拥有5件永久商品', 15, (S) => S.permItems >= 5),
  B('A095', '家园收藏', '十件收藏', '拥有10件永久商品', 20, (S) => S.permItems >= 10),
  B('A096', '家园收藏', '二十件收藏', '拥有20件永久商品', 30, (S) => S.permItems >= 20),
  B('A097', '家园收藏', '三十件收藏', '拥有30件永久商品', 45, (S) => S.permItems >= 30),
  B('A098', '家园收藏', '四十件收藏', '拥有40件永久商品', 60, (S) => S.permItems >= 40),
  B('A099', '家园收藏', '徽章展柜', '在个人展示栏摆满10枚徽章', 40, (S) => S.showcaseCount >= 10),
  B('A100', '家园收藏', '系列收藏家', '首次完整收集一个徽章系列', 120, (S) => S.seriesComplete >= 1),
  // 四季印记（10）
  B('A101', '四季印记', '三月有迹', '在3个不同自然月留下有效生活记录', 20, (S) => S.months.size >= 3),
  B('A102', '四季印记', '六月有迹', '在6个不同自然月留下有效生活记录', 30, (S) => S.months.size >= 6),
  B('A103', '四季印记', '九月有迹', '在9个不同自然月留下有效生活记录', 45, (S) => S.months.size >= 9),
  B('A104', '四季印记', '十二月有迹', '在12个不同自然月留下有效生活记录', 70, (S) => S.months.size >= 12),
  B('A105', '四季印记', '春日留痕', '3–5月任意一天留下有效记录', 10, (S) => S.seasons.spring),
  B('A106', '四季印记', '夏日留痕', '6–8月任意一天留下有效记录', 10, (S) => S.seasons.summer),
  B('A107', '四季印记', '秋日留痕', '9–11月任意一天留下有效记录', 10, (S) => S.seasons.autumn),
  B('A108', '四季印记', '冬日留痕', '12–2月任意一天留下有效记录', 10, (S) => S.seasons.winter),
  B('A109', '四季印记', '百日有迹', '在100个不同日期留下任一有效生活记录', 80, (S) => S.days.size >= 100),
  B('A110', '四季印记', '三百六十五日', '在365个不同日期留下任一有效生活记录', 180, (S) => S.days.size >= 365),
  // 生活全景（10）
  B('A111', '生活全景', '三面生活', '在3个不同生活分类中留下有效记录', 15, (S) => S.cats.size >= 3),
  B('A112', '生活全景', '五面生活', '在5个不同生活分类中留下有效记录', 25, (S) => S.cats.size >= 5),
  B('A113', '生活全景', '七面生活', '在7个不同生活分类中留下有效记录', 40, (S) => S.cats.size >= 7),
  B('A114', '生活全景', '九面生活', '在9个不同生活分类中留下有效记录', 60, (S) => S.cats.size >= 9),
  B('A115', '生活全景', '七日充实', '在7个不同日期完成任一有效事项', 20, (S) => S.days.size >= 7),
  B('A116', '生活全景', '三十日充实', '在30个不同日期完成任一有效事项', 40, (S) => S.days.size >= 30),
  B('A117', '生活全景', '百日充实', '在100个不同日期完成任一有效事项', 80, (S) => S.days.size >= 100),
  B('A118', '生活全景', '一年生活家', '在365个不同日期完成任一有效事项', 180, (S) => S.days.size >= 365),
  B('A119', '生活全景', '三十枚徽章', '累计解锁30枚徽章', 60, (S) => S.badgeCount >= 30),
  B('A120', '生活全景', '六十枚徽章', '累计解锁60枚徽章', 120, (S) => S.badgeCount >= 60),
];

export const BADGE_SERIES = [...new Set(BADGES.map((b) => b.series))];
export const badgeById = (id) => BADGES.find((b) => b.id === id);
// 徽章稀有度：按奖励积分分档
export function badgeRarity(points) {
  if (points >= 60) return { name: '史诗', stars: 3 };
  if (points >= 30) return { name: '稀有', stars: 2 };
  if (points >= 15) return { name: '优良', stars: 1 };
  return { name: '普通', stars: 0 };
}

// ---- 商城 60 件 ----
// unlock: null=默认可购 / {stage:N} 宠物阶段 / {badges:N} 徽章数 / {series:true} 完成任一系列
function Sg(id, cat, name, price, type, unlock, desc) { return { id, cat, name, price, type, unlock: unlock || null, desc }; }
export const SHOP_CATS = [
  { id: 'food', name: '食物' }, { id: 'toy', name: '玩具' },
];
export const SHOP = [
  Sg('S001', 'food', '小鱼饼干', 25, 'consumable', null, '香香脆脆，团团的最爱。'),
  Sg('S002', 'food', '胡萝卜脆片', 30, 'consumable', null, '咔嚓咔嚓，米团耳朵会立起来。'),
  Sg('S003', 'food', '牛奶布丁', 35, 'consumable', null, '摇摇晃晃的甜点。'),
  Sg('S004', 'food', '莓果酸奶', 40, 'consumable', null, '酸酸甜甜，饭后刚刚好。'),
  Sg('S005', 'food', '蜂蜜吐司', 45, 'consumable', null, '抹上厚厚一层蜂蜜。'),
  Sg('S006', 'food', '云朵棉花糖', 50, 'consumable', null, '入口即化，像云一样。'),
  Sg('S007', 'food', '南瓜浓汤', 55, 'consumable', { stage: 2 }, '暖胃又暖心。'),
  Sg('S008', 'food', '芝士饭团', 60, 'consumable', { stage: 2 }, '烤过之后拉丝的饭团。'),
  Sg('S009', 'food', '星星曲奇', 70, 'consumable', { stage: 2 }, '切成星星形状的小饼干。'),
  Sg('S010', 'food', '苹果派', 80, 'consumable', { stage: 3 }, '刚出炉的苹果派最香。'),
  Sg('S011', 'food', '暖冬可可', 90, 'consumable', { stage: 3 }, '加两颗棉花糖的热可可。'),
  Sg('S012', 'food', '纪念蛋糕', 120, 'consumable', { badges: 30 }, '值得纪念的日子才舍得吃的蛋糕。'),
  Sg('S013', 'toy', '毛线球', 80, 'perm', null, '滚来滚去，永远追不完。'),
  Sg('S014', 'toy', '纸飞机', 90, 'perm', null, '掷出去，飞一圈又回来。'),
  Sg('S015', 'toy', '小铃铛', 100, 'perm', null, '叮铃一响，宠物就会跑过来。'),
  Sg('S016', 'toy', '木质积木', 120, 'perm', { stage: 2 }, '搭起来推倒，再搭起来。'),
  Sg('S017', 'toy', '泡泡机', 150, 'perm', { stage: 2 }, '呼噜噜吹出一串泡泡。'),
  Sg('S018', 'toy', '小风车', 170, 'perm', { stage: 2 }, '迎着风呼呼地转。'),
  Sg('S019', 'toy', '星球摇铃', 220, 'perm', { stage: 3 }, '摇一摇，有细碎的星光声。'),
  Sg('S020', 'toy', '露营飞盘', 260, 'perm', { stage: 3 }, '扔出去，接回来的快乐。'),
  Sg('S021', 'outfit', '格纹领巾', 120, 'perm', null, '系上以后很有学问的样子。'),
  Sg('S022', 'outfit', '柠檬发夹', 130, 'perm', null, '别在耳边，甜度 +1。'),
  Sg('S023', 'outfit', '小圆帽', 150, 'perm', null, '戴稳了，出门咯。'),
  Sg('S024', 'outfit', '蓝白水手巾', 170, 'perm', { stage: 2 }, '海风的味道。'),
  Sg('S025', 'outfit', '秋日贝雷帽', 190, 'perm', { stage: 2 }, '微微歪着戴最好看。'),
  Sg('S026', 'outfit', '小雨衣', 220, 'perm', { stage: 2 }, '下雨天也想出去玩。'),
  Sg('S027', 'outfit', '星星睡帽', 240, 'perm', { stage: 3 }, '戴上一觉到天亮。'),
  Sg('S028', 'outfit', '红色围巾', 260, 'perm', { stage: 3 }, '冬天限定的心意。'),
  Sg('S029', 'outfit', '邮差小包', 300, 'perm', { stage: 3 }, '里面装着今天的好消息。'),
  Sg('S030', 'outfit', '云朵披肩', 340, 'perm', { badges: 30 }, '软软地披在肩上。'),
  Sg('S031', 'outfit', '月亮皇冠', 420, 'perm', { badges: 60 }, '收藏家的荣耀。'),
  Sg('S032', 'outfit', '周年纪念礼服', 600, 'perm', { stage: 5 }, '同行的证明。'),
  Sg('S033', 'furniture', '软垫小床', 140, 'perm', null, '宠物休息的固定位置。'),
  Sg('S034', 'furniture', '木头食盆', 150, 'perm', null, '吃饭要有仪式感。'),
  Sg('S035', 'furniture', '矮脚书架', 180, 'perm', null, '放着几本翻旧了的书。'),
  Sg('S036', 'furniture', '窗边绿植', 190, 'perm', null, '偶尔需要浇水的伙伴。'),
  Sg('S037', 'furniture', '暖光台灯', 210, 'perm', { stage: 2 }, '夜里亮着一小块暖黄。'),
  Sg('S038', 'furniture', '圆形地毯', 230, 'perm', { stage: 2 }, '踩上去软软的。'),
  Sg('S039', 'furniture', '小茶几', 250, 'perm', { stage: 2 }, '放一杯茶刚刚好。'),
  Sg('S040', 'furniture', '收纳木箱', 280, 'perm', { stage: 2 }, '乱七八糟都收进去。'),
  Sg('S041', 'furniture', '复古挂钟', 300, 'perm', { stage: 3 }, '滴答滴答，提醒你时间在走。'),
  Sg('S042', 'furniture', '照片墙', 340, 'perm', { stage: 3 }, '贴满值得记住的瞬间。'),
  Sg('S043', 'furniture', '懒人沙发', 380, 'perm', { stage: 3 }, '坐下去就不想起来。'),
  Sg('S044', 'furniture', '唱片柜', 420, 'perm', { badges: 30 }, '周末放一张老唱片。'),
  Sg('S045', 'furniture', '壁炉摆件', 500, 'perm', { badges: 60 }, '不用点火也暖烘烘。'),
  Sg('S046', 'furniture', '纪念展柜', 700, 'perm', { series: true }, '用来陈列最重要的纪念物。'),
  Sg('S047', 'bg', '晨光房间', 220, 'perm', null, '清晨的阳光斜斜地照进来。'),
  Sg('S048', 'bg', '午后窗边', 240, 'perm', null, '下午三点的窗帘被风吹起。'),
  Sg('S049', 'bg', '雨天小屋', 260, 'perm', { stage: 2 }, '听雨声最适合发呆。'),
  Sg('S050', 'bg', '晚霞露台', 280, 'perm', { stage: 2 }, '天空是橘子汽水的颜色。'),
  Sg('S051', 'bg', '夜灯书房', 320, 'perm', { stage: 3 }, '只开一盏台灯的深夜。'),
  Sg('S052', 'bg', '春日庭院', 360, 'perm', { badges: 30 }, '花瓣落在木地板上。'),
  Sg('S053', 'bg', '秋日木屋', 420, 'perm', { badges: 60 }, '落叶堆好了，就等宠物跳进去。'),
  Sg('S054', 'bg', '星空露营', 500, 'perm', { stage: 5 }, '帐篷外面是整片银河。'),
  Sg('S055', 'display', '木纹徽章框', 100, 'perm', null, '把徽章挂在木纹相框里。'),
  Sg('S056', 'display', '奶油徽章框', 120, 'perm', null, '奶油色的柔和衬边。'),
  Sg('S057', 'display', '黄铜徽章框', 160, 'perm', null, '黄铜色，衬珐琅徽章正合适。'),
  Sg('S058', 'display', '胶片回顾框', 180, 'perm', null, '像电影胶片一样的展示框。'),
  Sg('S059', 'display', '手账回顾框', 220, 'perm', { badges: 30 }, '带纸胶带装饰的框。'),
  Sg('S060', 'display', '周年典藏框', 400, 'perm', { badges: 60 }, '最高规格的典藏展示框。'),
];
export const shopById = (id) => SHOP.find((s) => s.id === id);

// ---- 商品解锁条件展示 ----
export function unlockText(item) {
  if (!item.unlock) return null;
  if (item.unlock.stage) return `宠物达到阶段${item.unlock.stage}解锁`;
  if (item.unlock.badges) return `累计解锁${item.unlock.badges}枚徽章后开放`;
  if (item.unlock.series) return '完成任一徽章系列后开放';
  return null;
}
export function isUnlocked(item, ctx) {
  if (!item.unlock) return true;
  if (item.unlock.stage) return (ctx.maxStage || 1) >= item.unlock.stage;
  if (item.unlock.badges) return (ctx.badgeCount || 0) >= item.unlock.badges;
  if (item.unlock.series) return (ctx.seriesComplete || 0) >= 1;
  return true;
}

// ---- 心情 ----
export const MOODS = [
  { id: 'great', name: '很棒', color: '#D8A94D' },
  { id: 'good', name: '不错', color: '#748F72' },
  { id: 'ok', name: '一般', color: '#8B8FA8' },
  { id: 'low', name: '有点低', color: '#7A8FB5' },
  { id: 'bad', name: '糟糕', color: '#C96868' },
];
export const moodById = (id) => MOODS.find((m) => m.id === id) || MOODS[2];
