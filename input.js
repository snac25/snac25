// app.js에서 함수 import
import { loadOptions, showAlert, calculatePColumn, calculateQColumn, saveInputSheetData, loadInputSheetData, setupInputSheetListener, deleteAllData } from './app.js';

let currentOptions = null;
let tableData = [];
let selectedCell = null;
let pasteStartCell = null;
let isDragging = false;
let selectedCells = new Set(); // 선택된 셀들을 Set으로 관리
let realtimeUnsubscribe = null; // 실시간 리스너 구독 해제 함수
let isUpdatingFromFirebase = false; // Firebase에서 업데이트 중인지 플래그
let saveTimeout = null; // 디바운싱을 위한 타이머

// 숨김된 행 ID 목록 관리
function getHiddenRowIds() {
  try {
    const hiddenStr = localStorage.getItem('inputHiddenRowIds');
    return hiddenStr ? JSON.parse(hiddenStr) : [];
  } catch (error) {
    return [];
  }
}

function setHiddenRowIds(ids) {
  try {
    localStorage.setItem('inputHiddenRowIds', JSON.stringify(ids));
  } catch (error) {
    console.warn('localStorage 저장 실패:', error);
  }
}

function addHiddenRowId(id) {
  const hiddenIds = getHiddenRowIds();
  if (!hiddenIds.includes(id)) {
    hiddenIds.push(id);
    setHiddenRowIds(hiddenIds);
  }
}

function removeHiddenRowId(id) {
  const hiddenIds = getHiddenRowIds();
  const index = hiddenIds.indexOf(id);
  if (index > -1) {
    hiddenIds.splice(index, 1);
    setHiddenRowIds(hiddenIds);
  }
}

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', async () => {
  await loadOptionsData();
  
  // Firebase에서 실시간 데이터 불러오기
  const firebaseData = await loadInputSheetData();
  if (firebaseData && firebaseData.length > 0) {
    loadDataFromArray(firebaseData);
  } else {
    // Firebase에 데이터가 없으면 localStorage에서 복원 시도
    const localData = loadFromLocalStorage();
    if (!localData) {
      // 임시 데이터가 없으면 빈 행 생성
      for (let i = 1; i <= 30; i++) {
        addRow(i);
      }
      // 빈 행도 Firebase에 저장
      setTimeout(() => {
        saveToLocalStorage();
      }, 1000);
    }
  }
  
  // 실시간 리스너 설정
  setupRealtimeListener();
  
  setupKeyboardShortcuts();
  setupPasteHandler();
  setupDragSelection();
  setupRowSelection(); // 행 선택 기능 설정
  
  // 시간 체크를 주기적으로 실행 (1분마다)
  setInterval(checkAllRowsTime, 60000); // 60000ms = 1분
  
  // 초기 로드 시 모든 행 체크
  setTimeout(() => {
    checkAllRowsTime();
  }, 1000);
  
});

// 옵션 데이터 불러오기
async function loadOptionsData() {
  currentOptions = await loadOptions();
  if (!currentOptions) {
    showAlert('옵션을 불러올 수 없습니다. 옵션 설정 페이지에서 먼저 설정해주세요.', 'error');
  }
}

// 행 추가
function addRow(rowNum) {
  const tbody = document.getElementById('tableBody');
  const tr = document.createElement('tr');
  tr.dataset.rowIndex = tableData.length;
  tr.refs = {};
  
  // 행 클릭 이벤트는 setupRowSelection에서 이벤트 위임으로 처리하므로 여기서는 제거
  
  // 번호
  const noTd = document.createElement('td');
  noTd.textContent = rowNum || (tableData.length + 1);
  noTd.className = 'row-number-cell';
  // 행 선택은 setupRowSelection에서 이벤트 위임으로 처리
  tr.appendChild(noTd);
  tr.noTd = noTd; // 번호 셀 참조 저장
  
  // 시간 (B)
  const timeTd = document.createElement('td');
  // 행 선택은 setupRowSelection에서 이벤트 위임으로 처리
  const timeInput = document.createElement('input');
  timeInput.type = 'text';
  timeInput.dataset.k = 'B';
  timeInput.dataset.colIndex = 1; // B열은 1번 인덱스 (A=0, B=1)
  timeInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 1);
  });
  timeInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 1);
  });
  timeInput.oninput = () => { 
    saveToLocalStorage();
    checkTimeAndUpdateRowColor(tr); // 시간 체크 및 배경색 업데이트
  };
  timeTd.appendChild(timeInput);
  tr.appendChild(timeTd);
  tr.refs.B = timeInput;
  
  // 리그 (C)
  const leagueTd = document.createElement('td');
  const leagueInput = document.createElement('input');
  leagueInput.type = 'text';
  leagueInput.dataset.k = 'C';
  leagueInput.dataset.colIndex = 2; // C열은 2번 인덱스
  leagueInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 2);
  });
  leagueInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 2);
  });
  leagueInput.oninput = () => { saveToLocalStorage(); };
  leagueTd.appendChild(leagueInput);
  tr.appendChild(leagueTd);
  tr.refs.C = leagueInput;
  
  // 홈팀 (D)
  const homeTd = document.createElement('td');
  const homeInput = document.createElement('input');
  homeInput.type = 'text';
  homeInput.dataset.k = 'D';
  homeInput.dataset.colIndex = 3; // D열은 3번 인덱스
  homeInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 3);
  });
  homeInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 3);
  });
  homeInput.oninput = () => { saveToLocalStorage(); };
  homeTd.appendChild(homeInput);
  tr.appendChild(homeTd);
  tr.refs.D = homeInput;
  
  // 원정팀 (E)
  const awayTd = document.createElement('td');
  const awayInput = document.createElement('input');
  awayInput.type = 'text';
  awayInput.dataset.k = 'E';
  awayInput.dataset.colIndex = 4; // E열은 4번 인덱스
  awayInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 4);
  });
  awayInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 4);
  });
  awayInput.oninput = () => { saveToLocalStorage(); };
  awayTd.appendChild(awayInput);
  tr.appendChild(awayTd);
  tr.refs.E = awayInput;
  
  // 승정보 (F) - select
  const fTd = document.createElement('td');
  const fSelect = document.createElement('select');
  ['', '홈', '원정'].forEach(v => {
    const option = document.createElement('option');
    option.textContent = v;
    option.value = v;
    fSelect.appendChild(option);
  });
  fSelect.dataset.k = 'F';
  fSelect.dataset.colIndex = 5; // F열은 5번 인덱스
  fSelect.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 5);
  });
  fSelect.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 5);
  });
  fSelect.onchange = () => { updateRow(tr); saveToLocalStorage(); };
  fTd.appendChild(fSelect);
  tr.appendChild(fTd);
  tr.refs.F = fSelect;
  
  // 승 (G)
  const gTd = document.createElement('td');
  gTd.className = 'orange-input-cell';
  const gInput = document.createElement('input');
  gInput.type = 'number';
  gInput.step = '0.01';
  gInput.dataset.k = 'G';
  gInput.dataset.colIndex = 6; // G열은 6번 인덱스
  gInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 6);
  });
  gInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 6);
  });
  gInput.oninput = () => { updateTime(gTd); updateRow(tr); saveToLocalStorage(); };
  gTd.appendChild(gInput);
  tr.appendChild(gTd);
  tr.refs.G = gInput;
  
  // 오버정보 (H)
  const hTd = document.createElement('td');
  const hInput = document.createElement('input');
  hInput.type = 'text';
  hInput.dataset.k = 'H';
  hInput.dataset.colIndex = 7; // H열은 7번 인덱스
  hInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 7);
  });
  hInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 7);
  });
  hInput.oninput = () => { saveToLocalStorage(); };
  hTd.appendChild(hInput);
  tr.appendChild(hTd);
  tr.refs.H = hInput;
  
  // 오버 (I)
  const iTd = document.createElement('td');
  iTd.className = 'orange-input-cell';
  const iInput = document.createElement('input');
  iInput.type = 'number';
  iInput.step = '0.01';
  iInput.dataset.k = 'I';
  iInput.dataset.colIndex = 8; // I열은 8번 인덱스
  iInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 8);
  });
  iInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 8);
  });
  iInput.oninput = () => { updateTime(iTd); updateRow(tr); saveToLocalStorage(); };
  iTd.appendChild(iInput);
  tr.appendChild(iTd);
  tr.refs.I = iInput;
  
  // 75분전 승 (J)
  const jTd = document.createElement('td');
  jTd.className = 'orange-input-cell';
  const jInput = document.createElement('input');
  jInput.type = 'number';
  jInput.step = '0.01';
  jInput.dataset.k = 'J';
  jInput.dataset.colIndex = 9; // J열은 9번 인덱스
  jInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 9);
  });
  jInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 9);
  });
  jInput.oninput = () => { updateTime(jTd); updateRow(tr); saveToLocalStorage(); };
  jTd.appendChild(jInput);
  tr.appendChild(jTd);
  tr.refs.J = jInput;
  
  // 75분전 오버 (K)
  const kTd = document.createElement('td');
  kTd.className = 'orange-input-cell';
  const kInput = document.createElement('input');
  kInput.type = 'number';
  kInput.step = '0.01';
  kInput.dataset.k = 'K';
  kInput.dataset.colIndex = 10; // K열은 10번 인덱스
  kInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 10);
  });
  kInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 10);
  });
  kInput.oninput = () => { updateTime(kTd); updateRow(tr); saveToLocalStorage(); };
  kTd.appendChild(kInput);
  tr.appendChild(kTd);
  tr.refs.K = kInput;
  
  // 현배당 승 (L)
  const lTd = document.createElement('td');
  lTd.className = 'orange-input-cell';
  const lInput = document.createElement('input');
  lInput.type = 'number';
  lInput.step = '0.01';
  lInput.dataset.k = 'L';
  lInput.dataset.colIndex = 11; // L열은 11번 인덱스
  lInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 11);
  });
  lInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 11);
  });
  lInput.oninput = () => { updateTime(lTd); updateRow(tr); saveToLocalStorage(); };
  lTd.appendChild(lInput);
  tr.appendChild(lTd);
  tr.refs.L = lInput;
  
  // 현배당 오버 (M)
  const mTd = document.createElement('td');
  mTd.className = 'orange-input-cell';
  const mInput = document.createElement('input');
  mInput.type = 'number';
  mInput.step = '0.01';
  mInput.dataset.k = 'M';
  mInput.dataset.colIndex = 12; // M열은 12번 인덱스
  mInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 12);
  });
  mInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 12);
  });
  mInput.oninput = () => { updateTime(mTd); updateRow(tr); saveToLocalStorage(); };
  mTd.appendChild(mInput);
  tr.appendChild(mTd);
  tr.refs.M = mInput;
  
  // 하락수치 승 (N) - 계산된 값
  const nTd = document.createElement('td');
  nTd.className = 'calculated-cell';
  // 행 선택은 setupRowSelection에서 이벤트 위임으로 처리
  tr.appendChild(nTd);
  tr.nTd = nTd;

  // 하락수치 오버 (O) - 계산된 값
  const oTd = document.createElement('td');
  oTd.className = 'calculated-cell';
  // 행 선택은 setupRowSelection에서 이벤트 위임으로 처리
  tr.appendChild(oTd);
  tr.oTd = oTd;

  // 판정 승 (P) - 등급
  const pTd = document.createElement('td');
  pTd.className = 'grade-cell';
  // 행 선택은 setupRowSelection에서 이벤트 위임으로 처리
  tr.appendChild(pTd);
  tr.pTd = pTd;

  // 판정 오버 (Q) - 등급
  const qTd = document.createElement('td');
  qTd.className = 'grade-cell';
  // 행 선택은 setupRowSelection에서 이벤트 위임으로 처리
  tr.appendChild(qTd);
  tr.qTd = qTd;
  
  // 조작 (삽입/삭제/숨김 버튼)
  const opTd = document.createElement('td');
  // 행 선택은 setupRowSelection에서 이벤트 위임으로 처리
  
  const btnBox = document.createElement('div');
  btnBox.className = 'btn-box';
  
  const insertBtn = document.createElement('button');
  insertBtn.textContent = '삽입';
  insertBtn.className = 'insert-btn';
  insertBtn.onclick = () => insertAfter(tr);
  
  // 행 삭제 버튼 제거됨 - 자동 삭제 기능 비활성화
  // const delBtn = document.createElement('button');
  // delBtn.textContent = '삭제';
  // delBtn.className = 'del-btn';
  // delBtn.onclick = () => { ... };
  
  const hideBtn = document.createElement('button');
  hideBtn.textContent = '숨김';
  hideBtn.className = 'hide-btn';
  hideBtn.onclick = () => {
    // 행의 고유 ID 생성 (B, C, D, E 값을 조합)
    const rowId = `${tr.refs.B?.value || ''}_${tr.refs.C?.value || ''}_${tr.refs.D?.value || ''}_${tr.refs.E?.value || ''}`;
    if (rowId !== '___') { // 빈 행이 아닌 경우만
      const hiddenIds = getHiddenRowIds();
      const isHidden = hiddenIds.includes(rowId);
      
      if (isHidden) {
        // 숨김 해제
        removeHiddenRowId(rowId);
        hideBtn.textContent = '숨김';
        hideBtn.style.opacity = '1';
        opTd.style.backgroundColor = ''; // R열 배경색 제거
      } else {
        // 숨김 처리
        addHiddenRowId(rowId);
        hideBtn.textContent = '숨김됨';
        hideBtn.style.opacity = '0.5';
        opTd.style.backgroundColor = '#808080'; // R열 배경색 어둡게
      }
    }
  };
  tr.refs.hideBtn = hideBtn; // 숨김 버튼 참조 저장
  tr.refs.opTd = opTd; // R열 참조 저장
  
  btnBox.appendChild(insertBtn);
  // btnBox.appendChild(delBtn); // 행 삭제 버튼 제거됨
  btnBox.appendChild(hideBtn);
  opTd.appendChild(btnBox);
  tr.appendChild(opTd);
  
  // 행의 값이 변경될 때 숨김 상태 확인
  const checkHideStatus = () => {
    const rowId = `${tr.refs.B?.value || ''}_${tr.refs.C?.value || ''}_${tr.refs.D?.value || ''}_${tr.refs.E?.value || ''}`;
    const hiddenIds = getHiddenRowIds();
    if (hiddenIds.includes(rowId)) {
      hideBtn.textContent = '숨김됨';
      hideBtn.style.opacity = '0.5';
      opTd.style.backgroundColor = '#808080'; // R열 배경색 어둡게
    } else {
      hideBtn.textContent = '숨김';
      hideBtn.style.opacity = '1';
      opTd.style.backgroundColor = ''; // R열 배경색 제거
    }
  };
  
  // B, C, D, E 값이 변경될 때마다 숨김 상태 확인
  ['B', 'C', 'D', 'E'].forEach(key => {
    if (tr.refs[key]) {
      tr.refs[key].addEventListener('input', checkHideStatus);
    }
  });
  
  // 초기 숨김 상태 확인
  setTimeout(checkHideStatus, 0);
  
  tbody.appendChild(tr);
  
  // 초기 데이터 객체 생성
  const rowData = {};
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'].forEach(col => {
    rowData[col] = '';
  });
  tableData.push(rowData);
  
  return tr;
}

// 시간 업데이트
function updateTime(td) {
  const d = new Date();
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  let s = td.querySelector('small');
  if (!s) {
    s = document.createElement('small');
    td.appendChild(s);
  }
  s.textContent = t;
}

// 행 계산 업데이트
function updateRow(tr) {
  if (!currentOptions) return;
  
  // 빈 값은 NaN으로 처리 (0으로 변환하지 않음)
  const G = tr.refs.G.value.trim() === '' ? NaN : parseFloat(tr.refs.G.value);
  const J = tr.refs.J.value.trim() === '' ? NaN : parseFloat(tr.refs.J.value);
  const L = tr.refs.L.value.trim() === '' ? NaN : parseFloat(tr.refs.L.value);
  const I = tr.refs.I.value.trim() === '' ? NaN : parseFloat(tr.refs.I.value);
  const K = tr.refs.K.value.trim() === '' ? NaN : parseFloat(tr.refs.K.value);
  const M = tr.refs.M.value.trim() === '' ? NaN : parseFloat(tr.refs.M.value);
  
  // N열: G-L
  tr.nTd.textContent = (!isNaN(G) && !isNaN(L)) ? (G - L).toFixed(2) : '';
  
  // O열: I-M
  tr.oTd.textContent = (!isNaN(I) && !isNaN(M)) ? (I - M).toFixed(2) : '';
  
  // P열 계산 (옵션 기반)
  const rowData = {
    G: isNaN(G) ? '' : G.toString(),
    I: isNaN(I) ? '' : I.toString(),
    J: isNaN(J) ? '' : J.toString(),
    K: isNaN(K) ? '' : K.toString(),
    L: isNaN(L) ? '' : L.toString(),
    M: isNaN(M) ? '' : M.toString()
  };
  
  const pValue = calculatePColumn(rowData, currentOptions);
  tr.pTd.textContent = pValue ? pValue.toUpperCase() : '';
  // P열 등급에 따른 색상 클래스 및 인라인 스타일 적용
  if (pValue) {
    const pGrade = pValue.toUpperCase();
    tr.pTd.className = 'grade-cell grade-P-' + pGrade;
    tr.pTd.style.color = '#000'; // 검은색 텍스트
    // 등급별 배경색 직접 적용
    if (pGrade === 'A') {
      tr.pTd.style.backgroundColor = '#ff6b6b'; // 붉은색
    } else if (pGrade === 'B') {
      tr.pTd.style.backgroundColor = '#ffd93d'; // 노란색
    } else if (pGrade === 'C') {
      tr.pTd.style.backgroundColor = '#4d96ff'; // 파란색
    } else if (pGrade === 'D') {
      tr.pTd.style.backgroundColor = '#95e1d3'; // 연두색
    }
  } else {
    tr.pTd.className = 'grade-cell';
    tr.pTd.style.backgroundColor = '';
    tr.pTd.style.color = '';
  }
  
  // Q열 계산 (옵션 기반) - 체크 표시
  const qValue = calculateQColumn(rowData, currentOptions);
  tr.qTd.textContent = qValue === 'o' ? '✓' : '';
  tr.qTd.className = 'grade-cell' + (qValue === 'o' ? ' grade-Q' : '');
  // Q열은 배경색 없이 체크 표시만 (크고 굵게)
  if (qValue === 'o') {
    tr.qTd.style.backgroundColor = '';
    tr.qTd.style.color = '#000';
    tr.qTd.style.fontWeight = '900';
    tr.qTd.style.fontSize = '1.8em';
  } else {
    tr.qTd.style.backgroundColor = '';
    tr.qTd.style.color = '';
    tr.qTd.style.fontWeight = '';
    tr.qTd.style.fontSize = '';
  }
  
  // 데이터 업데이트
  if (tableData[tr.dataset.rowIndex]) {
    tableData[tr.dataset.rowIndex].P = pValue;
    tableData[tr.dataset.rowIndex].Q = qValue;
    tableData[tr.dataset.rowIndex].N = tr.nTd.textContent;
    tableData[tr.dataset.rowIndex].O = tr.oTd.textContent;
  }
}

// 삽입
function insertAfter(tr) {
  const newRow = addRow(parseInt(tr.cells[0].textContent) + 1);
  tr.parentNode.insertBefore(newRow, tr.nextSibling);
  reindex();
  saveToLocalStorage(); // Firebase에 삽입 반영
}

// 번호 재인덱싱
function reindex() {
  const rows = document.querySelectorAll('#tableBody tr');
  rows.forEach((r, i) => {
    r.cells[0].textContent = i + 1;
  });
}

// 시간 문자열을 Date 객체로 변환 (HH:MM 형식)
// 정렬용: 12:00~24:00는 당일, 00:00~12:00는 다음날로 처리
function parseTimeForSort(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  
  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) return null;
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  
  if (isNaN(hours) || isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  
  const now = new Date();
  const time = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  
  // 12:00~24:00는 당일, 00:00~12:00는 다음날로 처리
  if (hours < 12) {
    // 00:00~11:59는 다음날
    time.setDate(time.getDate() + 1);
  }
  // 12:00~23:59는 당일 (변경 없음)
  
  return time;
}

// 시간 문자열을 Date 객체로 변환 (HH:MM 형식)
// 체크용: 현재 시간 기준으로 가장 가까운 시간으로 변환
function parseTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  
  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) return null;
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  
  if (isNaN(hours) || isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  
  const now = new Date();
  const inputTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  
  // 현재 시간보다 과거면 다음날로 처리
  if (inputTime < now) {
    inputTime.setDate(inputTime.getDate() + 1);
  }
  
  return inputTime;
}

// 특정 행의 시간을 체크하고 배경색 업데이트
function checkTimeAndUpdateRowColor(tr) {
  if (!tr) return;
  
  // noTd가 없으면 첫 번째 셀(번호 셀)을 찾기
  if (!tr.noTd) {
    tr.noTd = tr.cells[0];
  }
  
  if (!tr.noTd) return;
  
  if (!tr.refs || !tr.refs.B) {
    tr.noTd.style.backgroundColor = '';
    return;
  }
  
  const timeStr = tr.refs.B.value.trim();
  if (!timeStr) {
    // 시간이 없으면 배경색 제거
    tr.noTd.style.backgroundColor = '';
    return;
  }
  
  const inputTime = parseTime(timeStr);
  if (!inputTime) {
    tr.noTd.style.backgroundColor = '';
    return;
  }
  
  const now = new Date();
  
  // 입력된 시간까지 남은 시간 계산 (분 단위)
  const diffMinutes = (inputTime - now) / (1000 * 60);
  
  // 디버깅 로그
  console.log('시간 체크:', {
    입력시간: timeStr,
    입력시간Date: inputTime.toLocaleTimeString('ko-KR'),
    현재시간: now.toLocaleTimeString('ko-KR'),
    남은시간: diffMinutes.toFixed(1) + '분',
    노란색: diffMinutes >= 0 && diffMinutes <= 75
  });
  
  // 입력된 시간까지 남은 시간이 75분 이내이고, 아직 지나지 않았으면 노란색 배경
  // 즉, 0 <= (입력된 시간 - 현재 시간) <= 75분 이면 노란색
  if (diffMinutes >= 0 && diffMinutes <= 75) {
    tr.noTd.style.setProperty('background-color', '#ffff00', 'important'); // 노란색
    tr.noTd.classList.add('time-warning');
    console.log('노란색 적용:', timeStr, '셀:', tr.noTd);
  } else {
    tr.noTd.style.removeProperty('background-color');
    tr.noTd.classList.remove('time-warning');
  }
}

// 모든 행의 시간을 체크하고 배경색 업데이트
function checkAllRowsTime() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) {
    console.log('tableBody를 찾을 수 없습니다.');
    return;
  }
  
  const rows = tbody.querySelectorAll('tr');
  console.log('시간 체크 실행:', rows.length, '행');
  
  rows.forEach((row, index) => {
    // noTd가 없으면 설정
    if (!row.noTd && row.cells && row.cells[0]) {
      row.noTd = row.cells[0];
    }
    checkTimeAndUpdateRowColor(row);
  });
}

// 모든 행 계산
function calculateAll() {
  if (!currentOptions) {
    showAlert('옵션을 먼저 불러와주세요.', 'error');
    return;
  }
  
  const rows = document.querySelectorAll('#tableBody tr');
  rows.forEach((row) => {
    updateRow(row);
  });
  
  showAlert('모든 행이 계산되었습니다.');
}

// 모든 데이터 저장
async function saveAll() {
  if (!currentOptions) {
    showAlert('옵션을 먼저 불러와주세요.', 'error');
    return;
  }
  
  const rows = document.querySelectorAll('#tableBody tr');
  const dataToSave = [];
  
  rows.forEach((row) => {
    updateRow(row); // 계산 후 저장
    
    const rowData = {
      A: row.cells[0].textContent,
      B: row.refs.B.value,
      C: row.refs.C.value,
      D: row.refs.D.value,
      E: row.refs.E.value,
      F: row.refs.F.value,
      G: row.refs.G.value,
      H: row.refs.H.value,
      I: row.refs.I.value,
      J: row.refs.J.value,
      K: row.refs.K.value,
      L: row.refs.L.value,
      M: row.refs.M.value,
      N: row.nTd.textContent,
      O: row.oTd.textContent,
      P: row.pTd.textContent,
      Q: row.qTd.textContent
    };
    
    // 빈 행이 아닌 경우만 저장
    const hasData = ['B', 'C', 'D', 'E', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].some(k => rowData[k]);
    if (hasData) {
      dataToSave.push(rowData);
    }
  });
  
  if (dataToSave.length === 0) {
    showAlert('저장할 데이터가 없습니다.', 'error');
    return;
  }
  
  try {
    for (const data of dataToSave) {
      await saveData(data);
    }
    showAlert(`${dataToSave.length}개의 행이 저장되었습니다.`);
    
    // 서버 저장 성공 시 localStorage도 업데이트
    saveToLocalStorage();
  } catch (error) {
    showAlert('데이터 저장에 실패했습니다.', 'error');
  }
}

// 데이터 불러오기
async function loadTableData() {
  try {
    const data = await loadData();
    if (data.length === 0) {
      showAlert('저장된 데이터가 없습니다.', 'error');
      return;
    }
    
    // 기존 행 제거
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    tableData = [];
    
    // 데이터 로드
    data.forEach((item, index) => {
      const row = addRow(index + 1);
      if (row.refs) {
        row.refs.B.value = item.B || '';
        row.refs.C.value = item.C || '';
        row.refs.D.value = item.D || '';
        row.refs.E.value = item.E || '';
        row.refs.F.value = item.F || '';
        row.refs.G.value = item.G || '';
        row.refs.H.value = item.H || '';
        row.refs.I.value = item.I || '';
        row.refs.J.value = item.J || '';
        row.refs.K.value = item.K || '';
        row.refs.L.value = item.L || '';
        row.refs.M.value = item.M || '';
      }
      updateRow(row);
    });
    
    showAlert(`${data.length}개의 행이 불러와졌습니다.`);
  } catch (error) {
    showAlert('데이터 불러오기에 실패했습니다.', 'error');
  }
}

// 셀 선택 함수
function selectCell(input, rowIndex, colIndex, skipClear) {
  // skipClear가 true가 아니면 기존 선택 초기화
  if (!skipClear) {
    clearCellSelection();
  }
  
  selectedCell = input;
  input.classList.add('selected');
  input.focus();
  
  // 선택된 셀 정보 저장
  pasteStartCell = {
    input: input,
    rowIndex: rowIndex,
    colIndex: colIndex
  };
}

// 셀 선택 초기화
function clearCellSelection() {
  if (selectedCell) {
    selectedCell.classList.remove('selected');
  }
  selectedCell = null;
  selectedCells.forEach(cell => {
    if (cell.classList) cell.classList.remove('cell-selected');
  });
  selectedCells.clear();
}

// 선택된 셀들 삭제
function clearSelectedCells() {
  selectedCells.forEach(cell => {
    if (cell.tagName === 'INPUT' || cell.tagName === 'SELECT') {
      cell.value = '';
      if (cell.oninput) {
        cell.oninput();
      }
      const tr = cell.closest('tr');
      if (tr) updateRow(tr);
    }
    cell.classList.remove('cell-selected');
  });
  selectedCells.clear();
  saveToLocalStorage();
}

// 행 선택 기능 설정 (A열만 작동)
function setupRowSelection() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) {
    console.error('tableBody를 찾을 수 없습니다.');
    return;
  }
  
  // A열(번호 열) 클릭 시 행 선택 처리
  tbody.addEventListener('click', function(e) {
    // 버튼 클릭은 제외
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
      return;
    }
    
    // td를 찾기
    const td = e.target.closest('td');
    if (!td) return;
    
    // A열(번호 열)인지 확인 - 첫 번째 td이거나 row-number-cell 클래스가 있는 경우
    const isFirstColumn = td.classList.contains('row-number-cell') || 
                          (td.parentElement && td === td.parentElement.querySelector('td:first-child'));
    
    // A열이 아니면 행 선택하지 않음
    if (!isFirstColumn) {
      return;
    }
    
    // tr 찾기
    const tr = td.closest('tr');
    if (!tr) return;
    
    // 모든 행에서 선택 클래스 제거
    const allRows = tbody.querySelectorAll('tr');
    allRows.forEach(row => {
      row.classList.remove('row-selected');
    });
    
    // 클릭한 행에 선택 클래스 추가
    tr.classList.add('row-selected');
    console.log('행 선택됨 (A열 클릭):', tr.cells[0]?.textContent || '알 수 없음');
  });
  
  console.log('행 선택 기능이 설정되었습니다. (A열만 작동)');
}

// 드래그 선택 설정
function setupDragSelection() {
  const tbody = document.getElementById('tableBody');
  let startCell = null;
  let mouseDownPos = null;
  
  tbody.addEventListener('mousedown', (e) => {
    const td = e.target.closest('td');
    if (!td) return;
    
    const input = td.querySelector('input, select');
    if (!input) return;
    
    // 조작 열은 제외
    if (td.querySelector('.btn-box')) return;
    
    // 계산된 열(N, O, P, Q)은 제외
    if (td.classList.contains('calculated-cell') || td.classList.contains('grade-cell')) return;
    
    // 버튼 클릭은 제외
    if (e.target.tagName === 'BUTTON') return;
    
    mouseDownPos = { x: e.clientX, y: e.clientY };
    startCell = { td, input, row: td.closest('tr') };
    
    // Shift 키를 누르지 않으면 기존 선택 초기화
    if (!e.shiftKey) {
      clearCellSelection();
    }
    
    // 시작 셀 선택
    if (!e.shiftKey) {
      const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(startCell.row);
      const colIndex = getColumnIndex(td);
      selectCell(startCell.input, rowIndex, colIndex, true);
    }
    
    // input 내부 클릭이 아닌 경우에만 preventDefault
    if (e.target !== input && e.target.tagName !== 'OPTION') {
      e.preventDefault();
    }
  });
  
  tbody.addEventListener('mousemove', (e) => {
    if (!startCell || !mouseDownPos) return;
    
    // 마우스가 3픽셀 이상 움직였을 때만 드래그 시작
    const deltaX = Math.abs(e.clientX - mouseDownPos.x);
    const deltaY = Math.abs(e.clientY - mouseDownPos.y);
    
    if (deltaX > 3 || deltaY > 3) {
      isDragging = true;
      
      const td = e.target.closest('td');
      if (!td) return;
      
      const input = td.querySelector('input, select');
      if (!input) return;
      
      // 조작 열은 제외
      if (td.querySelector('.btn-box')) return;
      
      // 계산된 열은 제외
      if (td.classList.contains('calculated-cell') || td.classList.contains('grade-cell')) return;
      
      const endRow = td.closest('tr');
      const startRow = startCell.row;
      
      const startRowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(startRow);
      const endRowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(endRow);
      const startColIndex = getColumnIndex(startCell.td);
      const endColIndex = getColumnIndex(td);
      
      // 범위 내의 모든 셀 선택
      const minRow = Math.min(startRowIndex, endRowIndex);
      const maxRow = Math.max(startRowIndex, endRowIndex);
      const minCol = Math.min(startColIndex, endColIndex);
      const maxCol = Math.max(startColIndex, endColIndex);
      
      // 기존 선택 제거
      selectedCells.forEach(cell => {
        cell.classList.remove('cell-selected');
      });
      selectedCells.clear();
      
      // 범위 내의 모든 셀 선택
      // colIdx는 0부터 시작 (0=번호, 1=B, 2=C, ...)
      for (let rowIdx = minRow; rowIdx <= maxRow; rowIdx++) {
        const row = tbody.querySelectorAll('tr')[rowIdx];
        if (!row || !row.refs) continue;
        
        for (let colIdx = minCol; colIdx <= maxCol; colIdx++) {
          // 번호 열(0)은 제외
          if (colIdx === 0) continue;
          
          const colMap = { 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H', 8: 'I', 9: 'J', 10: 'K', 11: 'L', 12: 'M' };
          const colKey = colMap[colIdx];
          // B부터 M까지 선택 가능
          if (colKey && colIdx <= 12 && row.refs[colKey]) {
            const cell = row.refs[colKey];
            selectedCells.add(cell);
            cell.classList.add('cell-selected');
          }
        }
      }
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging && startCell) {
      isDragging = false;
    }
    startCell = null;
    mouseDownPos = null;
  });
}

// 열 인덱스 가져오기
function getColumnIndex(td) {
  const row = td.closest('tr');
  if (!row) return -1;
  
  const cells = Array.from(row.querySelectorAll('td'));
  const index = cells.indexOf(td);
  
  // 번호 열이 0번이므로, B열은 1번부터 시작
  // index가 0이면 번호 열, 1이면 B열, 2이면 C열...
  return index; // index를 그대로 반환 (번호 열=0, B열=1, C열=2...)
}

// 키보드 단축키 설정
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Delete 또는 Backspace 키로 선택된 셀 삭제
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
      if (selectedCells.size > 0) {
        e.preventDefault();
        clearSelectedCells();
        return;
      } else if (selectedCell && document.activeElement === selectedCell) {
        e.preventDefault();
        selectedCell.value = '';
        if (selectedCell.oninput) {
          selectedCell.oninput();
        }
        const tr = selectedCell.closest('tr');
        if (tr) updateRow(tr);
        saveToLocalStorage();
        return;
      }
    }
    
    if (e.ctrlKey && e.key === 'c') {
      // 복사는 기본 동작 사용
      return;
    }
    
    // Tab, Enter, 화살표 키로 셀 이동
    if (selectedCell && document.activeElement === selectedCell) {
      // rowIndex를 동적으로 가져오기
      const tbody = document.getElementById('tableBody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const tr = selectedCell.closest('tr');
      const rowIndex = rows.indexOf(tr);
      const colIndex = parseInt(selectedCell.dataset.colIndex);
      
      if (e.key === 'Tab') {
        e.preventDefault();
        clearCellSelection();
        moveToNextCell(rowIndex, colIndex, e.shiftKey);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        clearCellSelection();
        moveToNextCell(rowIndex, colIndex, false);
      } else if (e.key === 'ArrowRight' && !e.ctrlKey) {
        e.preventDefault();
        clearCellSelection();
        moveToNextCell(rowIndex, colIndex, false);
      } else if (e.key === 'ArrowLeft' && !e.ctrlKey) {
        e.preventDefault();
        clearCellSelection();
        moveToNextCell(rowIndex, colIndex, true);
      } else if (e.key === 'ArrowDown' && !e.ctrlKey) {
        e.preventDefault();
        clearCellSelection();
        moveToCell(rowIndex + 1, colIndex);
      } else if (e.key === 'ArrowUp' && !e.ctrlKey) {
        e.preventDefault();
        clearCellSelection();
        moveToCell(rowIndex - 1, colIndex);
      }
    }
  });
}

// 다음 셀로 이동
function moveToNextCell(rowIndex, colIndex, reverse) {
  const maxCol = 12; // B부터 M까지 (1~12)
  let nextColIndex = reverse ? colIndex - 1 : colIndex + 1;
  
  if (nextColIndex < 1) {
    // 이전 행의 마지막 열로
    if (rowIndex > 0) {
      moveToCell(rowIndex - 1, maxCol);
    }
  } else if (nextColIndex > maxCol) {
    // 다음 행의 첫 열로
    moveToCell(rowIndex + 1, 1);
  } else {
    moveToCell(rowIndex, nextColIndex);
  }
}

// 특정 셀로 이동
function moveToCell(rowIndex, colIndex) {
  if (rowIndex < 0) return;
  
  const tbody = document.getElementById('tableBody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  
  if (rowIndex >= rows.length) {
    // 행이 없으면 추가
    addRow(rowIndex + 1);
    const newRows = Array.from(tbody.querySelectorAll('tr'));
    if (newRows[rowIndex]) {
      const colMap = { 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H', 8: 'I', 9: 'J', 10: 'K', 11: 'L', 12: 'M' };
      const colKey = colMap[colIndex];
      if (colKey && newRows[rowIndex].refs && newRows[rowIndex].refs[colKey]) {
        const actualRowIndex = rows.length; // 새로 추가된 행의 인덱스
        selectCell(newRows[rowIndex].refs[colKey], actualRowIndex, colIndex);
      }
    }
    return;
  }
  
  const row = rows[rowIndex];
  if (row && row.refs) {
    const colMap = { 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H', 8: 'I', 9: 'J', 10: 'K', 11: 'L', 12: 'M' };
    const colKey = colMap[colIndex];
    if (colKey && row.refs[colKey]) {
      selectCell(row.refs[colKey], rowIndex, colIndex);
    }
  }
}

// 붙여넣기 핸들러 설정
function setupPasteHandler() {
  document.addEventListener('paste', (e) => {
    if (!pasteStartCell) return;
    
    e.preventDefault();
    
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedText = clipboardData.getData('text');
    
    if (pastedText) {
      pasteData(pastedText, pasteStartCell);
    }
  });
}

// 데이터 붙여넣기 함수
function pasteData(text, startCell) {
  if (!startCell) return;
  
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return;
  
  const tbody = document.getElementById('tableBody');
  let currentRowIndex = startCell.rowIndex;
  let currentColIndex = startCell.colIndex;
  
  // 열 매핑: B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11, M=12 (A열은 번호이므로 제외)
  const colMap = { 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H', 8: 'I', 9: 'J', 10: 'K', 11: 'L', 12: 'M' };
  
  lines.forEach((line, lineIndex) => {
    const values = line.split('\t');
    
    // 필요한 행이 없으면 추가
    while (currentRowIndex >= tbody.querySelectorAll('tr').length) {
      addRow(tbody.querySelectorAll('tr').length + 1);
    }
    
    const rows = tbody.querySelectorAll('tr');
    const currentRow = rows[currentRowIndex];
    
    if (!currentRow || !currentRow.refs) return;
    
    // 엑셀에서 복사한 데이터 처리
    // A열(번호)이 포함되어 있을 수 있으므로, 첫 번째 값이 숫자인지 확인
    let startColOffset = 0;
    
    // 만약 첫 번째 값이 숫자이고, 현재 선택된 열이 B열(1)이라면
    // A열이 포함된 것으로 간주하고 건너뛰기
    if (currentColIndex === 1 && values.length > 0) {
      const firstValue = values[0].trim();
      // 첫 번째 값이 숫자이고, 현재 선택이 B열이면 A열이 포함된 것으로 간주
      if (/^\d+$/.test(firstValue)) {
        startColOffset = 1; // A열 건너뛰기
      }
    }
    
    // 각 열에 값 붙여넣기 (B부터 L까지)
    values.forEach((value, colOffset) => {
      const actualColOffset = colOffset - startColOffset;
      const targetColIndex = currentColIndex + actualColOffset;
      
      // B부터 M까지 처리 (1~12)
      if (targetColIndex >= 1 && targetColIndex <= 12) {
        const colKey = colMap[targetColIndex];
        
        if (colKey && currentRow.refs[colKey]) {
          const input = currentRow.refs[colKey];
          input.value = value.trim();
          
          // tableData 업데이트
          if (tableData[currentRowIndex]) {
            tableData[currentRowIndex][colKey] = value.trim();
          }
          
          // 행 계산 업데이트
          updateRow(currentRow);
        }
      }
    });
    
    currentRowIndex++;
  });
  
  // 마지막으로 붙여넣은 셀 선택
  if (lines.length > 0) {
    const lastLineValues = lines[lines.length - 1].split('\t');
    const finalRowIndex = startCell.rowIndex + lines.length - 1;
    // 마지막 열 계산 (B부터 M까지 중 하나)
    let lastColOffset = lastLineValues.length - 1;
    if (currentColIndex === 1 && /^\d+$/.test(lastLineValues[0]?.trim())) {
      lastColOffset--; // A열이 포함된 경우 보정
    }
    const finalColIndex = Math.min(currentColIndex + lastColOffset, 12);
    moveToCell(finalRowIndex, finalColIndex);
  }
  
  // 붙여넣기 후 localStorage에 저장
  saveToLocalStorage();
}

// 실시간 리스너 설정
function setupRealtimeListener() {
  realtimeUnsubscribe = setupInputSheetListener((data) => {
    // 자신이 저장한 변경사항은 무시 (무한 루프 방지)
    if (!isUpdatingFromFirebase) {
      isUpdatingFromFirebase = true;
      console.log('Firebase에서 데이터 업데이트 받음:', data.length, '행');
      loadDataFromArray(data);
      // 약간의 지연 후 플래그 해제
      setTimeout(() => {
        isUpdatingFromFirebase = false;
      }, 100);
    }
  });
}

// 배열 데이터를 테이블에 로드
function loadDataFromArray(data) {
  const tbody = document.getElementById('tableBody');
  
  // 현재 포커스된 셀 저장
  const activeElement = document.activeElement;
  const isFocusedInTable = activeElement && activeElement.closest('#tableBody');
  
  // 포커스된 셀의 위치 저장
  let focusedRowIndex = -1;
  let focusedColKey = null;
  if (isFocusedInTable) {
    const focusedRow = activeElement.closest('tr');
    if (focusedRow) {
      focusedRowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(focusedRow);
      focusedColKey = activeElement.dataset.k;
    }
  }
  
  // 기존 행 제거
  tbody.innerHTML = '';
  tableData = [];
  
  // 데이터를 시간 순서로 정렬 (12:00~24:00가 당일 먼저, 00:00~12:00가 다음날)
  const sortedData = [...data].sort((a, b) => {
    const timeA = parseTimeForSort(a.B || '');
    const timeB = parseTimeForSort(b.B || '');
    
    if (!timeA && !timeB) return 0;
    if (!timeA) return 1; // 시간 없는 것은 뒤로
    if (!timeB) return -1;
    
    return timeA - timeB; // 시간 순서대로 정렬
  });
  
  // 데이터 로드
  sortedData.forEach((item, index) => {
    const row = addRow(index + 1);
    if (row.refs) {
      row.refs.B.value = item.B || '';
      row.refs.C.value = item.C || '';
      row.refs.D.value = item.D || '';
      row.refs.E.value = item.E || '';
      row.refs.F.value = item.F || '';
      row.refs.G.value = item.G || '';
      row.refs.H.value = item.H || '';
      row.refs.I.value = item.I || '';
      row.refs.J.value = item.J || '';
      row.refs.K.value = item.K || '';
      row.refs.L.value = item.L || '';
      row.refs.M.value = item.M || '';
      
      // 시간 체크 및 배경색 업데이트
      checkTimeAndUpdateRowColor(row);
      
      // 시간 정보 복원
      const restoreTime = (ref, timeStr) => {
        if (ref && timeStr) {
          const td = ref.parentElement;
          if (td) {
            let s = td.querySelector('small');
            if (!s) {
              s = document.createElement('small');
              td.appendChild(s);
            }
            s.textContent = timeStr;
          }
        }
      };
      
      if (item.G_time) restoreTime(row.refs.G, item.G_time);
      if (item.I_time) restoreTime(row.refs.I, item.I_time);
      if (item.J_time) restoreTime(row.refs.J, item.J_time);
      if (item.K_time) restoreTime(row.refs.K, item.K_time);
      if (item.L_time) restoreTime(row.refs.L, item.L_time);
      if (item.M_time) restoreTime(row.refs.M, item.M_time);
    }
    updateRow(row);
  });
  
  // 최소 30개 행 유지
  const currentRowCount = tbody.querySelectorAll('tr').length;
  for (let i = currentRowCount; i < 30; i++) {
    addRow(i + 1);
  }
  
  // 포커스 복원 (사용자가 입력 중이었다면)
  if (focusedRowIndex >= 0 && focusedColKey) {
    const rows = tbody.querySelectorAll('tr');
    if (rows[focusedRowIndex] && rows[focusedRowIndex].refs && rows[focusedRowIndex].refs[focusedColKey]) {
      rows[focusedRowIndex].refs[focusedColKey].focus();
    }
  }
}

// localStorage에 임시 저장 및 Firebase에 실시간 저장
function saveToLocalStorage() {
  const tbody = document.getElementById('tableBody');
  const rows = tbody.querySelectorAll('tr');
  const tempData = [];
  
  rows.forEach((row) => {
    if (row.refs) {
      // 시간 정보 추출 (small 태그에서)
      const getTimeFromCell = (ref) => {
        if (!ref) return '';
        const td = ref.parentElement;
        if (!td) return '';
        const small = td.querySelector('small');
        return small ? small.textContent : '';
      };
      
      const rowData = {
        B: row.refs.B.value || '',
        C: row.refs.C.value || '',
        D: row.refs.D.value || '',
        E: row.refs.E.value || '',
        F: row.refs.F.value || '',
        G: row.refs.G.value || '',
        G_time: getTimeFromCell(row.refs.G),
        H: row.refs.H.value || '',
        I: row.refs.I.value || '',
        I_time: getTimeFromCell(row.refs.I),
        J: row.refs.J.value || '',
        J_time: getTimeFromCell(row.refs.J),
        K: row.refs.K.value || '',
        K_time: getTimeFromCell(row.refs.K),
        L: row.refs.L.value || '',
        L_time: getTimeFromCell(row.refs.L),
        M: row.refs.M.value || '',
        M_time: getTimeFromCell(row.refs.M)
      };
      
      // 빈 행이 아닌 경우만 저장
      const hasData = ['B', 'C', 'D', 'E', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].some(k => rowData[k]);
      if (hasData) {
        tempData.push(rowData);
      }
    }
  });
  
  try {
    localStorage.setItem('inputSheetTemp', JSON.stringify(tempData));
    
    // Firebase에 실시간 저장 (Firebase에서 업데이트 중이 아닐 때만)
    // 디바운싱: 500ms 내에 여러 번 호출되면 마지막 것만 저장
    if (!isUpdatingFromFirebase) {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      saveTimeout = setTimeout(() => {
        saveInputSheetData(tempData).catch(err => {
          console.warn('Firebase 저장 실패:', err);
          // 내부 오류인 경우 사용자에게 알림
          if (err.message && err.message.includes('INTERNAL ASSERTION')) {
            console.error('Firestore 내부 오류. 데이터를 다시 시도합니다...');
            // 2초 후 재시도
            setTimeout(() => {
              saveInputSheetData(tempData).catch(retryErr => {
                console.error('재시도도 실패:', retryErr);
              });
            }, 2000);
          }
        });
      }, 500);
    }
  } catch (error) {
    console.warn('localStorage 저장 실패:', error);
  }
}

// localStorage에서 복원
function loadFromLocalStorage() {
  try {
    const tempDataStr = localStorage.getItem('inputSheetTemp');
    if (tempDataStr) {
      const tempData = JSON.parse(tempDataStr);
      if (tempData && tempData.length > 0) {
        // 기존 행 제거
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';
        tableData = [];
        
        // 데이터 복원
        tempData.forEach((item, index) => {
          const row = addRow(index + 1);
          if (row.refs) {
            row.refs.B.value = item.B || '';
            row.refs.C.value = item.C || '';
            row.refs.D.value = item.D || '';
            row.refs.E.value = item.E || '';
            row.refs.F.value = item.F || '';
            row.refs.G.value = item.G || '';
            row.refs.H.value = item.H || '';
            row.refs.I.value = item.I || '';
            row.refs.J.value = item.J || '';
            row.refs.K.value = item.K || '';
            row.refs.L.value = item.L || '';
            row.refs.M.value = item.M || '';
            
            // 시간 체크 및 배경색 업데이트
            checkTimeAndUpdateRowColor(row);
            
            // 시간 정보 복원
            const restoreTime = (ref, timeStr) => {
              if (ref && timeStr) {
                const td = ref.parentElement;
                if (td) {
                  let s = td.querySelector('small');
                  if (!s) {
                    s = document.createElement('small');
                    td.appendChild(s);
                  }
                  s.textContent = timeStr;
                }
              }
            };
            
            // G, I, J, K, L, M 열의 시간 정보 복원
            if (item.G && item.G_time) restoreTime(row.refs.G, item.G_time);
            if (item.I && item.I_time) restoreTime(row.refs.I, item.I_time);
            if (item.J && item.J_time) restoreTime(row.refs.J, item.J_time);
            if (item.K && item.K_time) restoreTime(row.refs.K, item.K_time);
            if (item.L && item.L_time) restoreTime(row.refs.L, item.L_time);
            if (item.M && item.M_time) restoreTime(row.refs.M, item.M_time);
            
            // 행의 값이 모두 로드된 후 숨김 상태 확인
            setTimeout(() => {
              if (row.refs.hideBtn && row.refs.opTd) {
                const rowId = `${row.refs.B?.value || ''}_${row.refs.C?.value || ''}_${row.refs.D?.value || ''}_${row.refs.E?.value || ''}`;
                const hiddenIds = getHiddenRowIds();
                if (hiddenIds.includes(rowId)) {
                  row.refs.hideBtn.textContent = '숨김됨';
                  row.refs.hideBtn.style.opacity = '0.5';
                  row.refs.opTd.style.backgroundColor = '#808080'; // R열 배경색 어둡게
                } else {
                  row.refs.hideBtn.textContent = '숨김';
                  row.refs.hideBtn.style.opacity = '1';
                  row.refs.opTd.style.backgroundColor = ''; // R열 배경색 제거
                }
              }
            }, 0);
          }
          updateRow(row);
        });
        
        // 빈 행 몇 개 추가 (최소 30개 유지)
        const currentRowCount = tbody.querySelectorAll('tr').length;
        for (let i = currentRowCount; i < 30; i++) {
          addRow(i + 1);
        }
        
        // 데이터 로드 후 모든 행의 시간 체크
        setTimeout(() => {
          checkAllRowsTime();
        }, 500);
        
        return true;
      }
    }
  } catch (error) {
    console.warn('localStorage 불러오기 실패:', error);
  }
  return false;
}

// 옵션 설정 페이지 열기
function openOptions() {
  // 현재 경로에 따라 상대 경로 결정
  const currentPath = window.location.pathname;
  if (currentPath.includes('/bjb')) {
    window.location.href = '../options.html';
  } else {
    window.location.href = 'options.html';
  }
}

// 계정 설정 모달 열기
function openAccountModal() {
  const modal = document.getElementById('accountModal');
  // 새 계정 추가 모드이므로 폼 초기화
  document.getElementById('accountForm').reset();
  modal.style.display = 'block';
}

// 계정 관리 모달 열기
function openAccountManageModal() {
  const modal = document.getElementById('accountManageModal');
  refreshAccountList();
  modal.style.display = 'block';
}

// 계정 관리 모달 닫기
function closeAccountManageModal() {
  const modal = document.getElementById('accountManageModal');
  modal.style.display = 'none';
}

// 모든 계정 가져오기
function getAllAccounts() {
  try {
    const accountsStr = localStorage.getItem('viewPageAccounts');
    if (accountsStr) {
      return JSON.parse(accountsStr);
    }
    // 기존 단일 계정 형식 호환성 처리
    const oldAccountStr = localStorage.getItem('viewPageAccount');
    if (oldAccountStr) {
      const oldAccount = JSON.parse(oldAccountStr);
      const accounts = [{
        userId: oldAccount.userId,
        password: oldAccount.password,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }];
      localStorage.setItem('viewPageAccounts', JSON.stringify(accounts));
      localStorage.removeItem('viewPageAccount');
      return accounts;
    }
  } catch (error) {
    console.warn('계정 불러오기 실패:', error);
  }
  return [];
}

// 계정 목록 새로고침
function refreshAccountList() {
  const accountList = document.getElementById('accountList');
  const accounts = getAllAccounts();
  
  if (accounts.length === 0) {
    accountList.innerHTML = '<p class="no-accounts">등록된 계정이 없습니다.</p>';
    return;
  }
  
  accountList.innerHTML = accounts.map((account, index) => {
    const createdDate = account.createdAt ? new Date(account.createdAt).toLocaleString('ko-KR') : '알 수 없음';
    
    return `
      <div class="account-item">
        <div class="account-info">
          <div class="account-id">아이디: ${account.userId}</div>
          <div class="account-password">비밀번호: ${account.password}</div>
          <div class="account-dates">
            <small>생성일: ${createdDate}</small>
          </div>
        </div>
        <div class="account-actions">
          <!-- 계정 삭제 기능 제거: 생성된 계정 정보는 삭제할 수 없습니다 -->
        </div>
      </div>
    `;
  }).join('');
}

// 계정 삭제 기능 제거됨 - 생성된 계정 정보는 삭제할 수 없습니다
// function deleteAccount(userId) {
//   // 계정 삭제 기능이 비활성화되었습니다.
//   alert('계정 정보는 삭제할 수 없습니다.');
// }


// 계정 설정 모달 닫기
function closeAccountModal() {
  const modal = document.getElementById('accountModal');
  modal.style.display = 'none';
  document.getElementById('accountForm').reset();
}

// 계정 저장
function saveAccount(event) {
  event.preventDefault();
  
  const userId = document.getElementById('accountId').value.trim();
  const password = document.getElementById('accountPassword').value;
  const passwordConfirm = document.getElementById('accountPasswordConfirm').value;
  
  if (!userId) {
    alert('아이디를 입력해주세요.');
    return;
  }
  
  if (!password) {
    alert('비밀번호를 입력해주세요.');
    return;
  }
  
  if (password !== passwordConfirm) {
    alert('비밀번호가 일치하지 않습니다.');
    document.getElementById('accountPasswordConfirm').focus();
    return;
  }
  
  // 계정 목록 가져오기
  let accounts = getAllAccounts();
  
  // 중복 체크
  const existingIndex = accounts.findIndex(acc => acc.userId === userId);
  if (existingIndex !== -1) {
    // 기존 계정 업데이트
    accounts[existingIndex].password = password;
    accounts[existingIndex].updatedAt = new Date().toISOString();
  } else {
    // 새 계정 추가
    accounts.push({
      userId: userId,
      password: password,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  // localStorage에 저장
  localStorage.setItem('viewPageAccounts', JSON.stringify(accounts));
  
  alert('계정이 생성되었습니다!');
  closeAccountModal();
}


// 아이디 복사
function copyUserId(userId) {
  navigator.clipboard.writeText(userId).then(() => {
    alert('아이디가 클립보드에 복사되었습니다!');
  }).catch(() => {
    // 클립보드 API 실패 시 대체 방법
    const textArea = document.createElement('textarea');
    textArea.value = userId;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert('아이디가 클립보드에 복사되었습니다!');
  });
}

// 모달 외부 클릭 시 닫기
window.onclick = function(event) {
  const accountModal = document.getElementById('accountModal');
  const accountManageModal = document.getElementById('accountManageModal');
  
  if (event.target === accountModal) {
    closeAccountModal();
  }
  if (event.target === accountManageModal) {
    closeAccountManageModal();
  }
}

// 시트 전체 삭제 (저장된 데이터도 함께 삭제)
async function deleteAllRows() {
  if (!confirm('정말로 시트의 모든 데이터를 삭제하시겠습니까?\n저장된 데이터도 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.')) {
    return;
  }
  
  // 한 번 더 확인
  if (!confirm('마지막 확인입니다. 모든 데이터(저장된 데이터 포함)를 삭제하시겠습니까?')) {
    return;
  }
  
  try {
    // Firebase의 data 컬렉션에 저장된 모든 데이터 삭제
    const result = await deleteAllData();
    console.log(`${result.count}개의 저장된 데이터가 삭제되었습니다.`);
    
    // 입력 시트 초기화
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    tableData = [];
    
    // 빈 행 30개 추가
    for (let i = 1; i <= 30; i++) {
      addRow(i);
    }
    
    // localStorage도 초기화
    localStorage.removeItem('inputSheetTemp');
    
    // Firebase의 inputSheet도 빈 상태로 저장
    await saveToLocalStorage();
    
    showAlert(`시트의 모든 데이터가 삭제되었습니다. (저장된 데이터 ${result.count}개 포함)`, 'success');
  } catch (error) {
    console.error('데이터 삭제 실패:', error);
    showAlert('데이터 삭제 중 오류가 발생했습니다.', 'error');
  }
}

// 여러 행 추가 함수
function addMultipleRows() {
  const count = prompt('추가할 행 개수를 입력하세요:', '1');
  
  // 취소 버튼을 누르면 null 반환
  if (count === null) {
    return;
  }
  
  // 숫자로 변환
  const numRows = parseInt(count, 10);
  
  // 유효성 검사
  if (isNaN(numRows) || numRows <= 0) {
    alert('올바른 숫자를 입력해주세요.');
    return;
  }
  
  // 최대 100개로 제한
  if (numRows > 100) {
    alert('한 번에 최대 100개의 행만 추가할 수 있습니다.');
    return;
  }
  
  // 현재 행 개수 확인
  const tbody = document.getElementById('tableBody');
  const currentRowCount = tbody.querySelectorAll('tr').length;
  
  // 지정된 개수만큼 행 추가
  for (let i = 0; i < numRows; i++) {
    addRow(currentRowCount + i + 1);
  }
  
  showAlert(`${numRows}개의 행이 추가되었습니다.`);
}

// 전역으로 함수들을 export (HTML의 onclick 속성에서 사용하기 위해)
window.addRow = addRow;
window.addMultipleRows = addMultipleRows;
window.openOptions = openOptions;
window.saveAll = saveAll;
window.openAccountModal = openAccountModal;
window.openAccountManageModal = openAccountManageModal;
window.closeAccountModal = closeAccountModal;
window.closeAccountManageModal = closeAccountManageModal;
window.saveAccount = saveAccount;
// window.deleteAccount = deleteAccount; // 계정 삭제 기능 제거됨
window.deleteAllRows = deleteAllRows;
