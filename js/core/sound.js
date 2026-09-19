// 今天没白过 · 声效系统（WebAudio 本地合成，无外部音频文件）
let ctx = null, master = null;
let _muted = false, _vol = 0.7, _unlocked = false, _resumePromise = null;

export function initSound() {
  if (ctx && ctx.state !== 'closed') return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = _muted ? 0 : _vol;
    master.connect(ctx.destination);
    return ctx;
  } catch { ctx = null; master = null; return null; }
}

async function ensureRunning() {
  initSound();
  if (!ctx || _muted) return false;
  if (ctx.state === 'running') return true;
  if (ctx.state === 'closed') { ctx = null; master = null; initSound(); }
  if (!ctx) return false;
  if (!_resumePromise) {
    _resumePromise = Promise.resolve(ctx.resume()).catch(()=>{}).finally(()=>{ _resumePromise = null; });
  }
  await _resumePromise;
  return !!ctx && ctx.state === 'running';
}

// 必须在用户手势中至少调用一次。之后页面切换/回前台会尽量恢复同一个音频上下文。
export async function unlockAudio() {
  _unlocked = true;
  return ensureRunning();
}
export function setMuted(m) { _muted = !!m; if (master) master.gain.value = _muted ? 0 : _vol; if (!_muted && _unlocked) ensureRunning(); }
export function setVolume(v) { _vol = Math.max(0, Math.min(1, Number(v) / 100)); if (master && !_muted) master.gain.value = _vol; }
export function isMuted() { return _muted; }

function tone(freq, at, dur, { type = 'sine', gain = 0.3, slideTo = null } = {}) {
  if (!ctx || !master || ctx.state !== 'running') return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(master);
  o.start(at); o.stop(at + dur + 0.05);
}
function emit(name) {
  if (!ctx || ctx.state !== 'running' || _muted) return;
  const t = ctx.currentTime;
  switch (name) {
    case 'tap': tone(1180, t, 0.05, { type: 'triangle', gain: 0.14 }); break;
    case 'toggle': tone(720, t, 0.045, { type: 'triangle', gain: 0.13 }); break;
    case 'complete': tone(523, t, 0.12, { gain: 0.24 }); tone(784, t + 0.09, 0.16, { gain: 0.22 }); break;
    case 'points': tone(1318, t, 0.09, { type: 'triangle', gain: 0.2 }); tone(1568, t + 0.07, 0.12, { type: 'triangle', gain: 0.16 }); break;
    case 'badge': [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.09, 0.16, { gain: 0.2 })); tone(2093, t + 0.38, 0.3, { type: 'triangle', gain: 0.1 }); break;
    case 'goal': [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.11, 0.22, { gain: 0.2 })); tone(1318, t + 0.56, 0.4, { gain: 0.14 }); break;
    case 'purchase': tone(660, t, 0.08, { gain: 0.2 }); tone(880, t + 0.08, 0.14, { gain: 0.18 }); break;
    case 'pet': tone(520, t, 0.1, { gain: 0.14, slideTo: 640 }); tone(660, t + 0.1, 0.12, { gain: 0.1, slideTo: 580 }); break;
    case 'undo': tone(500, t, 0.1, { gain: 0.14, slideTo: 330 }); break;
    case 'error': tone(220, t, 0.16, { type: 'square', gain: 0.08 }); break;
    case 'pop': tone(880, t, 0.05, { type: 'triangle', gain: 0.16 }); break;
    default: tone(880, t, 0.06, { type: 'triangle', gain: 0.12 });
  }
}
export function play(name) {
  if (_muted) return;
  // Safari may suspend AudioContext after backgrounding. Resume first, then play instead of dropping the sound.
  ensureRunning().then(ok => { if (ok) emit(name); });
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && _unlocked && !_muted) ensureRunning();
  });
  window.addEventListener?.('pageshow', () => { if (_unlocked && !_muted) ensureRunning(); });
}
