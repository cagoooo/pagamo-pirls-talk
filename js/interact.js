// 即時互動（文字雲／投票）共用模組：簡報頁、參與頁、成果紀錄頁都用這一份
// 沿用 akai-slide-interact 專案的資料庫規則：集合名稱「簡報代號_wordcloud_題號」「簡報代號_poll_題號」
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  initializeFirestore, collection, addDoc, doc, setDoc, onSnapshot, serverTimestamp, getDocsFromServer, getCountFromServer,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js?v=__BUILD_VERSION__';

// 集合名稱一律加簡報代號，避免跟其他場次的資料混在一起
// 彩排模式：網址加 ?test=1，資料存到另一組集合，不會混進 12/11 當晚的正式紀錄
export const TEST = /[?&]test=1\b/.test(location.search);
export const SLUG = TEST ? 'pgpirls1211test' : 'pgpirls1211';
if (TEST) {
  const tag = () => {
    const el = document.createElement('div');
    el.textContent = '🧪 彩排模式：資料不會算進正式紀錄';
    el.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99999;background:#7b3fa0;color:#fff;'
      + 'font:700 14px "Noto Sans TC",sans-serif;padding:6px 14px;border-radius:999px;box-shadow:0 4px 12px rgba(0,0,0,.2);pointer-events:none';
    document.body.appendChild(el);
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', tag) : tag();
}

export const WORDCLOUDS = {
  open: { q: '出一份閱讀題組，最花時間的是哪一步？', hint: '例如：找文章、打字、想選項…' },
  gain: { q: '今晚最有收穫的一個詞？', hint: '例如：一鍵送出、PIRLS、老師把關…' },
};

export const POLLS = {
  source: {
    q: '你最想先拿哪一種素材來出題？',
    options: [
      { id: 'a', label: '課本或電子書' },
      { id: 'b', label: '新聞報導' },
      { id: 'c', label: '學習單或 PDF' },
      { id: 'd', label: '部落格或繪本文章' },
      { id: 'e', label: '其他' },
    ],
  },
  rate: {
    q: '今晚的分享，你給幾顆星？',
    options: [
      { id: 'a', label: '⭐⭐⭐⭐⭐ 很有收穫' },
      { id: 'b', label: '⭐⭐⭐⭐ 有收穫' },
      { id: 'c', label: '⭐⭐⭐ 普通' },
      { id: 'd', label: '⭐⭐ 還好' },
      { id: 'e', label: '⭐ 沒什麼收穫' },
    ],
  },
  use: {
    q: '回去會用小幫手出題嗎？',
    options: [
      { id: 'a', label: '這週就裝起來用' },
      { id: 'b', label: '這學期會找機會用' },
      { id: 'c', label: '先觀望' },
      { id: 'd', label: '學校電腦不方便安裝' },
    ],
  },
};

const ready = !firebaseConfig.apiKey.startsWith('__');
// 自動偵測：網路擋住即時串流時，改用長輪詢維持即時推送
export const app = ready ? initializeApp(firebaseConfig) : null;
export const db = ready ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }) : null;
const auth = ready ? getAuth(app) : null;
export const isReady = () => ready;

/* 匿名身分：投票一人一票（文件名稱＝匿名登入編號，資料庫規則才擋得住改別人的票）；重新整理後編號不變 */
let firstUser = null;
let signing = null;
async function me() {
  if (!auth) throw new Error('尚未連線');
  if (!firstUser) firstUser = new Promise((resolve) => { const off = onAuthStateChanged(auth, (u) => { off(); resolve(u); }); });
  await firstUser;
  if (auth.currentUser) return auth.currentUser;
  signing = signing || signInAnonymously(auth).then((c) => c.user).finally(() => { signing = null; });
  return signing;
}

/* 連線狀態（畫面上的「即時同步中」燈號） */
const statusListeners = new Set();
let status = ready ? 'connecting' : 'offline';
export function onStatus(cb) { statusListeners.add(cb); cb(status); return () => statusListeners.delete(cb); }
function setStatus(s) { if (s !== status) { status = s; statusListeners.forEach((cb) => cb(s)); } }

/* 即時監聽＋省額度保險：onSnapshot 即時推送為主；回到前景或網路恢復時補抓；
 * 講台每 20 秒用計數查詢核對總數，數字對不上又沒收到推送才整批補抓 */
function liveQuery(ref, handle, { watchdog = false } = {}) {
  if (!db || !ref) { handle(null); return () => {}; }
  let lastSig = null;
  let lastServerSnap = 0;
  let lastRefresh = 0;
  let knownCount = null;
  const apply = (snap) => {
    const sig = snap.docs.map((d) => d.id + ':' + JSON.stringify(d.data())).join('|');
    if (sig !== lastSig) { lastSig = sig; handle(snap); }
  };
  const unsub = onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
    if (!snap.metadata.fromCache) lastServerSnap = Date.now();
    setStatus(snap.metadata.fromCache ? 'connecting' : 'live');
    apply(snap);
  }, (err) => { console.warn('即時監聽中斷', err); setStatus('retrying'); });
  const refresh = (force) => {
    if (!force && Date.now() - lastRefresh < 20000) return;
    lastRefresh = Date.now();
    getDocsFromServer(ref).then((snap) => { lastServerSnap = Date.now(); setStatus('live'); apply(snap); })
      .catch(() => setStatus('retrying'));
  };
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    setTimeout(() => { if (status !== 'live') refresh(); }, 6000);
  };
  const onOnline = () => refresh(true);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  let timer = null;
  if (watchdog) {
    timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      getCountFromServer(ref).then((r) => {
        const n = r.data().count;
        if (knownCount !== null && n !== knownCount && Date.now() - lastServerSnap > 20000) refresh(true);
        knownCount = n;
      }).catch(() => setStatus('retrying'));
    }, 20000);
  }
  return () => {
    unsub(); if (timer) clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onOnline);
  };
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 無痕模式可能不能存 */ } },
};

export async function submitWord(key, raw) {
  const word = String(raw || '').trim().slice(0, 20);
  if (!word || !db) return false;
  await addDoc(collection(db, `${SLUG}_wordcloud_${key}`), { word, created_at: serverTimestamp() });
  return true;
}

function countWords(snap) {
  const counts = {};
  snap.forEach((d) => {
    const w = String(d.data().word || '').trim();
    if (w) counts[w] = (counts[w] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

export function watchWords(key, cb, opts) {
  return liveQuery(db ? collection(db, `${SLUG}_wordcloud_${key}`) : null, (snap) => {
    if (!snap) return cb([], 0);
    cb(countWords(snap), snap.size);
  }, opts);
}

export const myVote = (key) => store.get(`${SLUG}_vote_${key}`);

export async function vote(key, opt) {
  if (!db) return false;
  const user = await me();
  await setDoc(doc(db, `${SLUG}_poll_${key}`, user.uid), { opt, updated_at: serverTimestamp() });
  store.set(`${SLUG}_vote_${key}`, opt);
  return true;
}

function countVotes(snap) {
  const counts = {};
  let total = 0;
  snap.forEach((d) => { const o = d.data().opt; counts[o] = (counts[o] || 0) + 1; total += 1; });
  return { counts, total, voters: snap.docs.map((d) => d.id) };
}

export function watchPoll(key, cb, opts) {
  return liveQuery(db ? collection(db, `${SLUG}_poll_${key}`) : null, (snap) => {
    if (!snap) return cb({}, 0);
    const { counts, total } = countVotes(snap);
    cb(counts, total);
  }, opts);
}

/* 成果紀錄頁用：一次讀取全部結果（不持續監聽） */
export async function readAll() {
  if (!db) throw new Error('尚未連線');
  const words = {};
  for (const key of Object.keys(WORDCLOUDS)) {
    const snap = await getDocsFromServer(collection(db, `${SLUG}_wordcloud_${key}`));
    words[key] = { list: countWords(snap), total: snap.size };
  }
  const polls = {};
  const voters = new Set();
  for (const key of Object.keys(POLLS)) {
    const snap = await getDocsFromServer(collection(db, `${SLUG}_poll_${key}`));
    const r = countVotes(snap);
    r.voters.forEach((v) => voters.add(v));
    polls[key] = { counts: r.counts, total: r.total };
  }
  return { words, polls, uniqueVoters: voters.size };
}
