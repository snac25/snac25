// app.js에서 함수 import
import { loadOptions, calculatePColumn, calculateQColumn, showAlert } from './app.js';

// 페이지 로드 시 로그인 체크
window.addEventListener('DOMContentLoaded', async () => {
  // 로그인 체크
  const isLoggedIn = sessionStorage.getItem('isLoggedIn');
  if (isLoggedIn !== 'true') {
    window.location.href = 'login.html';
    return;
  }
  
  await refreshData();
});

// 데이터 새로고침
async function refreshData() {
  try {
    // localStorage에서 입력 페이지의 데이터 불러오기
    const tempDataStr = localStorage.getItem('inputSheetTemp');
    if (!tempDataStr) {
      displayData([]);
      document.getElementById('resultCount').textContent = '입력된 데이터가 없습니다.';
      return;
    }
    
    const tempData = JSON.parse(tempDataStr);
    if (!tempData || tempData.length === 0) {
      displayData([]);
      document.getElementById('resultCount').textContent = '입력된 데이터가 없습니다.';
      return;
    }
    
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
    
    // P열 (결과값 + M값)
    const cellP = document.createElement('td');
    if (item.P && ['a', 'b', 'c', 'd'].includes(item.P)) {
      const mValue = item.M || '';
      const pGrade = item.P.toUpperCase();
      cellP.textContent = `${pGrade} ( ${mValue} )`;
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



