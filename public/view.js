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
    
    tempData.forEach((item) => {
      // P, Q 열 계산
      const pValue = calculatePColumn(item, options);
      const qValue = calculateQColumn(item, options);
      
      // 필터링 조건: P열이 a, b, c, d 중 하나이거나 Q열에 'o' 값이 있는 항목
      if ((pValue && ['a', 'b', 'c', 'd'].includes(pValue)) || qValue === 'o') {
        filteredData.push({
          B: item.B || '',
          C: item.C || '',
          D: item.D || '',
          E: item.E || '',
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
    row.appendChild(cellB);
    
    // C열
    const cellC = document.createElement('td');
    cellC.textContent = item.C || '';
    row.appendChild(cellC);
    
    // D열
    const cellD = document.createElement('td');
    cellD.textContent = item.D || '';
    row.appendChild(cellD);
    
    // E열
    const cellE = document.createElement('td');
    cellE.textContent = item.E || '';
    row.appendChild(cellE);
    
    // P열 (결과값 + M값)
    const cellP = document.createElement('td');
    if (item.P && ['a', 'b', 'c', 'd'].includes(item.P)) {
      const mValue = item.M || '';
      cellP.textContent = `${item.P} (M값: ${mValue})`;
      cellP.style.fontWeight = 'bold';
      cellP.style.color = '#4CAF50';
    } else {
      cellP.textContent = '';
    }
    row.appendChild(cellP);
    
    // Q열 (o + L값)
    const cellQ = document.createElement('td');
    if (item.Q === 'o') {
      const lValue = item.L || '';
      cellQ.textContent = `o (L값: ${lValue})`;
      cellQ.style.fontWeight = 'bold';
      cellQ.style.color = '#2196F3';
    } else {
      cellQ.textContent = '';
    }
    row.appendChild(cellQ);
    
    tbody.appendChild(row);
  });
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



