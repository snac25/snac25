// =========================================================
// app.js — SNAC 공용 로직 (옵션/계산/Firestore I/O)
// - input.js / view.js / options.js 가 공통으로 import 해서 사용
// - Firebase 초기화는 firebase-config.js에서 하고, 여기서는 db만 가져옴
// =========================================================

import { db } from "./firebase-config.js";

import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ----------------------------
// Utils
// ----------------------------
const toStr = (v) => (v === null || v === undefined ? "" : String(v).trim());

const toNum = (v) => {
  const s = toStr(v);
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

const approxEq = (a, b, eps = 1e-6) =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;

const clampArray = (arr) => (Array.isArray(arr) ? arr : []);

const DEFAULT_OPTIONS = {
  // 17열(오버 등급)
  column17: {
    leagueGrades: ["A", "B", "C", "S"], // 리그등급 4개
    gradeMapping: {
      aPlus: {
        leagueGrades: ["A", "B", "C", "S"],
        jMinusNRange: { min: NaN, max: NaN },
        hMinusMRange: { min: NaN, max: NaN },
        mValueRange: { min: NaN, max: NaN },
        iValueRange: { min: NaN, max: NaN },
        jGreaterThanLGreaterThanN: false,
        lValue: NaN,
        nValue: NaN,
      },
      a: {
        leagueGrades: ["A", "B", "C", "S"],
        jMinusNRange: { min: NaN, max: NaN },
        hMinusMRange: { min: NaN, max: NaN },
        mValueRange: { min: NaN, max: NaN },
        iValueRange: { min: NaN, max: NaN },
        jGreaterThanLGreaterThanN: false,
        lValue: NaN,
        nValue: NaN,
      },
      bPlus: {
        leagueGrades: ["A", "B", "C", "S"],
        jMinusNRange: { min: NaN, max: NaN },
        hMinusMRange: { min: NaN, max: NaN },
        mValueRange: { min: NaN, max: NaN },
        iValueRange: { min: NaN, max: NaN },
        jGreaterThanLGreaterThanN: false,
        lValue: NaN,
        nValue: NaN,
      },
      b: {
        leagueGrades: ["A", "B", "C", "S"],
        jMinusNRange: { min: NaN, max: NaN },
        hMinusMRange: { min: NaN, max: NaN },
        mValueRange: { min: NaN, max: NaN },
        iValueRange: { min: NaN, max: NaN },
        jGreaterThanLGreaterThanN: false,
        lValue: NaN,
        nValue: NaN,
      },
      c: {
        leagueGrades: ["A", "B", "C", "S"],
        jMinusNRange: { min: NaN, max: NaN },
        hMinusMRange: { min: NaN, max: NaN },
        mValueRange: { min: NaN, max: NaN },
        iValueRange: { min: NaN, max: NaN },
        jGreaterThanLGreaterThanN: false,
        lValue: NaN,
        nValue: NaN,
      },
      d: {
        leagueGrades: ["A", "B", "C", "S"],
        jMinusNRange: { min: NaN, max: NaN },
        hMinusMRange: { min: NaN, max: NaN },
        mValueRange: { min: NaN, max: NaN },
        iValueRange: { min: NaN, max: NaN },
        jGreaterThanLGreaterThanN: false,
        lValue: NaN,
        nValue: NaN,
      },
    },
  },

  // 18열(승 체크)
  column18: {
    leagueBonus: { A: 2, B: 1, C: 0, S: 0 },
    winScore: { O: 4 },
    leagueGradeMapping: {
      A: {
        winDropRange: { A: 0.1, B: 0.2, C: 0.3 },
        winScore: { O: 4 },
        hGreaterThanKGreaterThanM: false,
        kValue: NaN,
        mValue: NaN,
        optionSet2: null,
      },
      B: {
        winDropRange: { A: 0.1, B: 0.2, C: 0.3 },
        winScore: { O: 4 },
        hGreaterThanKGreaterThanM: false,
        kValue: NaN,
        mValue: NaN,
        optionSet2: null,
      },
      C: {
        winDropRange: { A: 0.1, B: 0.2, C: 0.3 },
        winScore: { O: 4 },
        hGreaterThanKGreaterThanM: false,
        kValue: NaN,
        mValue: NaN,
        optionSet2: null,
      },
      S: {
        winDropRange: { A: 0.1, B: 0.2, C: 0.3 },
        winScore: { O: 4 },
        hGreaterThanKGreaterThanM: false,
        kValue: NaN,
        mValue: NaN,
        optionSet2: null,
      },
    },
  },
};

// =========================================================
// ✅ Alert (공통)
// =========================================================
export function showAlert(message, type = "info") {
  const el = document.getElementById("alertBox");
  if (el) {
    el.textContent = message;
    el.className = `alert ${type}`;
    el.style.display = "block";
    clearTimeout(showAlert._t);
    showAlert._t = setTimeout(() => {
      el.style.display = "none";
    }, 2500);
    return;
  }

  if (type === "error") console.error(message);
  else console.log(message);
  // alert()은 사용 안 함 (필요하면 여기서 켜기)
  // alert(message);
}

// =========================================================
// ✅ Options (settings/options)
// =========================================================
export async function loadOptions() {
  const ref = doc(db, "settings", "options");
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, DEFAULT_OPTIONS, { merge: true });
    return JSON.parse(JSON.stringify(DEFAULT_OPTIONS));
  }

  const data = snap.data() || {};
  data.column17 ??= JSON.parse(JSON.stringify(DEFAULT_OPTIONS.column17));
  data.column17.gradeMapping ??= JSON.parse(JSON.stringify(DEFAULT_OPTIONS.column17.gradeMapping));
  data.column17.leagueGrades ??= ["A", "B", "C", "S"];

  data.column18 ??= JSON.parse(JSON.stringify(DEFAULT_OPTIONS.column18));
  data.column18.leagueGradeMapping ??= JSON.parse(JSON.stringify(DEFAULT_OPTIONS.column18.leagueGradeMapping));
  data.column18.leagueBonus ??= JSON.parse(JSON.stringify(DEFAULT_OPTIONS.column18.leagueBonus));
  data.column18.winScore ??= JSON.parse(JSON.stringify(DEFAULT_OPTIONS.column18.winScore));

  return data;
}

export async function saveOptions(options) {
  const ref = doc(db, "settings", "options");
  await setDoc(ref, options, { merge: true });
  return true;
}

// =========================================================
// ✅ Column 17 (오버 등급) 계산
// =========================================================
export function calculateColumn17(row, options) {
  const opts = options?.column17;
  const gradeMapping = opts?.gradeMapping || {};
  const leagueGrade = toStr(row?.C).toUpperCase();

  const H = toNum(row?.H);
  const I = toNum(row?.I);
  const J = toNum(row?.J);
  const L = toNum(row?.L);
  const M = toNum(row?.M);
  const N = toNum(row?.N);

  const gradeOrder = ["aPlus", "a", "bPlus", "b", "c", "d"];
  const labelMap = { aPlus: "A+", a: "A", bPlus: "B+", b: "B", c: "C", d: "D" };

  const inRange = (value, range) => {
    const min = toNum(range?.min);
    const max = toNum(range?.max);
    if (!Number.isFinite(min) && !Number.isFinite(max)) return true;
    if (!Number.isFinite(value)) return true; // 값이 없으면 조건 제외
    if (Number.isFinite(min) && value < min) return false;
    if (Number.isFinite(max) && value > max) return false;
    return true;
  };

  for (const key of gradeOrder) {
    const conf = gradeMapping[key];
    if (!conf) continue;

    const allowedLeagues = clampArray(conf.leagueGrades)
      .map((x) => toStr(x).toUpperCase())
      .filter(Boolean);
    if (allowedLeagues.length > 0 && leagueGrade && !allowedLeagues.includes(leagueGrade)) continue;

    const jMinusN = Number.isFinite(J) && Number.isFinite(N) ? J - N : NaN;
    if (!inRange(jMinusN, conf.jMinusNRange)) continue;

    const hMinusM = Number.isFinite(H) && Number.isFinite(M) ? H - M : NaN;
    if (!inRange(hMinusM, conf.hMinusMRange)) continue;

    if (!inRange(M, conf.mValueRange)) continue;
    if (!inRange(I, conf.iValueRange)) continue;

    if (conf.jGreaterThanLGreaterThanN === true) {
      if (Number.isFinite(J) && Number.isFinite(L) && Number.isFinite(N)) {
        if (!(J > L && L > N)) continue;
      }
    }

    const lValue = toNum(conf.lValue);
    if (Number.isFinite(lValue) && Number.isFinite(L) && !approxEq(L, lValue)) continue;

    const nValue = toNum(conf.nValue);
    if (Number.isFinite(nValue) && Number.isFinite(N) && !approxEq(N, nValue)) continue;

    return labelMap[key] || "";
  }

  return "";
}

// =========================================================
// ✅ Column 18 (승 체크) 계산
// =========================================================
export function calculateColumn18(row, options) {
  const col18 = options?.column18 || {};
  const leagueGrade = toStr(row?.C).toUpperCase();

  const H = toNum(row?.H);
  const K = toNum(row?.K);
  const M = toNum(row?.M);

  const lgMap = col18.leagueGradeMapping || {};
  const conf = lgMap[leagueGrade] || lgMap.C || {};

  const leagueBonus = toNum(col18.leagueBonus?.[leagueGrade]);
  const baseBonus = Number.isFinite(leagueBonus) ? leagueBonus : 0;

  const scoreFromDrop = (drop, winDropRange) => {
    if (!Number.isFinite(drop)) return 0;
    const A = toNum(winDropRange?.A);
    const B = toNum(winDropRange?.B);
    const C = toNum(winDropRange?.C);

    if (Number.isFinite(A) && drop <= A) return 3;
    if (Number.isFinite(B) && drop <= B) return 2;
    if (Number.isFinite(C) && drop <= C) return 1;
    return 0;
  };

  const inRangeOrSkip = (value, range) => {
    const min = toNum(range?.min);
    const max = toNum(range?.max);
    if (!Number.isFinite(min) && !Number.isFinite(max)) return true;
    if (!Number.isFinite(value)) return true;
    if (Number.isFinite(min) && value < min) return false;
    if (Number.isFinite(max) && value > max) return false;
    return true;
  };

  const evalSet = (setConf) => {
    if (!setConf || typeof setConf !== "object") return false;

    let score = 0;

    const drop = Number.isFinite(H) && Number.isFinite(M) ? H - M : NaN;
    score += scoreFromDrop(drop, setConf.winDropRange);

    if (setConf.hGreaterThanKGreaterThanM === true) {
      if (Number.isFinite(H) && Number.isFinite(K) && Number.isFinite(M)) {
        if (!(H > K && K > M)) return false;
        score += 1;
      }
    }

    const kValue = toNum(setConf.kValue ?? setConf.kRange?.max);
    const mValue = toNum(setConf.mValue);
    if (Number.isFinite(kValue) && Number.isFinite(K) && K > kValue) return false;
    if (Number.isFinite(mValue) && Number.isFinite(M) && M > mValue) return false;

    if (!inRangeOrSkip(K, setConf.kValueRange)) return false;
    if (!inRangeOrSkip(M, setConf.mValueRange)) return false;

    score += baseBonus;

    const threshold = toNum(setConf.winScore?.O ?? col18.winScore?.O);
    const cut = Number.isFinite(threshold) ? threshold : 4;

    return score >= cut;
  };

  if (evalSet(conf)) return "o";
  if (evalSet(conf.optionSet2)) return "o";

  return "";
}

// =========================================================
// ✅ Data Collection (조회페이지가 보는 저장 데이터) — "data"
// =========================================================
function buildRowId(row) {
  return `${toStr(row?.B)}_${toStr(row?.C)}_${toStr(row?.D)}_${toStr(row?.E)}`;
}

export async function loadData() {
  const snap = await getDocs(collection(db, "data"));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  list.sort((a, b) => toStr(a.B).localeCompare(toStr(b.B)));
  return list;
}

export async function saveData(row) {
  const id = row?.id ? toStr(row.id) : buildRowId(row);
  const ref = doc(db, "data", id);
  await setDoc(ref, { ...row, id, updatedAt: serverTimestamp() }, { merge: true });
  return { id };
}

export async function saveDataBatch(rows) {
  const batch = writeBatch(db);

  rows.forEach((row) => {
    const id = row?.id ? toStr(row.id) : buildRowId(row);
    const ref = doc(db, "data", id);
    batch.set(ref, { ...row, id, updatedAt: serverTimestamp() }, { merge: true });
  });

  await batch.commit();
  return true;
}

export async function deleteData(id) {
  await deleteDoc(doc(db, "data", toStr(id)));
}

export async function deleteAllData() {
  const snap = await getDocs(collection(db, "data"));
  const docs = snap.docs;
  const chunkSize = 450;

  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = writeBatch(db);
    docs.slice(i, i + chunkSize).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return true;
}

// =========================================================
// ✅ Input Sheet 저장/불러오기 (자동저장용) — inputSheet/current
// =========================================================
export async function saveInputSheetData(rows, meta = {}) {
  const ref = doc(db, "inputSheet", "current");
  await setDoc(
    ref,
    {
      rows: Array.isArray(rows) ? rows : [],
      rowCount: meta.rowCount ?? (Array.isArray(rows) ? rows.length : 0),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return true;
}

export async function loadInputSheetData() {
  const ref = doc(db, "inputSheet", "current");
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : { rows: [], rowCount: 0 };
}

export function setupInputSheetListener(callback) {
  const ref = doc(db, "inputSheet", "current");
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return callback({ rows: [], rowCount: 0 });
    callback(snap.data());
  });
}

// =========================================================
// ✅ 금지 목록(sheet1) — sheet1/current
// =========================================================
export async function loadSheet1Data() {
  const ref = doc(db, "sheet1", "current");
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const d = snap.data() || {};
  return d.rows || d.data || [];
}

// =========================================================
// ✅ Hidden Row IDs — settings/hiddenRowIds
// =========================================================
export async function saveHiddenRowIds(ids) {
  const ref = doc(db, "settings", "hiddenRowIds");
  await setDoc(ref, { ids: Array.isArray(ids) ? ids : [], updatedAt: serverTimestamp() }, { merge: true });
  return true;
}

export async function loadHiddenRowIds() {
  const ref = doc(db, "settings", "hiddenRowIds");
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const d = snap.data() || {};
  return Array.isArray(d.ids) ? d.ids : [];
}

export function setupHiddenRowIdsListener(callback) {
  const ref = doc(db, "settings", "hiddenRowIds");
  return onSnapshot(ref, (snap) => {
    const ids = snap.exists() ? snap.data()?.ids : [];
    callback(Array.isArray(ids) ? ids : []);
  });
}

// =========================================================
// ✅ Accounts (로그인용) — settings/accounts
// (login.js는 window.loadAccounts()를 기다림)
// =========================================================
export async function saveAccounts(accounts) {
  const ref = doc(db, "settings", "accounts");
  await setDoc(
    ref,
    { accounts: Array.isArray(accounts) ? accounts : [], updatedAt: serverTimestamp() },
    { merge: true }
  );
  return true;
}

export async function loadAccounts() {
  const ref = doc(db, "settings", "accounts");
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const d = snap.data() || {};
  return Array.isArray(d.accounts) ? d.accounts : [];
}

export async function deleteAccount(userId) {
  const accounts = await loadAccounts();
  const next = accounts.filter((a) => toStr(a.userId) !== toStr(userId));
  await saveAccounts(next);
  return true;
}

// =========================================================
// ✅ 마이그레이션(현재는 no-op)
// =========================================================
export async function migrateRemoveOldFields() {
  return true;
}

// =========================================================
// window 노출(레거시/로그인 호환)
// =========================================================
window.loadAccounts = loadAccounts;
window.saveAccounts = saveAccounts;
window.deleteAccount = deleteAccount;
window.loadOptions = loadOptions;
window.saveOptions = saveOptions;
window.calculateColumn17 = calculateColumn17;
window.calculateColumn18 = calculateColumn18;
window.loadHiddenRowIds = loadHiddenRowIds;
window.saveHiddenRowIds = saveHiddenRowIds;
