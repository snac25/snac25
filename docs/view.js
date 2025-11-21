// app.js에서 함수 import
import { loadOptions, calculatePColumn, calculateQColumn, showAlert, loadInputSheetData, setupInputSheetListener } from './app.js';

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
  
  // Firebase 실시간 리스너 설정 (입력 페이지에서 데이터 변경 시 자동 업데이트)
  setupRealtimeListener();
  
  // 1분마다 자동 새로고침 (백업용)
  setInterval(async () => {
    console.log('🔄 1분 주기 자동 새로고침 실행');
    await refreshData();
  }, 60000); // 60000ms = 1분
});

// 데이터 새로고침
async function refreshData() {
  try {
    // Firebase에서 입력 페이지의 데이터 불러오기 (우선순위 1)
    let tempData = await loadInputSheetData();
    
    // Firebase에 데이터가 없으면 localStorage에서 불러오기 (백업)
    if (!tempData || tempData.length === 0) {
      console.log('⚠️ Firebase에 데이터가 없습니다. localStorage에서 불러옵니다.');
      const tempDataStr = localStorage.getItem('inputSheetTemp');
      if (tempDataStr) {
        tempData = JSON.parse(tempDataStr);
      }
    }
    
    if (!tempData || tempData.length === 0) {
      displayData([]);
      document.getElementById('resultCount').textContent = '입력된 데이터가 없습니다.';
      return;
    }
    
    console.log('✅ 데이터 로드 완료:', tempData.length, '행');
    
    // 옵션 불러오기 (P, Q 계산을 위해 필요)
    const options = await loadOptions();
    if (!options) {
      showAlert('옵션을 불러올 수 없습니다. 옵션 설정 페이지에서 먼저 설정해주세요.', 'error');
      displayData([]);
      document.getElementById('resultCount').textContent = '옵션을 불러올 수 없습니다.';
      return;
    }
    
    // 각 행에 대해 P, Q 계산하고 필터링
    const filteredData = [];
    const hiddenIds = getHiddenRowIds(); // 입력 페이지에서 숨김 처리된 행 ID 목록
    
    tempData.forEach((item) => {
      // P, Q 열 계산
      const pValue = calculatePColumn(item, options);
      const qValue = calculateQColumn(item, options);
      
      // 행의 고유 ID 생성 (B, C, D, E 값을 조합)
      const rowId = `${item.B || ''}_${item.C || ''}_${item.D || ''}_${item.E || ''}`;
      
      // 필터링 조건: P열이 a, b, c, d 중 하나이거나 Q열에 'o' 값이 있는 항목
      // 그리고 숨김 처리되지 않은 항목만
      if (((pValue && ['a', 'b', 'c', 'd'].includes(pValue)) || qValue === 'o') && !hiddenIds.includes(rowId)) {
        filteredData.push({
          B: item.B || '',
          C: item.C || '',
          D: item.D || '',
          E: item.E || '',
          F: item.F || '', // 승정보 (홈/원정)
          P: pValue,
          Q: qValue,
          H: item.H || '',
          M: item.M || '',
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
    cell.textContent = '표시할 데이터가 없습니다.';
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
    
    // C열
    const cellC = document.createElement('td');
    cellC.textContent = item.C || '';
    cellC.style.fontSize = '1.1em';
    cellC.style.fontWeight = '700';
    row.appendChild(cellC);
    
    // D열 (홈팀)
    const cellD = document.createElement('td');
    cellD.textContent = item.D || '';
    cellD.style.fontSize = '1.1em';
    cellD.style.fontWeight = '700';
    // F열(승정보)이 '홈'이면 배경색 적용
    if (item.F === '홈') {
      cellD.style.backgroundColor = '#d0d0d0';
    }
    row.appendChild(cellD);
    
    // E열 (원정팀)
    const cellE = document.createElement('td');
    cellE.textContent = item.E || '';
    cellE.style.fontSize = '1.1em';
    cellE.style.fontWeight = '700';
    // F열(승정보)이 '원정'이면 배경색 적용
    if (item.F === '원정') {
      cellE.style.backgroundColor = '#d0d0d0';
    }
    row.appendChild(cellE);
    
    // P열 (결과값 + H값 / M값)
    const cellP = document.createElement('td');
    if (item.P && ['a', 'b', 'c', 'd'].includes(item.P)) {
      const hValue = item.H || '';
      const mValue = item.M || '';
      const pGrade = item.P.toUpperCase();
      cellP.textContent = `${pGrade} ( ${hValue} / ${mValue} )`;
      cellP.style.fontWeight = '900'; /* 매우 굵게 */
      cellP.style.fontSize = '1.8em'; /* 많이 크게 */
      cellP.style.color = '#000'; /* 검은색 */
      // P열 등급에 따른 배경색 적용
      if (pGrade === 'A') {
        cellP.style.backgroundColor = '#ff6b6b'; /* 붉은색 */
      } else if (pGrade === 'B') {
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
    
    // Q열 (체크 표시)
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

// 입력 페이지에서 숨김 처리된 행 ID 목록 가져오기
function getHiddenRowIds() {
  try {
    const hiddenStr = localStorage.getItem('inputHiddenRowIds');
    return hiddenStr ? JSON.parse(hiddenStr) : [];
  } catch (error) {
    return [];
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

// Firebase 실시간 리스너 설정
function setupRealtimeListener() {
  realtimeUnsubscribe = setupInputSheetListener((data) => {
    console.log('🔄 Firebase 실시간 업데이트 감지:', data.length, '행');
    // 데이터가 변경되면 자동으로 새로고침
    refreshData();
  });
  
  console.log('✅ 실시간 리스너 설정 완료');
}

// 페이지 언로드 시 리스너 해제
window.addEventListener('beforeunload', () => {
  if (realtimeUnsubscribe) {
    realtimeUnsubscribe();
    console.log('✅ 실시간 리스너 해제');
  }
});

// 전역으로 함수 export
window.showSheet1Modal = showSheet1Modal;
window.closeSheet1Modal = closeSheet1Modal;



