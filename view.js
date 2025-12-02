// ===============================
// view.js — 수동 + 자동 통합 조회
// ===============================

// app.js 기능 import
import {
    loadOptions,
    calculateColumn17,
    calculateColumn18,
    loadData,           // 수동 입력 데이터
    loadHiddenRowIds    // 금지 목록
} from "./app.js";


// Firestore (자동 시트용)
const db = firebase.firestore();


// --------------------------------------------
// 📌 자동데이터 autoMatches 불러오기
// --------------------------------------------
async function loadAutoMatchesForView() {
    const snap = await db.collection("autoMatches").orderBy("startKST").get();

    const list = [];
    snap.forEach(doc => {
        const d = doc.data();
        list.push({
            source: "auto",
            B: d.startKST?.substring(11, 16) ?? "",
            C: d.leagueGrade ?? "",
            D: d.leagueName ?? "",
            E: d.homeTeam ?? "",
            F: d.awayTeam ?? "",
            G: d.favSide ?? "",
            H: d.favOddInitial ?? "",
            I: d.baseOverLine ?? "",
            J: d.baseOverOddInitial ?? "",
            K: d.oddWinAt75 ?? "",
            L: d.oddOverAt75 ?? "",
            M: d.oddWinLive ?? "",
            N: d.oddOverLive ?? "",
            updatedAt: d.updatedAt ?? null
        });
    });

    return list;
}


// --------------------------------------------
// 📌 조회 데이터 로딩: 수동 + 자동 병합
// --------------------------------------------
async function loadMergedData() {

    const manual = await loadData();                 // 기존 수동 데이터
    const auto = await loadAutoMatchesForView();     // 자동 데이터

    const merged = [];

    // 수동은 그대로 변환
    manual.forEach(m => {
        merged.push({
            source: "manual",
            B: m.B || "",
            C: m.C || "",
            D: m.D || "",
            E: m.E || "",
            F: m.F || "",
            G: m.G || "",
            H: m.H || "",
            I: m.I || "",
            J: m.J || "",
            K: m.K || "",
            L: m.L || "",
            M: m.M || "",
            N: m.N || "",
            updatedAt: m.updatedAt || null
        });
    });

    // 자동도 추가
    auto.forEach(a => merged.push(a));

    return merged;
}


// --------------------------------------------
// 📌 값 정리
// --------------------------------------------
function clean(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return v.toString();
    return v.toString().trim();
}


// --------------------------------------------
// 📌 조회페이지 메인 렌더링
// --------------------------------------------
async function refreshView() {

    const tableBody = document.getElementById("viewTableBody");
    tableBody.innerHTML = "";

    const options = await loadOptions();
    const hiddenIds = await loadHiddenRowIds();

    const rawList = await loadMergedData();

    const results = [];

    rawList.forEach(item => {

        // -------------------------------------
        // 17열 & 18열 계산 위한 형태 변환
        // -------------------------------------
        const p = calculateColumn17({
            H: clean(item.H),
            I: clean(item.I),
            J: clean(item.J),
            L: clean(item.L),
            M: clean(item.M),
            N: clean(item.N),
            C: clean(item.C)
        }, options);

        const q = calculateColumn18({
            H: clean(item.H),
            K: clean(item.K),
            M: clean(item.M),
            C: clean(item.C)
        }, options);

        // -------------------------------------
        // 숨김(금지목록) 필터 처리
        // rowId = B_C_D_E
        // -------------------------------------
        const rowId = `${clean(item.B)}_${clean(item.C)}_${clean(item.D)}_${clean(item.E)}`;

        if (hiddenIds.includes(rowId)) return;

        // -------------------------------------
        // 표시 조건:
        // P등급이 A/B/C/D/A+/B+ 중 하나이거나
        // Q가 "o"
        // -------------------------------------

        const pLower = p ? p.toLowerCase() : "";
        const okGrade =
            pLower === "a" || pLower === "a+" ||
            pLower === "b" || pLower === "b+" ||
            pLower === "c" || pLower === "d" ||
            pLower.startsWith("a") || pLower.startsWith("b");

        if (!(okGrade || q === "o")) return;

        // -------------------------------------
        // 결과 push
        // -------------------------------------
        results.push({
            B: item.B,
            C: item.C,
            D: item.D,
            E: item.E,
            F: item.F,
            G: item.G,
            pGrade: p,
            qGrade: q,
            I: item.I,
            N: item.N,
            L: item.L,
            source: item.source
        });
    });


    // -------------------------------------
    // 정렬: 시간(B열) 순
    // -------------------------------------
    results.sort((a, b) => (a.B || "").localeCompare(b.B || ""));


    // -------------------------------------
    // 테이블 렌더링
    // -------------------------------------
    results.forEach(row => {

        const tr = document.createElement("tr");

        const td = (t) => {
            const c = document.createElement("td");
            c.textContent = t;
            c.style.fontWeight = "700";
            return c;
        };

        // B (시간)
        tr.appendChild(td(row.B));

        // D (리그)
        tr.appendChild(td(row.D));

        // E (홈)
        const tdHome = td(row.E);
        if (row.G === "홈") tdHome.style.background = "#d0d0d0";
        tr.appendChild(tdHome);

        // F (원정)
        const tdAway = td(row.F);
        if (row.G === "원정") tdAway.style.background = "#d0d0d0";
        tr.appendChild(tdAway);

        // P (오버등급 + I/N)
        const tdP = document.createElement("td");
        if (row.pGrade) {
            tdP.textContent = `${row.pGrade.toUpperCase()} ( ${row.I} / ${row.N} )`;
            tdP.style.fontWeight = "900";
            tdP.style.fontSize = "1.7em";

            const g = row.pGrade.toUpperCase();
            if (g === "A" || g === "A+") tdP.style.background = "#ff6b6b";
            else if (g === "B" || g === "B+") tdP.style.background = "#ffd93d";
            else if (g === "C") tdP.style.background = "#4d96ff";
            else if (g === "D") tdP.style.background = "#95e1d3";
        }
        tr.appendChild(tdP);

        // Q (승 등급 o)
        const tdQ = document.createElement("td");
        if (row.qGrade === "o") {
            tdQ.textContent = `✓ ( ${row.L} )`;
            tdQ.style.background = "#d0d0d0";
            tdQ.style.fontWeight = "900";
            tdQ.style.fontSize = "1.7em";
        }
        tr.appendChild(tdQ);

        tableBody.appendChild(tr);
    });


    // 결과 개수 표시
    document.getElementById("resultCount").textContent =
        `총 ${results.length}개의 항목이 표시됩니다.`;
}


// --------------------------------------------
// 📌 1분마다 자동 갱신
// --------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    refreshView();
    setInterval(refreshView, 60000);
});
