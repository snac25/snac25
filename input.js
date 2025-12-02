
// --------------------------------------------------------
// input.js — 자동 입력 전용 강화버전 (4개 계산 포함)
// --------------------------------------------------------

import {
    loadOptions,
    calculateColumn17,
    calculateColumn18
} from "./app.js";

const db = firebase.firestore();


// ========================================================
// 📌 autoMatches 불러오기
// ========================================================
export async function loadAutoMatches() {
    const snap = await db.collection("autoMatches")
        .orderBy("startKST")
        .get();

    const list = [];
    snap.forEach(doc => {
        const d = doc.data();

        list.push({
            id: doc.id,
            time: d.startKST?.substring(11, 16) ?? "",
            grade: d.leagueGrade ?? "",
            league: d.leagueName ?? "",
            home: d.homeTeam ?? "",
            away: d.awwayTeam ?? "",
            fav: d.favSide ?? "",
            H: d.favOddInitial ?? "",
            I: d.baseOverLine ?? "",
            J: d.baseOverOddInitial ?? "",
            K: d.oddWinAt75 ?? "",
            L: d.oddOverAt75 ?? "",
            M: d.oddWinLive ?? "",
            N: d.oddOverLive ?? "",
            updatedAt: d.updatedAt ?? ""
        });
    });

    return list;
}


// ========================================================
// 📌 자동탭 UI 렌더링 (4개 계산 적용)
// ========================================================
async function renderAutoTable() {

    const tbody = document.getElementById("autoTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    const rows = await loadAutoMatches();
    const options = await loadOptions();

    rows.forEach(row => {

        // ------------------------------------------------
        // (1) 승 하락수치 계산: H - M
        // ------------------------------------------------
        const dropWin = (row.H && row.M)
            ? (parseFloat(row.H) - parseFloat(row.M)).toFixed(2)
            : "";

        // ------------------------------------------------
        // (2) 오버 하락수치 계산: J - N
        // ------------------------------------------------
        const dropOver = (row.J && row.N)
            ? (parseFloat(row.J) - parseFloat(row.N)).toFixed(2)
            : "";

        // ------------------------------------------------
        // (3) 오버 등급 계산 (P열 = 17열)
        // ------------------------------------------------
        const pGrade = calculateColumn17({
            H: row.H,
            I: row.I,
            J: row.J,
            L: row.L,
            M: row.M,
            N: row.N,
            C: row.grade
        }, options);

        // ------------------------------------------------
        // (4) 승 등급 계산 (Q열 = 18열)
        // ------------------------------------------------
        const qGrade = calculateColumn18({
            H: row.H,
            K: row.K,
            M: row.M,
            C: row.grade
        }, options);

        // ------------------------------------------------
        // 테이블 렌더링
        // ------------------------------------------------
        const tr = document.createElement("tr");

        // Helper
        const td = (txt, readonly = true) => {
            const c = document.createElement("td");
            c.textContent = txt;
            if (readonly) c.classList.add("readonly-cell");
            return c;
        };

        // B
        tr.appendChild(td(row.time));

        // C (리그 등급 수정가능)
        const tdC = document.createElement("td");
        const sel = document.createElement("select");
        sel.className = "grade-select";

        ["A", "B", "C", "S"].forEach(v => {
            const op = document.createElement("option");
            op.value = v;
            op.textContent = v;
            if (row.grade === v) op.selected = true;
            sel.appendChild(op);
        });

        sel.onchange = async () => {
            await db.collection("autoMatches").doc(row.id).update({
                leagueGrade: sel.value
            });
        };

        tdC.appendChild(sel);
        tr.appendChild(tdC);

        // D ~ N 입력
        tr.appendChild(td(row.league));
        tr.appendChild(td(row.home));
        tr.appendChild(td(row.away));
        tr.appendChild(td(row.fav));
        tr.appendChild(td(row.H));
        tr.appendChild(td(row.I));
        tr.appendChild(td(row.J));
        tr.appendChild(td(row.K));
        tr.appendChild(td(row.L));
        tr.appendChild(td(row.M));
        tr.appendChild(td(row.N));

        // O = 승 하락수치(H−M)
        tr.appendChild(td(dropWin));

        // 16열 = 오버 하락수치(J−N)
        tr.appendChild(td(dropOver));

        // 17열 P = 오버 등급
        tr.appendChild(td(pGrade));

        // 18열 Q = 승 등급(o)
        tr.appendChild(td(qGrade));

        // R = 반영시간
        tr.appendChild(td(
            row.updatedAt?.toDate
                ? row.updatedAt.toDate().toLocaleTimeString("ko-KR")
                : ""
        ));

        tbody.appendChild(tr);
    });
}


// ========================================================
// 📌 페이지 로딩 시 자동탭 렌더링 실행 + 1분마다 갱신
// ========================================================
window.addEventListener("DOMContentLoaded", async () => {
    await renderAutoTable();
    setInterval(renderAutoTable, 60000); // 1분 단위 자동 새로고침
});
