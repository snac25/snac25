// =============================================
// app.js — SNAC 공용 로직 (수동/자동 공통 계산)
// =============================================

// Firestore
const db = firebase.firestore();


// ----------------------------------------------------
// 📌 옵션 불러오기 (17/18열 계산에 필요)
// ----------------------------------------------------
export async function loadOptions() {
    const snap = await db.collection("settings").doc("options").get();
    return snap.exists ? snap.data() : null;
}



// ----------------------------------------------------
// 📌 수동 입력 데이터(data 컬렉션)
// ----------------------------------------------------
export async function loadData() {
    const snap = await db.collection("data").orderBy("B").get();

    const list = [];
    snap.forEach(doc => list.push(doc.data()));
    return list;
}



// ----------------------------------------------------
// 📌 금지 목록 (숨김 목록) — 입력시트에서 관리하는 rowId
// ----------------------------------------------------
export async function loadHiddenRowIds() {
    const snap = await db.collection("hiddenRows").doc("input").get();
    return snap.exists ? snap.data().ids || [] : [];
}



// ----------------------------------------------------
// 📌 Sheet1 금지 목록 내용 표시용
// ----------------------------------------------------
export async function loadSheet1Data() {
    const snap = await db.collection("sheet1").orderBy("time").get();
    const list = [];
    snap.forEach(doc => list.push(doc.data()));
    return list;
}



// ----------------------------------------------------
// 📌 유틸 함수 — 문자열/숫자 normalize
// ----------------------------------------------------
function clean(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return v.toString();
    return v.toString().trim();
}



// ====================================================
// 🔥 17열(P) 등급 계산
// ----------------------------------------------------
// row = { H,I,J,L,M,N,C }
// options = Firestore 설정값
// ====================================================
export function calculateColumn17(row, options) {
    if (!options) return "";

    // 옵션 매핑
    const leagueGrades = options.leagueGrades || {};
    const hMinusMRange = options.hMinusMRange || {};
    const iValueRange = options.iValueRange || {};

    const H = parseFloat(clean(row.H));    // 초기 승 배당
    const M = parseFloat(clean(row.M));    // 라이브 승 배당
    const I = parseFloat(clean(row.I));    // 기준점
    const N = parseFloat(clean(row.N));    // 라이브 오버배당
    const J = parseFloat(clean(row.J));    // 기준 오버배당
    const L = parseFloat(clean(row.L));    // 75분 오버배당

    const league = clean(row.C).toUpperCase();

    // 기본 보호
    if (isNaN(H) || isNaN(M) || isNaN(I) || isNaN(N)) return "";

    // 1) 하락폭 계산 (H - M)
    const drop = (H - M).toFixed(2);

    // 2) 리그 등급 보정값
    const lg = leagueGrades[league] ?? 0;

    // 3) drop 등급
    let dropScore = 0;
    if (drop <= hMinusMRange.A) dropScore = 4;
    else if (drop <= hMinusMRange.B) dropScore = 3;
    else if (drop <= hMinusMRange.C) dropScore = 2;
    else dropScore = 1;

    // 4) 기준점 오버 배당 하락 판단 (J → L → N)
    let overDropScore = 0;
    if (!isNaN(J) && !isNaN(L)) {
        if (L < J) overDropScore = 2;
    }
    if (!isNaN(J) && !isNaN(N)) {
        if (N < J) overDropScore = 3;
    }

    // 5) I 기준점 등급
    const iGrade =
        I <= iValueRange.A ? 4 :
        I <= iValueRange.B ? 3 :
        I <= iValueRange.C ? 2 :
        1;

    // 총합 점수
    const total = dropScore + overDropScore + iGrade + lg;

    // 총점 → 등급
    if (total >= options.gradeScore.A_plus) return "A+";
    if (total >= options.gradeScore.A)      return "A";
    if (total >= options.gradeScore.B_plus) return "B+";
    if (total >= options.gradeScore.B)      return "B";
    if (total >= options.gradeScore.C)      return "C";
    if (total >= options.gradeScore.D)      return "D";

    return "";
}



// ====================================================
// 🔥 18열(Q) 승 등급 계산
// ----------------------------------------------------
// row = { H,K,M,C }
// options = Firestore 값
// → 결과값: 'o' 또는 ''
// ====================================================
export function calculateColumn18(row, options) {
    if (!options) return "";

    const H = parseFloat(clean(row.H));   // 초기 승
    const M = parseFloat(clean(row.M));   // 라이브 승
    const K = parseFloat(clean(row.K));   // 75분 승

    const league = clean(row.C).toUpperCase();
    const leagueGrades = options.leagueGrades || {};
    const winDropRange = options.winDropRange || {};

    if (isNaN(H) || isNaN(M)) return "";

    // 승 하락폭
    const drop = (H - M).toFixed(2);

    // 리그 보정
    const lg = leagueGrades[league] ?? 0;

    let score = 0;

    // 기준 점수
    if (drop <= winDropRange.A) score = 3;
    else if (drop <= winDropRange.B) score = 2;
    else if (drop <= winDropRange.C) score = 1;

    // 75분 K값이 더 낮으면 추가 점수
    if (!isNaN(K) && K < H) score += 1;

    // 리그 보정
    score += lg;

    if (score >= options.winScore.O) return "o";

    return "";
}
