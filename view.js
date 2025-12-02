// app.js에서 함수 import
import { loadOptions, calculateColumn17, calculateColumn18, showAlert, loadData, setupInputSheetListener, loadHiddenRowIds } from './app.js';

let realtimeUnsubscribe = null; // 실시간 리스너 구독 해제 함수

// 페이지 로드 시 로그인 체크
window.addEventListener('DOMContentLoaded', async () => {
  // 모달 초기화 - 확실히 숨김
  const modal = document.getElementById('sheet1Modal');
  if (modal) {
    modal.style.display = 'none';
  }
  
  // 로그인 체크 - 약간의 지연을 주어 sessionStorage가 완전히 로드되도록 함
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const isLoggedIn = sessionStorage.getItem('isLoggedIn');
  if (isLoggedIn !== 'true') {
    window.location.href = 'login.html';
    return;
  }
  
  // 초기 데이터 로드
  await refreshData();
  
  // 1분마다 자동 새로고침 (data 컬렉션은 "저장하기" 버튼으로 저장되므로 주기적 새로고침)
  setInterval(async () => {
    await refreshData();
  }, 60000); // 60000ms = 1분
});

// 🔧 값 정리(가장 중요한 패치)
function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') return value.trim();
  return '';
}

// 데이터 새로고침
async function refreshData() {
  try {
    // Firebase에서 저장된 데이터 불러오기 (data 컬렉션 - "저장하기" 버튼으로 저장된 데이터)
    let tempData = await loadData();
    
    if (!tempData || tempData.length === 0) {
      displayData([]);
      document.getElementById('resultCount').textContent = '표시할 내용이 없습니다.';
      return;
    }
    
    
    // 옵션 불러오기 (17열, 18열 계산을 위해 필요)
    const options = await loadOptions();
    if (!options) {
      showAlert('옵션을 불러올 수 없습니다. 옵션 설정 페이지에서 먼저 설정해주세요.', 'error');
      displayData([]);
      document.getElementById('resultCount').textContent = '옵션을 불러올 수 없습니다.';
      return;
    }
    
    // 각 행에 대해 17열, 18열 계산하고 필터링
    const filteredData = [];
    const hiddenIds = await getHiddenRowIds(); // 입력 페이지에서 숨김 처리된 행 ID 목록
    
    tempData.forEach((item) => {
      // 17열, 18열 계산을 위한 데이터 준비
      const rowData17 = {
        H: normalizeValue(item.H),
        I: normalizeValue(item.I),
        J: normalizeValue(item.J),
        L: normalizeValue(item.L),
        M: normalizeValue(item.M),
        N: normalizeValue(item.N),
        C: normalizeValue(item.C) // 리그등급 (BC→C로 변경)
      };
      
      const rowData18 = {
        H: normalizeValue(item.H),
        K: normalizeValue(item.K),
        M: normalizeValue(item.M),
        C: normalizeValue(item.C) // 리그등급 (BC→C로 변경) // 리그등급 (3열)
      };
      
      // 17열, 18열 계산
      const pValue = calculateColumn17(rowData17, options);
      const qValue = calculateColumn18(rowData18, options);
      
      // 행의 고유 ID 생성 (B, C, D, E 값을 조합) - 입력 시트와 동일한 형식으로 정규화
      // normalizeValueForRowId와 동일한 로직 사용
      const normalizeValueForRowId = (value) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return value.trim();
        return String(value).trim();
      };
      const rowId = `${normalizeValueForRowId(item.B)}_${normalizeValueForRowId(item.C)}_${normalizeValueForRowId(item.D)}_${normalizeValueForRowId(item.E)}`;
      
      // 필터링 조건: 17열이 A, B, C, D 또는 A+, B+ 중 하나이거나 18열에 'o' 값이 있는 항목
      // 그리고 숨김 처리되지 않은 항목만
      // pValue는 대문자로 반환되므로 대소문자 무시하고 체크
      const pValueLower = pValue ? pValue.toLowerCase() : '';
      // 'a', 'a+', 'b', 'b+', 'c', 'd' 등급을 포함하도록 체크 (a나 b로 시작하거나 정확히 일치)
      const isValidGrade = pValue && (
        pValueLower === 'a' || pValueLower === 'a+' ||
        pValueLower === 'b' || pValueLower === 'b+' ||
        pValueLower === 'c' || pValueLower === 'd' ||
        pValueLower.startsWith('a') || pValueLower.startsWith('b')
      );
      if (((isValidGrade) || qValue === 'o') && !hiddenIds.includes(rowId)) {
        filteredData.push({
          B: item.B || '',
          C: item.C || '',
          D: item.D || '', // 리그
          E: item.E || '', // 홈팀
          F: item.F || '', // 원정팀
          G: item.G || '', // 승정보 (홈/원정)
          P: pValue,
          Q: qValue,
          H: item.H || '',
          I: item.I || '',
          M: item.M || '',
          N: item.N || '',
          L: item.L || ''
        });
      }
    });
    
    displayData(filteredData);
    document.getElementById('resultCount').textContent = `총 ${filteredData.length}개의 항목이 표시됩니다.`;
  } catch (error) {
    console.error('데이터 불러오기 오류:', error);
    showAlert('데이터를 불러올 수 없습니다.', 'error');
    document.getElementById('resultCount').textContent = '데이터를 불러올 수 없습니다.';
  }
}

// 데이터 표시
function displayData(data) {
  const tbody = document.getElementById('viewTableBody');
  tbody.innerHTML = '';
  
  if (data.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
      cell.textContent = '표시할 내용이 없습니다.';
    cell.style.textAlign = 'center';
    cell.style.padding = '20px';
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }
  
  data.forEach(item => {
    const row = document.createElement('tr');
    
    // B열
    const cellB = document.createElement('td');
    cellB.textContent = item.B || '';
    cellB.style.fontSize = '1.1em';
    cellB.style.fontWeight = '700';
    row.appendChild(cellB);
    
    // D열 (리그)
    const cellC = document.createElement('td');
    cellC.textContent = item.D || '';
    cellC.style.fontSize = '1.1em';
    cellC.style.fontWeight = '700';
    row.appendChild(cellC);
    
    // E열 (홈팀)
    const cellD = document.createElement('td');
    cellD.textContent = item.E || '';
    cellD.style.fontSize = '1.1em';
    cellD.style.fontWeight = '700';
    // G열(승정보)이 '홈'이면 배경색 적용
    if (item.G === '홈') {
      cellD.style.backgroundColor = '#d0d0d0';
    }
    row.appendChild(cellD);
    
    // F열 (원정팀)
    const cellE = document.createElement('td');
    cellE.textContent = item.F || '';
    cellE.style.fontSize = '1.1em';
    cellE.style.fontWeight = '700';
    // G열(승정보)이 '원정'이면 배경색 적용
    if (item.G === '원정') {
      cellE.style.backgroundColor = '#d0d0d0';
    }
    row.appendChild(cellE);
    
    // Q열 (오버 등급, 결과값 + I값 / N값)
    const cellP = document.createElement('td');
    // Q값은 대문자로 올 수 있으므로 대소문자 무시하고 체크
    const pValueLower = item.P ? item.P.toLowerCase() : '';
    // 'a', 'a+', 'b', 'b+', 'c', 'd' 등급을 포함하도록 체크 (a나 b로 시작하거나 정확히 일치)
    const isValidGrade = item.P && (
      pValueLower === 'a' || pValueLower === 'a+' ||
      pValueLower === 'b' || pValueLower === 'b+' ||
      pValueLower === 'c' || pValueLower === 'd' ||
      pValueLower.startsWith('a') || pValueLower.startsWith('b')
    );
    if (isValidGrade) {
      const iValue = item.I || '';
      const nValue = item.N || '';
      const pGrade = item.P.toUpperCase();
      cellP.textContent = `${pGrade} ( ${iValue} / ${nValue} )`;
      cellP.style.fontWeight = '900'; /* 매우 굵게 */
      cellP.style.fontSize = '1.8em'; /* 많이 크게 */
      cellP.style.color = '#000'; /* 검은색 */
      // Q열(오버 등급) 등급에 따른 배경색 적용
      if (pGrade === 'A' || pGrade === 'A+') {
        cellP.style.backgroundColor = '#ff6b6b'; /* 붉은색 */
      } else if (pGrade === 'B' || pGrade === 'B+') {
        cellP.style.backgroundColor = '#ffd93d'; /* 노란색 */
      } else if (pGrade === 'C') {
        cellP.style.backgroundColor = '#4d96ff'; /* 파란색 */
      } else if (pGrade === 'D') {
        cellP.style.backgroundColor = '#95e1d3'; /* 연두색 */
      }
    } else {
      cellP.textContent = '';
    }
    row.appendChild(cellP);
    
    // R열(승 등급) (체크 표시)
    const cellQ = document.createElement('td');
    if (item.Q === 'o') {
      const lValue = item.L || '';
      cellQ.textContent = `✓ ( ${lValue} )`;
      cellQ.style.fontWeight = '900'; /* 매우 굵게 */
      cellQ.style.fontSize = '1.8em'; /* 더 크게 */
      cellQ.style.color = '#000';
      cellQ.style.backgroundColor = '#d0d0d0'; /* 진한 회색 */
    } else {
      cellQ.textContent = '';
      cellQ.style.backgroundColor = '';
    }
    row.appendChild(cellQ);
    
    tbody.appendChild(row);
  });
}

// 입력 페이지에서 숨김 처리된 행 ID 목록 가져오기 (Firebase 기반)
async function getHiddenRowIds() {
  try {
    // Firebase에서 불러오기
    const ids = await loadHiddenRowIds();
    // localStorage에도 백업 저장
    try {
      localStorage.setItem('inputHiddenRowIds', JSON.stringify(ids));
    } catch (e) {
      console.warn('localStorage 백업 저장 실패:', e);
    }
    return ids;
  } catch (error) {
    console.warn('Firebase에서 숨김 행 ID 불러오기 실패, localStorage 사용:', error);
    // Firebase 실패 시 localStorage에서 복원 시도
    try {
      const hiddenStr = localStorage.getItem('inputHiddenRowIds');
      return hiddenStr ? JSON.parse(hiddenStr) : [];
    } catch (e) {
      return [];
    }
  }
}

// 로그아웃 처리
function handleLogout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('loggedInUserId');
    window.location.href = 'login.html';
  }
}

// 전역으로 함수 export
window.handleLogout = handleLogout;

// 시트1 모달 표시 함수
async function showSheet1Modal() {
  const modal = document.getElementById('sheet1Modal');
  const tbody = document.getElementById('sheet1TableBody');
  const table = document.getElementById('sheet1Table');
  
  if (!modal || !tbody || !table) return;
  
  // 테이블에 table-layout: fixed 강제 적용
  table.style.tableLayout = 'fixed';
  table.style.width = '100%';
  
  // colgroup으로 열 너비 강제 설정 (0.7:1.3:1.6:1.6:1.6:3.2)
  let colgroup = table.querySelector('colgroup');
  if (!colgroup) {
    colgroup = document.createElement('colgroup');
    table.insertBefore(colgroup, table.firstChild);
  }
  colgroup.innerHTML = `
    <col style="width: 7%;">
    <col style="width: 13%;">
    <col style="width: 16%;">
    <col style="width: 16%;">
    <col style="width: 16%;">
    <col style="width: 32%;">
  `;
  
  // 모달을 html의 직접 자식으로 이동 (body 밖으로)
  if (modal.parentElement !== document.documentElement) {
    document.documentElement.appendChild(modal);
  }
  
  // body의 overflow를 조정하여 모달이 보이도록
  document.body.style.overflow = 'hidden';
  
  // 모달 표시 (새 디자인: flex 사용)
  modal.style.display = 'flex';
  modal.classList.add('show');
  
  // 시트1 데이터 불러오기
  try {
    const { loadSheet1Data } = await import('./app.js');
    const sheet1Data = await loadSheet1Data();
    
    // 테이블에 데이터 표시
    tbody.innerHTML = '';
    
    if (!sheet1Data || sheet1Data.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.textContent = '금지된 경기가 없습니다.';
      cell.style.textAlign = 'center';
      cell.style.padding = '30px';
      cell.style.color = '#999';
      cell.style.fontSize = '1.1rem';
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }
    
    sheet1Data.forEach((item, index) => {
      const row = document.createElement('tr');
      
      // 번호
      const cellNo = document.createElement('td');
      cellNo.textContent = index + 1;
      row.appendChild(cellNo);
      
      // 시간
      const cellTime = document.createElement('td');
      cellTime.textContent = item.time || '';
      row.appendChild(cellTime);
      
      // 리그
      const cellLeague = document.createElement('td');
      cellLeague.textContent = item.league || '';
      row.appendChild(cellLeague);
      
      // 홈팀
      const cellHome = document.createElement('td');
      cellHome.textContent = item.home || '';
      row.appendChild(cellHome);
      
      // 원정팀
      const cellAway = document.createElement('td');
      cellAway.textContent = item.away || '';
      row.appendChild(cellAway);
      
      // 내용
      const cellContent = document.createElement('td');
      cellContent.textContent = item.content || '';
      row.appendChild(cellContent);
      
      tbody.appendChild(row);
    });
    
    // 열 너비 강제 적용 (JavaScript로) - 새 디자인에 맞게 조정
    setTimeout(() => {
      const ths = table.querySelectorAll('thead th');
      const widths = ['7%', '13%', '16%', '16%', '16%', '32%'];
      ths.forEach((th, index) => {
        th.style.width = widths[index];
        th.style.minWidth = widths[index];
        th.style.maxWidth = widths[index];
      });
      
      console.log('✅ 열 너비 강제 적용 완료');
    }, 0);
  } catch (error) {
    console.error('시트1 데이터 불러오기 오류:', error);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: #ff6b6b;">데이터를 불러올 수 없습니다.</td></tr>';
  }
}

// 시트1 모달 닫기 함수
function closeSheet1Modal() {
  const modal = document.getElementById('sheet1Modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('show');
    // body의 overflow 복원
    document.body.style.overflow = '';
  }
}

// 모달 외부 클릭 시 닫기
window.onclick = function(event) {
  const modal = document.getElementById('sheet1Modal');
  if (event.target === modal) {
    closeSheet1Modal();
  }
}

// Firebase 실시간 리스너 설정 (data 컬렉션 감시)
function setupRealtimeListener() {
  // data 컬렉션의 변경사항을 실시간으로 감시
  // 주의: data 컬렉션은 여러 문서로 구성되어 있어 개별 문서 변경 감시가 필요
  // 현재는 1분마다 자동 새로고침으로 대체
  // 필요시 data 컬렉션 전체를 감시하는 리스너를 추가할 수 있음
}

// 페이지 언로드 시 리스너 해제
window.addEventListener('beforeunload', () => {
  if (realtimeUnsubscribe) {
    realtimeUnsubscribe();
  }
});

// 전역으로 함수 export
window.showSheet1Modal = showSheet1Modal;
window.closeSheet1Modal = closeSheet1Modal;



