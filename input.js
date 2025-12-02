// app.js에서 함수 import
import { loadOptions, showAlert, calculateColumn17, calculateColumn18, saveInputSheetData, loadInputSheetData, setupInputSheetListener, deleteAllData, migrateRemoveOldFields, saveHiddenRowIds, loadHiddenRowIds, setupHiddenRowIdsListener, saveData, saveDataBatch, loadData, deleteData } from './app.js';
import { db } from './firebase-config.js';
import { doc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentOptions = null;
let tableData = [];
let selectedCell = null;
let pasteStartCell = null;
let isDragging = false;
let selectedCells = new Set(); // 선택된 셀들을 Set으로 관리
let realtimeUnsubscribe = null; // 실시간 리스너 구독 해제 함수
let isUserTyping = false; // 사용자가 입력 중인지 추적
let typingTimeout = null; // 입력 종료 후 타임아웃
let isUpdatingFromFirebase = false; // Firebase에서 업데이트 중인지 플래그
let saveTimeout = null; // 디바운싱을 위한 타이머

// 숨김된 행 ID 목록 관리 (Firebase 기반)
let hiddenRowIdsCache = [];
let hiddenRowIdsUnsubscribe = null;

async function getHiddenRowIds() {
  try {
    // Firebase에서 불러오기
    const ids = await loadHiddenRowIds();
    hiddenRowIdsCache = ids;
    return ids;
  } catch (error) {
    console.warn('Firebase에서 숨김 행 ID 불러오기 실패, 캐시 사용:', error);
    return hiddenRowIdsCache;
  }
}

async function setHiddenRowIds(ids) {
  try {
    hiddenRowIdsCache = ids;
    // Firebase에 저장
    await saveHiddenRowIds(ids);
    // localStorage에도 백업 저장
    try {
      localStorage.setItem('inputHiddenRowIds', JSON.stringify(ids));
    } catch (e) {
      console.warn('localStorage 백업 저장 실패:', e);
    }
  } catch (error) {
    console.error('Firebase에 숨김 행 ID 저장 실패:', error);
    // 실패해도 localStorage에 백업
    try {
      localStorage.setItem('inputHiddenRowIds', JSON.stringify(ids));
    } catch (e) {
      console.warn('localStorage 백업 저장 실패:', e);
    }
  }
}

async function addHiddenRowId(id) {
  const hiddenIds = await getHiddenRowIds();
  if (!hiddenIds.includes(id)) {
    hiddenIds.push(id);
    await setHiddenRowIds(hiddenIds);
  }
}

async function removeHiddenRowId(id) {
  const hiddenIds = await getHiddenRowIds();
  const index = hiddenIds.indexOf(id);
  if (index > -1) {
    hiddenIds.splice(index, 1);
    await setHiddenRowIds(hiddenIds);
  }
}

// 값 정규화 함수 (rowId 생성 시 일관성 유지)
function normalizeValueForRowId(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  return String(value).trim();
}

// 모든 행의 숨김 상태 업데이트
async function updateAllRowsHideStatus() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  
  const rows = tbody.querySelectorAll('tr');
  const hiddenIds = await getHiddenRowIds();
  
  rows.forEach(row => {
    if (row.refs && row.refs.hideBtn && row.refs.opTd) {
      const rowId = `${normalizeValueForRowId(row.refs.B?.value)}_${normalizeValueForRowId(row.refs.C?.value)}_${normalizeValueForRowId(row.refs.D?.value)}_${normalizeValueForRowId(row.refs.E?.value)}`;
      if (hiddenIds.includes(rowId)) {
        row.refs.hideBtn.textContent = '숨김됨';
        row.refs.hideBtn.style.opacity = '0.5';
        row.refs.opTd.style.backgroundColor = '#808080';
      } else {
        row.refs.hideBtn.textContent = '숨김';
        row.refs.hideBtn.style.opacity = '1';
        row.refs.opTd.style.backgroundColor = '';
      }
    }
  });
}

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', async () => {
  await loadOptionsData();
  
  // 🔥 자동 마이그레이션: BC, G_time, I_time 필드 제거
  const migrationDone = localStorage.getItem('migration_bc_removed_v2');
  if (!migrationDone) {
    try {
      await migrateRemoveOldFields();
      localStorage.setItem('migration_bc_removed_v2', 'true');
    } catch (error) {
      console.error('❌ 자동 마이그레이션 실패:', error);
    }
  }
  
  // 로컬 스토리지 데이터도 정리
  const localStorageData = localStorage.getItem('inputSheetData');
  if (localStorageData) {
    try {
      const data = JSON.parse(localStorageData);
      let needsClean = false;
      const cleanedData = data.map(row => {
        if (row.BC !== undefined || row.G_time !== undefined || row.I_time !== undefined) {
          needsClean = true;
          const { BC, G_time, I_time, ...rest } = row;
          // BC를 C로 변환
          if (BC && !rest.C) {
            rest.C = BC;
          }
          return rest;
        }
        return row;
      });
      
      if (needsClean) {
        localStorage.setItem('inputSheetData', JSON.stringify(cleanedData));
      }
    } catch (error) {
      console.error('로컬 스토리지 정리 실패:', error);
    }
  }
  
  // 초기 로드 플래그 설정 (실시간 리스너가 초기 로드를 덮어쓰지 않도록)
  isUpdatingFromFirebase = true;
  
  // Firebase에서 숨김 행 ID 불러오기
  try {
    const hiddenIds = await loadHiddenRowIds();
    hiddenRowIdsCache = hiddenIds;
    // localStorage에도 백업 저장
    try {
      localStorage.setItem('inputHiddenRowIds', JSON.stringify(hiddenIds));
    } catch (e) {
      console.warn('localStorage 백업 저장 실패:', e);
    }
  } catch (error) {
    console.warn('Firebase에서 숨김 행 ID 불러오기 실패, localStorage 사용:', error);
    // Firebase 실패 시 localStorage에서 복원 시도
    try {
      const localHiddenStr = localStorage.getItem('inputHiddenRowIds');
      if (localHiddenStr) {
        hiddenRowIdsCache = JSON.parse(localHiddenStr);
      }
    } catch (e) {
      console.warn('localStorage에서도 불러오기 실패:', e);
    }
  }
  
  // 숨김 행 ID 실시간 리스너 설정
  hiddenRowIdsUnsubscribe = setupHiddenRowIdsListener((ids) => {
    hiddenRowIdsCache = ids;
    // 모든 행의 숨김 상태 업데이트
    updateAllRowsHideStatus();
  });
  
  // 1. Firebase에서 데이터 불러오기 (우선순위 1 - 로컬과 웹 동기화를 위해)
  const firebaseData = await loadInputSheetData();
  console.log('📥 Firebase에서 불러온 데이터:', firebaseData ? firebaseData.length : 0, '행');
  
  if (firebaseData && Array.isArray(firebaseData) && firebaseData.length > 0) {
    console.log('✅ Firebase 데이터 로드 성공, 테이블에 로드합니다.');
    loadDataFromArray(firebaseData);
  } else {
    // 2. Firebase에 데이터가 없으면 localStorage에서 복원 시도 (백업)
    console.log('⚠️ Firebase에 데이터가 없습니다. localStorage에서 복원 시도...');
    const localData = loadFromLocalStorage();
    if (localData && Array.isArray(localData) && localData.length > 0) {
      console.log('✅ localStorage에서 데이터 복원 성공:', localData.length, '행');
      loadDataFromArray(localData);
    } else {
      // 3. localStorage에도 데이터가 없으면 빈 행 30개 생성 (tableBody만)
      console.log('⚠️ 저장된 데이터가 없습니다. 빈 행을 생성합니다.');
      // 초기 로드 시에는 tableBody만 사용 (mainSheet가 기본 활성화되어 있음)
      const initialTbody = document.getElementById('tableBody');
      if (initialTbody) {
        // mainSheet가 활성화되어 있는지 확인
        const mainSheet = document.getElementById('mainSheet');
        const isMainSheetActive = mainSheet && mainSheet.classList.contains('active');
        
        // mainSheet가 활성화되어 있거나 활성 시트가 없을 때만 행 추가
        if (!document.querySelector('.sheet-content.active') || isMainSheetActive) {
          for (let i = 1; i <= 30; i++) {
            addRow(i);
          }
        }
      }
    }
  }
  
  // 최소 30개 행 유지 (데이터가 적은 경우) - tableBody만 확인 (tableBodyAuto는 탭 전환 시 처리)
  const tbody = document.getElementById('tableBody');
  if (tbody) {
    const currentRowCount = tbody.querySelectorAll('tr').length;
    if (currentRowCount < 30) {
      // tableBody에만 행 추가
      // addRow 함수가 활성 시트를 확인하므로, mainSheet가 활성화되어 있을 때만 추가
      const activeSheet = document.querySelector('.sheet-content.active');
      const isMainSheetActive = activeSheet && activeSheet.id === 'mainSheet';
      
      // mainSheet가 활성화되어 있거나 활성 시트가 없을 때만 tableBody에 추가
      if (!activeSheet || isMainSheetActive) {
        for (let i = currentRowCount; i < 30; i++) {
          addRow(i + 1);
        }
      }
    }
  }
  
  // 초기 로드 완료 후 플래그 해제 및 실시간 리스너 설정 (3초 후)
  setTimeout(() => {
    isUpdatingFromFirebase = false;
    setupRealtimeListener();
  }, 3000);
  
  // UI 이벤트 핸들러 설정
  setupKeyboardShortcuts();
  setupPasteHandler();
  setupDragSelection();
  setupRowSelection();
  
  // 시간 체크를 주기적으로 실행 (1분마다)
  setInterval(checkAllRowsTime, 60000);
  
  // 마지막 저장 시간 불러오기 (localStorage에서)
  loadLastSaveTime();
  
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
  // 현재 활성화된 시트의 tbody 찾기
  const activeSheet = document.querySelector('.sheet-content.active');
  const tbody = activeSheet ? activeSheet.querySelector('tbody') : document.getElementById('tableBody');
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
  
  // 리그등급 (C) - 드롭다운으로 A, B, C 선택
  const leagueGradeTd = document.createElement('td');
  const leagueGradeSelect = document.createElement('select');
  leagueGradeSelect.dataset.k = 'C';
  leagueGradeSelect.dataset.colIndex = 2; // C열은 2번 인덱스
  leagueGradeSelect.style.width = '100%';
  leagueGradeSelect.style.height = '100%';
  leagueGradeSelect.style.border = 'none';
  leagueGradeSelect.style.padding = '0 2px';
  leagueGradeSelect.style.fontSize = '16px';
  leagueGradeSelect.style.fontWeight = 'bold';
  leagueGradeSelect.style.textAlign = 'center';
  leagueGradeSelect.style.background = 'transparent';
  
  // 빈 옵션 추가
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '';
  leagueGradeSelect.appendChild(emptyOption);
  
  // A, B, C, S 옵션 추가 (리그 등급)
  ['A', 'B', 'C', 'S'].forEach(grade => {
    const option = document.createElement('option');
    option.value = grade;
    option.textContent = grade;
    leagueGradeSelect.appendChild(option);
  });
  
  leagueGradeSelect.addEventListener('change', function() {
    markUserTyping();
    
    // 현재 행의 4열(리그, D열) 값 가져오기
    const currentLeague = tr.refs.D && tr.refs.D.value ? tr.refs.D.value.trim() : '';
    const selectedGrade = this.value;
    
    // 같은 리그명을 가진 다른 행들의 리그등급도 동일하게 설정
    if (currentLeague && selectedGrade) {
      const tbody = document.getElementById('tableBody');
      const allRows = tbody.querySelectorAll('tr');
      
      allRows.forEach(row => {
        if (row === tr) return; // 현재 행은 제외
        
        const rowLeague = row.refs.D && row.refs.D.value ? row.refs.D.value.trim() : '';
        
        // 같은 리그명을 가진 행이면 리그등급도 동일하게 설정
        if (rowLeague === currentLeague && row.refs.C) {
          row.refs.C.value = selectedGrade;
          // 해당 행의 계산도 업데이트
          updateRow(row);
        }
      });
    }
    
    saveToLocalStorage();
  });
  leagueGradeSelect.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 2);
    // 드롭다운 열림 시 하단선 제거
    leagueGradeTd.classList.add('select-open');
  });
  leagueGradeSelect.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 2);
    // 드롭다운 열림 시 하단선 제거
    leagueGradeTd.classList.add('select-open');
  });
  leagueGradeSelect.addEventListener('blur', function() {
    // 드롭다운 닫힘 시 하단선 복원
    leagueGradeTd.classList.remove('select-open');
  });
  
  leagueGradeTd.appendChild(leagueGradeSelect);
  tr.appendChild(leagueGradeTd);
  tr.refs.C = leagueGradeSelect;
  
  // 리그 (D)
  const leagueTd = document.createElement('td');
  const leagueInput = document.createElement('input');
  leagueInput.type = 'text';
  leagueInput.dataset.k = 'D';
  leagueInput.dataset.colIndex = 3; // D열은 이제 3번 인덱스
  leagueInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 3);
  });
  leagueInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 3);
  });
  leagueInput.oninput = () => { 
    markUserTyping(); // 사용자 입력 추적
    saveToLocalStorage(); 
  };
  leagueTd.appendChild(leagueInput);
  tr.appendChild(leagueTd);
  tr.refs.D = leagueInput;
  
  // 홈팀 (E)
  const homeTd = document.createElement('td');
  const homeInput = document.createElement('input');
  homeInput.type = 'text';
  homeInput.dataset.k = 'E';
  homeInput.dataset.colIndex = 4; // E열은 이제 4번 인덱스
  // 5열을 4열(리그)과 동일한 스타일로 통일 - 인라인 스타일 제거하여 CSS 기본값 사용
  // 4열과 동일하게 기본 CSS 스타일 적용 (font-size: 16px, font-weight: bold)
  homeInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 4);
  });
  homeInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 4);
  });
  homeInput.oninput = () => { 
    markUserTyping(); // 사용자 입력 추적
    saveToLocalStorage(); 
  };
  homeTd.appendChild(homeInput);
  tr.appendChild(homeTd);
  tr.refs.E = homeInput;
  
  // 원정팀 (F)
  const awayTd = document.createElement('td');
  const awayInput = document.createElement('input');
  awayInput.type = 'text';
  awayInput.dataset.k = 'F';
  awayInput.dataset.colIndex = 5; // F열은 이제 5번 인덱스
  // 6열을 4열(리그)과 동일한 스타일로 통일 - 인라인 스타일 제거하여 CSS 기본값 사용
  // 4열과 동일하게 기본 CSS 스타일 적용 (font-size: 16px, font-weight: bold)
  awayInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 4);
  });
  awayInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 4);
  });
  awayInput.oninput = () => { 
    markUserTyping(); // 사용자 입력 추적
    saveToLocalStorage(); 
  };
  awayTd.appendChild(awayInput);
  tr.appendChild(awayTd);
  tr.refs.F = awayInput;
  
  // 홈/원정 기준배당 (G) - select
  const fTd = document.createElement('td');
  const fSelect = document.createElement('select');
  // 7열 글자는 굵게 설정
  fSelect.style.fontWeight = 'bold';
  ['', '홈', '원정'].forEach(v => {
    const option = document.createElement('option');
    option.textContent = v;
    option.value = v;
    fSelect.appendChild(option);
  });
  fSelect.dataset.k = 'G';
  fSelect.dataset.colIndex = 6; // G열은 이제 6번 인덱스 (홈/원정 기준배당)
  fSelect.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 6);
    // 드롭다운 열림 시 하단선 제거
    fTd.classList.add('select-open');
  });
  fSelect.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 6);
    // 드롭다운 열림 시 하단선 제거
    fTd.classList.add('select-open');
  });
  fSelect.addEventListener('blur', function() {
    // 드롭다운 닫힘 시 하단선 복원
    fTd.classList.remove('select-open');
  });
  fSelect.onchange = () => { updateRow(tr); saveToLocalStorage(); };
  fTd.appendChild(fSelect);
  tr.appendChild(fTd);
  tr.refs.G = fSelect;
  
  
  // 승 기준배당 (H) - type="text"로 변경하여 소수점 보존
  const gTd = document.createElement('td');
  gTd.className = 'orange-input-cell';
  const gInput = document.createElement('input');
  gInput.type = 'text';
  gInput.inputMode = 'decimal';
  gInput.pattern = '[0-9]*\\.?[0-9]*';
  gInput.dataset.k = 'H';
  gInput.dataset.colIndex = 7; // H열은 이제 7번 인덱스 (승 기준배당)
  gInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 7);
  });
  gInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 7);
  });
  gInput.addEventListener('input', (e) => {
    markUserTyping(); // 사용자 입력 추적
    // 숫자와 소수점만 허용
    let value = e.target.value;
    // 숫자, 소수점, 음수 부호만 허용
    value = value.replace(/[^0-9.-]/g, '');
    // 소수점이 여러 개면 하나만 허용
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    // 음수 부호가 여러 개면 하나만 허용 (처음에만)
    if (value.startsWith('-')) {
      value = '-' + value.slice(1).replace(/-/g, '');
    } else {
      value = value.replace(/-/g, '');
    }
    e.target.value = value;
    updateTime(gTd); // H열 시간 표시 추가
    updateRow(tr);
    saveToLocalStorage();
  });
  gTd.appendChild(gInput);
  tr.appendChild(gTd);
  tr.refs.H = gInput;
  
  // 오버기준 기준배당 (I)
  const hTd = document.createElement('td');
  const hInput = document.createElement('input');
  hInput.type = 'text';
  hInput.dataset.k = 'I';
  hInput.dataset.colIndex = 8; // I열은 이제 8번 인덱스 (오버기준 기준배당)
  hInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 8);
  });
  hInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 8);
  });
  hInput.addEventListener('input', (e) => {
    markUserTyping(); // 사용자 입력 추적
    // 숫자와 소수점만 허용
    let value = e.target.value;
    value = value.replace(/[^0-9.-]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    if (value.startsWith('-')) {
      value = '-' + value.slice(1).replace(/-/g, '');
    } else {
      value = value.replace(/-/g, '');
    }
    e.target.value = value;
    // I열 시간 표시 제거
    updateRow(tr);
    saveToLocalStorage();
  });
  hTd.appendChild(hInput);
  tr.appendChild(hTd);
  tr.refs.I = hInput;
  
  // 오버 기준배당 (J) - type="text"로 변경하여 소수점 보존
  const iTd = document.createElement('td');
  iTd.className = 'orange-input-cell';
  const iInput = document.createElement('input');
  iInput.type = 'text';
  iInput.inputMode = 'decimal';
  iInput.pattern = '[0-9]*\\.?[0-9]*';
  iInput.dataset.k = 'J';
  iInput.dataset.colIndex = 9; // J열은 이제 9번 인덱스 (오버 기준배당)
  iInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 9);
  });
  iInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 9);
  });
  iInput.addEventListener('input', (e) => {
    markUserTyping(); // 사용자 입력 추적
    // 숫자와 소수점만 허용
    let value = e.target.value;
    value = value.replace(/[^0-9.-]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    if (value.startsWith('-')) {
      value = '-' + value.slice(1).replace(/-/g, '');
    } else {
      value = value.replace(/-/g, '');
    }
    e.target.value = value;
    updateTime(iTd); // J열 시간 표시 추가
    updateRow(tr);
    saveToLocalStorage();
  });
  iTd.appendChild(iInput);
  tr.appendChild(iTd);
  tr.refs.J = iInput;
  
  // 승 75 (K) - type="text"로 변경하여 소수점 보존
  const jTd = document.createElement('td');
  jTd.className = 'orange-input-cell';
  const jInput = document.createElement('input');
  jInput.type = 'text';
  jInput.inputMode = 'decimal';
  jInput.pattern = '[0-9]*\\.?[0-9]*';
  jInput.dataset.k = 'K';
  jInput.dataset.colIndex = 10; // K열은 이제 10번 인덱스 (승 75)
  jInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 10);
  });
  jInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 10);
  });
  jInput.addEventListener('input', (e) => {
    markUserTyping(); // 사용자 입력 추적
    // 숫자와 소수점만 허용
    let value = e.target.value;
    value = value.replace(/[^0-9.-]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    if (value.startsWith('-')) {
      value = '-' + value.slice(1).replace(/-/g, '');
    } else {
      value = value.replace(/-/g, '');
    }
    e.target.value = value;
    updateTime(jTd);
    updateRow(tr);
    saveToLocalStorage();
  });
  jTd.appendChild(jInput);
  tr.appendChild(jTd);
  tr.refs.K = jInput;
  
  // 오버 75 (L) - type="text"로 변경하여 소수점 보존
  const kTd = document.createElement('td');
  kTd.className = 'orange-input-cell';
  const kInput = document.createElement('input');
  kInput.type = 'text';
  kInput.inputMode = 'decimal';
  kInput.pattern = '[0-9]*\\.?[0-9]*';
  kInput.dataset.k = 'L';
  kInput.dataset.colIndex = 11; // L열은 이제 11번 인덱스 (오버 75)
  kInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 11);
  });
  kInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 11);
  });
  kInput.addEventListener('input', (e) => {
    markUserTyping(); // 사용자 입력 추적
    // 숫자와 소수점만 허용
    let value = e.target.value;
    value = value.replace(/[^0-9.-]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    if (value.startsWith('-')) {
      value = '-' + value.slice(1).replace(/-/g, '');
    } else {
      value = value.replace(/-/g, '');
    }
    e.target.value = value;
    updateTime(kTd);
    updateRow(tr);
    saveToLocalStorage();
  });
  kTd.appendChild(kInput);
  tr.appendChild(kTd);
  tr.refs.L = kInput;
  
  // 승 현배당 (M) - type="text"로 변경하여 소수점 보존
  const lTd = document.createElement('td');
  lTd.className = 'orange-input-cell';
  const lInput = document.createElement('input');
  lInput.type = 'text';
  lInput.inputMode = 'decimal';
  lInput.pattern = '[0-9]*\\.?[0-9]*';
  lInput.dataset.k = 'M';
  lInput.dataset.colIndex = 12; // M열은 이제 12번 인덱스 (승 현배당)
  lInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 12);
  });
  lInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 12);
  });
  lInput.addEventListener('input', (e) => {
    markUserTyping(); // 사용자 입력 추적
    // 숫자와 소수점만 허용
    let value = e.target.value;
    value = value.replace(/[^0-9.-]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    if (value.startsWith('-')) {
      value = '-' + value.slice(1).replace(/-/g, '');
    } else {
      value = value.replace(/-/g, '');
    }
    e.target.value = value;
    updateTime(lTd);
    updateRow(tr);
    saveToLocalStorage();
  });
  lTd.appendChild(lInput);
  tr.appendChild(lTd);
  tr.refs.M = lInput;
  
  // 오버 현배당 (N) - type="text"로 변경하여 소수점 보존
  const mTd = document.createElement('td');
  mTd.className = 'orange-input-cell';
  const mInput = document.createElement('input');
  mInput.type = 'text';
  mInput.inputMode = 'decimal';
  mInput.pattern = '[0-9]*\\.?[0-9]*';
  mInput.dataset.k = 'N';
  mInput.dataset.colIndex = 13; // N열은 이제 13번 인덱스 (오버 현배당)
  mInput.addEventListener('click', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 13);
  });
  mInput.addEventListener('focus', function() {
    const rowIndex = Array.from(tbody.querySelectorAll('tr')).indexOf(tr);
    selectCell(this, rowIndex, 13);
  });
  mInput.addEventListener('input', (e) => {
    markUserTyping(); // 사용자 입력 추적
    // 숫자와 소수점만 허용
    let value = e.target.value;
    value = value.replace(/[^0-9.-]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    if (value.startsWith('-')) {
      value = '-' + value.slice(1).replace(/-/g, '');
    } else {
      value = value.replace(/-/g, '');
    }
    e.target.value = value;
    updateTime(mTd);
    updateRow(tr);
    saveToLocalStorage();
  });
  mTd.appendChild(mInput);
  tr.appendChild(mTd);
  tr.refs.N = mInput;
  
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
  
  const delBtn = document.createElement('button');
  delBtn.textContent = '삭제';
  delBtn.className = 'del-btn';
  delBtn.onclick = () => {
    // A열을 제외한 모든 열에 내용이 있는지 확인
    const hasContent = () => {
      // 입력 필드 확인 (B, C, D, E, F, G, H, I, J, K, L, M)
      const inputCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
      for (const col of inputCols) {
        if (tr.refs[col] && tr.refs[col].value && tr.refs[col].value.trim() !== '') {
          return true;
        }
      }
      
      // 계산된 값 확인 (N, O, P, Q)
      if (tr.nTd && tr.nTd.textContent && tr.nTd.textContent.trim() !== '') {
        return true;
      }
      if (tr.oTd && tr.oTd.textContent && tr.oTd.textContent.trim() !== '') {
        return true;
      }
      if (tr.pTd && tr.pTd.textContent && tr.pTd.textContent.trim() !== '') {
        return true;
      }
      if (tr.qTd && tr.qTd.textContent && tr.qTd.textContent.trim() !== '') {
        return true;
      }
      
      return false;
    };
    
    // 내용이 있으면 확인 메시지 표시
    if (hasContent()) {
      if (!confirm('삭제하겠습니까?')) {
        return; // No를 선택하면 삭제 취소
      }
    }
    
    // Yes를 선택하거나 내용이 없으면 삭제
    tr.remove();
    reindex();
    saveToLocalStorage(); // Firebase inputSheet에 삭제 반영 (Firebase data는 삭제하지 않음)
  };
  
  const hideBtn = document.createElement('button');
  hideBtn.textContent = '숨김';
  hideBtn.className = 'hide-btn';
  hideBtn.onclick = async () => {
    // 행의 고유 ID 생성 (B, C, D, E 값을 조합) - 정규화하여 일관성 유지
    const rowId = `${normalizeValueForRowId(tr.refs.B?.value)}_${normalizeValueForRowId(tr.refs.C?.value)}_${normalizeValueForRowId(tr.refs.D?.value)}_${normalizeValueForRowId(tr.refs.E?.value)}`;
    if (rowId !== '___') { // 빈 행이 아닌 경우만
      const hiddenIds = await getHiddenRowIds();
      const isHidden = hiddenIds.includes(rowId);
      
      if (isHidden) {
        // 숨김 해제
        await removeHiddenRowId(rowId);
        hideBtn.textContent = '숨김';
        hideBtn.style.opacity = '1';
        opTd.style.backgroundColor = ''; // R열 배경색 제거
      } else {
        // 숨김 처리
        await addHiddenRowId(rowId);
        hideBtn.textContent = '숨김됨';
        hideBtn.style.opacity = '0.5';
        opTd.style.backgroundColor = '#808080'; // R열 배경색 어둡게
      }
    }
  };
  tr.refs.hideBtn = hideBtn; // 숨김 버튼 참조 저장
  tr.refs.opTd = opTd; // R열 참조 저장
  
  btnBox.appendChild(insertBtn);
  btnBox.appendChild(delBtn);
  btnBox.appendChild(hideBtn);
  opTd.appendChild(btnBox);
  tr.appendChild(opTd);
  
  // 행의 값이 변경될 때 숨김 상태 확인
  const checkHideStatus = async () => {
    const rowId = `${normalizeValueForRowId(tr.refs.B?.value)}_${normalizeValueForRowId(tr.refs.C?.value)}_${normalizeValueForRowId(tr.refs.D?.value)}_${normalizeValueForRowId(tr.refs.E?.value)}`;
    const hiddenIds = await getHiddenRowIds();
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
  setTimeout(() => checkHideStatus(), 0);
  
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
  // H→I, G→H, J→K, L→M, I→J, K→L, M→N로 변경됨
  const H = tr.refs.H && tr.refs.H.value ? (tr.refs.H.value.trim() === '' ? NaN : parseFloat(tr.refs.H.value)) : NaN;
  const I = tr.refs.I && tr.refs.I.value ? (tr.refs.I.value.trim() === '' ? NaN : parseFloat(tr.refs.I.value)) : NaN;
  const J = tr.refs.J && tr.refs.J.value ? (tr.refs.J.value.trim() === '' ? NaN : parseFloat(tr.refs.J.value)) : NaN;
  const K = tr.refs.K && tr.refs.K.value ? (tr.refs.K.value.trim() === '' ? NaN : parseFloat(tr.refs.K.value)) : NaN;
  const L = tr.refs.L && tr.refs.L.value ? (tr.refs.L.value.trim() === '' ? NaN : parseFloat(tr.refs.L.value)) : NaN;
  const M = tr.refs.M && tr.refs.M.value ? (tr.refs.M.value.trim() === '' ? NaN : parseFloat(tr.refs.M.value)) : NaN;
  const N = tr.refs.N && tr.refs.N.value ? (tr.refs.N.value.trim() === '' ? NaN : parseFloat(tr.refs.N.value)) : NaN;
  
  // G값 (이전 H) 가져오기
  const G = H; // H→I로 변경되었으므로 H가 이전 G
  
  // O열: H-M 계산 (15열, 승 하락수치)
  if (tr.nTd) {
    tr.nTd.textContent = (!isNaN(H) && !isNaN(M)) ? (H - M).toFixed(2) : '';
  }
  
  // P열: J-N 계산 (16열, 오버 하락수치)
  if (tr.oTd) {
    tr.oTd.textContent = (!isNaN(J) && !isNaN(N)) ? (J - N).toFixed(2) : '';
  }
  
  // 17열(오버 등급) 계산 - 6가지 옵션 기반
  let finalPValue = '';
  
  // 행에 실제 데이터가 있는지 확인 (H, I, J, K, L, M, N 중 최소한 하나라도 값이 있어야 함)
  const hasData = !isNaN(H) || !isNaN(I) || !isNaN(J) || !isNaN(K) || !isNaN(L) || !isNaN(M) || !isNaN(N);
  
  if (currentOptions && currentOptions.column17 && currentOptions.column17.gradeMapping && hasData) {
    const rowData17 = {
      H: isNaN(H) ? '' : H.toString(),
      I: isNaN(I) ? '' : I.toString(),
      J: isNaN(J) ? '' : J.toString(),
      L: isNaN(L) ? '' : L.toString(),
      M: isNaN(M) ? '' : M.toString(),
      N: isNaN(N) ? '' : N.toString(), // N열(14열, 오버 현배당) - 사용자 입력값
      C: tr.refs.C ? (tr.refs.C.value || '') : '' // 리그등급 (3열, BC→C로 변경)
    };
    
    finalPValue = calculateColumn17(rowData17, currentOptions);
    
  } else {
    console.warn('옵션이 없거나 column17.gradeMapping이 없습니다:', {
      hasCurrentOptions: !!currentOptions,
      hasColumn17: !!(currentOptions && currentOptions.column17),
      hasGradeMapping: !!(currentOptions && currentOptions.column17 && currentOptions.column17.gradeMapping)
    });
  }
  
  // P열(17열, 오버 등급) 결과 표시
  if (tr.pTd) {
    const displayValue = finalPValue ? finalPValue.toUpperCase() : '';
    tr.pTd.textContent = displayValue;
    // P열 등급에 따른 색상 클래스 및 인라인 스타일 적용
    if (finalPValue) {
      const pGrade = finalPValue.toUpperCase();
      tr.pTd.className = 'grade-cell grade-P-' + pGrade;
      tr.pTd.style.color = '#000'; // 검은색 텍스트
      // 등급별 배경색 직접 적용
      if (pGrade === 'A' || pGrade === 'A+') {
        tr.pTd.style.backgroundColor = '#ff6b6b'; // 붉은색
      } else if (pGrade === 'B' || pGrade === 'B+') {
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
  }
  
  // 18열(승 등급) 계산 - 리그등급별 옵션 기반
  let finalQValue = '';
  
  // 행에 실제 데이터가 있는지 확인 (H, K, M 중 최소한 하나라도 값이 있어야 함)
  const hasDataForQ = !isNaN(H) || !isNaN(K) || !isNaN(M);
  
  // 디버깅: H, K, M 값 확인
  // 실제 DOM에서 직접 값을 읽어보기 (cells를 통해서)
  const cells = tr.cells || [];
  const hCellValue = cells[7] ? (cells[7].querySelector('input') ? cells[7].querySelector('input').value : cells[7].textContent) : 'cell 없음';
  const kCellValue = cells[10] ? (cells[10].querySelector('input') ? cells[10].querySelector('input').value : cells[10].textContent) : 'cell 없음';
  const mCellValue = cells[12] ? (cells[12].querySelector('input') ? cells[12].querySelector('input').value : cells[12].textContent) : 'cell 없음';
  
  if (currentOptions && currentOptions.column18 && currentOptions.column18.leagueGradeMapping && hasDataForQ) {
    const rowData18 = {
      H: isNaN(H) ? '' : H.toString(),
      K: isNaN(K) ? '' : K.toString(),
      M: isNaN(M) ? '' : M.toString(),
      C: tr.refs.C ? (tr.refs.C.value || '') : '' // 리그등급 (3열, BC→C로 변경)
    };
    
    finalQValue = calculateColumn18(rowData18, currentOptions);
  } else {
    console.warn('옵션이 없거나 column18.leagueGradeMapping이 없거나 데이터가 없습니다:', {
      hasCurrentOptions: !!currentOptions,
      hasColumn18: !!(currentOptions && currentOptions.column18),
      hasLeagueGradeMapping: !!(currentOptions && currentOptions.column18 && currentOptions.column18.leagueGradeMapping),
      hasDataForQ
    });
  }
  
  // Q열(18열, 승 등급) 결과 표시 - 체크 표시 (안전하게)
  if (tr.qTd) {
    tr.qTd.textContent = finalQValue === 'o' ? '✓' : '';
    tr.qTd.className = 'grade-cell' + (finalQValue === 'o' ? ' grade-Q' : '');
    // Q열은 배경색 없이 체크 표시만 (크고 굵게)
    if (finalQValue === 'o') {
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
  }
  
  // 데이터 업데이트
  if (tableData[tr.dataset.rowIndex]) {
    tableData[tr.dataset.rowIndex].Q = finalPValue; // Q는 오버 등급 (17열)
    tableData[tr.dataset.rowIndex].R = finalQValue; // R는 승 등급 (18열)
    tableData[tr.dataset.rowIndex].N = tr.refs.N ? (tr.refs.N.value || '') : ''; // N은 입력값 (tr.refs.N.value)
    tableData[tr.dataset.rowIndex].O = tr.nTd ? (tr.nTd.textContent || '') : ''; // O는 하락수치 승 계산값 (tr.nTd, 15열)
    tableData[tr.dataset.rowIndex].P = tr.oTd ? (tr.oTd.textContent || '') : ''; // P는 하락수치 오버 계산값 (tr.oTd, 16열)
  }
}

// 삽입
function insertAfter(tr) {
  // 실시간 리스너가 이 변경사항을 무시하도록 플래그 설정
  isUpdatingFromFirebase = true;
  
  const newRow = addRow(parseInt(tr.cells[0].textContent) + 1);
  tr.parentNode.insertBefore(newRow, tr.nextSibling);
  reindex();
  
  // 빈 행도 포함하여 저장 (새로 추가된 행이 사라지지 않도록)
  const tbody = document.getElementById('tableBody');
  const rows = tbody.querySelectorAll('tr');
  const tempData = [];
  
  rows.forEach((row) => {
    if (row.refs) {
      const getTimeFromCell = (ref) => {
        if (!ref) return '';
        const td = ref.parentElement;
        if (!td) return '';
        const small = td.querySelector('small');
        return small ? small.textContent : '';
      };
      
      const rowData = {
        A: row.noTd ? (row.noTd.textContent || '') : '',
        B: row.refs.B ? (row.refs.B.value || '') : '',
        C: row.refs.C ? (row.refs.C.value || '') : '', // 리그등급 (BC→C로 변경)
        D: row.refs.D ? (row.refs.D.value || '') : '', // 리그 (C→D로 변경)
        E: row.refs.E ? (row.refs.E.value || '') : '', // 홈팀 (D→E로 변경)
        F: row.refs.F ? (row.refs.F.value || '') : '', // 원정팀 (E→F로 변경)
        G: row.refs.G ? (row.refs.G.value || '') : '', // 홈/원정 (F→G로 변경)
        // G_time 제거 (G열 시간 표시 없음)
        H: row.refs.H ? (row.refs.H.value || '') : '', // 승 (G→H로 변경)
        H_time: row.refs.H ? getTimeFromCell(row.refs.H) : '',
        I: row.refs.I ? (row.refs.I.value || '') : '', // 오버기준 (H→I로 변경)
        // I_time 제거 (I열 시간 표시 없음)
        J: row.refs.J ? (row.refs.J.value || '') : '', // 오버 (I→J로 변경)
        J_time: row.refs.J ? getTimeFromCell(row.refs.J) : '', // J열 시간 표시 추가
        K: row.refs.K ? (row.refs.K.value || '') : '', // 승 75분 (J→K로 변경)
        K_time: row.refs.K ? getTimeFromCell(row.refs.K) : '',
        L: row.refs.L ? (row.refs.L.value || '') : '', // 오버 75분 (K→L로 변경)
        L_time: row.refs.L ? getTimeFromCell(row.refs.L) : '',
        M: row.refs.M ? (row.refs.M.value || '') : '', // 승 현배당 (L→M로 변경)
        M_time: row.refs.M ? getTimeFromCell(row.refs.M) : '',
        N: row.refs.N ? (row.refs.N.value || '') : '', // 오버 현배당 (M→N로 변경)
        N_time: row.refs.N ? getTimeFromCell(row.refs.N) : '',
        O: row.nTd ? (row.nTd.textContent || '') : '', // 승 하락수치 (N→O로 변경)
        P: row.oTd ? (row.oTd.textContent || '') : '', // 오버 하락수치 (O→P로 변경)
        Q: row.pTd ? (row.pTd.textContent || '') : '', // 오버 등급 (P→Q로 변경)
        R: row.qTd ? (row.qTd.textContent || '') : '' // 승 등급 (Q→R로 변경)
      };
      
      // 삽입 시에는 빈 행도 포함하여 저장
      tempData.push(rowData);
    }
  });
  
  // localStorage에 저장
  try {
    localStorage.setItem('inputSheetTemp', JSON.stringify(tempData));
  } catch (error) {
    console.warn('localStorage 저장 실패:', error);
  }
  
  // Firebase에 즉시 저장 (디바운싱 없이)
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  saveInputSheetData(tempData).then(() => {
    // 저장 완료 후 플래그 해제 (약간의 지연을 두어 실시간 리스너가 트리거되지 않도록)
    setTimeout(() => {
      isUpdatingFromFirebase = false;
    }, 1000);
  }).catch(err => {
    console.warn('Firebase 저장 실패:', err);
    // 실패해도 플래그 해제
    setTimeout(() => {
      isUpdatingFromFirebase = false;
    }, 1000);
  });
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
  
  // 입력된 시간까지 남은 시간이 75분 이내이고, 아직 지나지 않았으면 노란색 배경
  // 즉, 0 <= (입력된 시간 - 현재 시간) <= 75분 이면 노란색
  if (diffMinutes >= 0 && diffMinutes <= 75) {
    tr.noTd.style.setProperty('background-color', '#ffff00', 'important'); // 노란색
    tr.noTd.classList.add('time-warning');
  } else {
    tr.noTd.style.removeProperty('background-color');
    tr.noTd.classList.remove('time-warning');
  }
}

// 모든 행의 시간을 체크하고 배경색 업데이트
function checkAllRowsTime() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) {
    return;
  }
  
  const rows = tbody.querySelectorAll('tr');
  
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

// 모든 데이터 저장 (축구 탭과 축구(자동) 탭 모두 저장)
async function saveAll() {
  if (!currentOptions) {
    showAlert('옵션을 먼저 불러와주세요.', 'error');
    return;
  }
  
  const dataToSave = [];
  
  // 축구 탭 (tableBody) 데이터 수집
  const rows1 = document.querySelectorAll('#tableBody tr');
  rows1.forEach((row) => {
    updateRow(row); // 계산 후 저장
    
    const rowData = {
      A: row.noTd ? (row.noTd.textContent || '') : (row.cells[0] ? row.cells[0].textContent : ''),
      B: row.refs && row.refs.B ? (row.refs.B.value || '') : '',
      C: row.refs && row.refs.C ? (row.refs.C.value || '') : '', // 리그등급 (BC→C로 변경)
      D: row.refs && row.refs.D ? (row.refs.D.value || '') : '', // 리그
      E: row.refs && row.refs.E ? (row.refs.E.value || '') : '', // 홈팀
      F: row.refs && row.refs.F ? (row.refs.F.value || '') : '', // 원정팀
      G: row.refs && row.refs.G ? (row.refs.G.value || '') : '', // 홈/원정
      H: row.refs && row.refs.H ? (row.refs.H.value || '') : '', // 승
      I: row.refs && row.refs.I ? (row.refs.I.value || '') : '', // 오버기준
      J: row.refs && row.refs.J ? (row.refs.J.value || '') : '', // 오버
      K: row.refs && row.refs.K ? (row.refs.K.value || '') : '', // 승75분
      L: row.refs && row.refs.L ? (row.refs.L.value || '') : '', // 오버75분
      M: row.refs && row.refs.M ? (row.refs.M.value || '') : '', // 승현배당
      N: row.refs && row.refs.N ? (row.refs.N.value || '') : '', // 오버현배당
      O: row.nTd ? (row.nTd.textContent || '') : '', // 승하락수치
      P: row.oTd ? (row.oTd.textContent || '') : '', // 오버하락수치
      Q: row.pTd ? (row.pTd.textContent || '') : '', // 오버등급
      R: row.qTd ? (row.qTd.textContent || '') : '' // 승등급
    };
    
    // 빈 행이 아닌 경우만 저장
    const hasData = ['B', 'C', 'D', 'E', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].some(k => rowData[k]);
    if (hasData) {
      dataToSave.push(rowData);
    }
  });
  
  // 축구(자동) 탭 (tableBodyAuto) 데이터 수집
  const rows2 = document.querySelectorAll('#tableBodyAuto tr');
  rows2.forEach((row) => {
    updateRow(row); // 계산 후 저장
    
    const rowData = {
      A: row.noTd ? (row.noTd.textContent || '') : (row.cells[0] ? row.cells[0].textContent : ''),
      B: row.refs && row.refs.B ? (row.refs.B.value || '') : '',
      C: row.refs && row.refs.C ? (row.refs.C.value || '') : '', // 리그등급 (BC→C로 변경)
      D: row.refs && row.refs.D ? (row.refs.D.value || '') : '', // 리그
      E: row.refs && row.refs.E ? (row.refs.E.value || '') : '', // 홈팀
      F: row.refs && row.refs.F ? (row.refs.F.value || '') : '', // 원정팀
      G: row.refs && row.refs.G ? (row.refs.G.value || '') : '', // 홈/원정
      H: row.refs && row.refs.H ? (row.refs.H.value || '') : '', // 승
      I: row.refs && row.refs.I ? (row.refs.I.value || '') : '', // 오버기준
      J: row.refs && row.refs.J ? (row.refs.J.value || '') : '', // 오버
      K: row.refs && row.refs.K ? (row.refs.K.value || '') : '', // 승75분
      L: row.refs && row.refs.L ? (row.refs.L.value || '') : '', // 오버75분
      M: row.refs && row.refs.M ? (row.refs.M.value || '') : '', // 승현배당
      N: row.refs && row.refs.N ? (row.refs.N.value || '') : '', // 오버현배당
      O: row.nTd ? (row.nTd.textContent || '') : '', // 승하락수치
      P: row.oTd ? (row.oTd.textContent || '') : '', // 오버하락수치
      Q: row.pTd ? (row.pTd.textContent || '') : '', // 오버등급
      R: row.qTd ? (row.qTd.textContent || '') : '' // 승등급
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
    // 현재 저장할 행의 B, C, D, E 조합 목록 생성 (정규화하여 일관성 유지)
    const currentRowKeys = new Set();
    dataToSave.forEach(rowData => {
      const key = `${normalizeValueForRowId(rowData.B)}_${normalizeValueForRowId(rowData.C)}_${normalizeValueForRowId(rowData.D)}_${normalizeValueForRowId(rowData.E)}`;
      if (key !== '___') { // 빈 행이 아닌 경우만
        currentRowKeys.add(key);
      }
    });
    
    // Firebase에서 모든 저장된 데이터 불러오기 (한 번만)
    const allSavedData = await loadData();
    
    // 삭제할 항목 찾기
    const itemsToDelete = [];
    allSavedData.forEach(savedItem => {
      const savedKey = `${normalizeValueForRowId(savedItem.B)}_${normalizeValueForRowId(savedItem.C)}_${normalizeValueForRowId(savedItem.D)}_${normalizeValueForRowId(savedItem.E)}`;
      if (savedKey !== '___' && !currentRowKeys.has(savedKey) && savedItem.id) {
        itemsToDelete.push(savedItem.id);
      }
    });
    
    // 삭제와 저장을 하나의 배치로 처리 (더 빠름)
    // saveDataBatch에 기존 데이터를 전달하여 중복 로드 방지
    const saveResult = await saveDataBatch(dataToSave, allSavedData);
    
    // 삭제 작업도 배치로 처리
    if (itemsToDelete.length > 0) {
      const deleteBatch = writeBatch(db);
      itemsToDelete.forEach(id => {
        const docRef = doc(db, 'data', id);
        deleteBatch.delete(docRef);
      });
      await deleteBatch.commit();
      console.log(`${itemsToDelete.length}개의 삭제된 행이 Firebase에서 제거되었습니다.`);
    }
    
    console.log(`저장 완료: 총 ${saveResult.saved}개 (업데이트: ${saveResult.updated}, 생성: ${saveResult.created})`);
    
    // 입력 시트 데이터도 즉시 저장 (축구 탭과 축구(자동) 탭 모두 포함, 모든 행 포함, 빈 행도 포함)
    const tbody1 = document.getElementById('tableBody');
    const tbody2 = document.getElementById('tableBodyAuto');
    const inputSheetData = [];
    
    // 시간 정보 추출 함수
    const getTimeFromCell = (ref) => {
      if (!ref) return '';
      const td = ref.parentElement;
      if (!td) return '';
      const small = td.querySelector('small');
      return small ? small.textContent : '';
    };
    
    // 축구 탭 (tableBody) 모든 행 데이터 수집 (빈 행 포함)
    if (tbody1) {
      const allRows1 = tbody1.querySelectorAll('tr');
      allRows1.forEach((row) => {
        if (row.refs) {
          const rowData = {
            A: row.noTd ? (row.noTd.textContent || '') : '',
            B: row.refs.B ? (row.refs.B.value || '') : '',
            C: row.refs.C ? (row.refs.C.value || '') : '',
            D: row.refs.D ? (row.refs.D.value || '') : '',
            E: row.refs.E ? (row.refs.E.value || '') : '',
            F: row.refs.F ? (row.refs.F.value || '') : '',
            G: row.refs.G ? (row.refs.G.value || '') : '',
            H: row.refs.H ? (row.refs.H.value || '') : '',
            H_time: row.refs.H ? getTimeFromCell(row.refs.H) : '',
            I: row.refs.I ? (row.refs.I.value || '') : '',
            J: row.refs.J ? (row.refs.J.value || '') : '',
            J_time: row.refs.J ? getTimeFromCell(row.refs.J) : '',
            K: row.refs.K ? (row.refs.K.value || '') : '',
            K_time: row.refs.K ? getTimeFromCell(row.refs.K) : '',
            L: row.refs.L ? (row.refs.L.value || '') : '',
            L_time: row.refs.L ? getTimeFromCell(row.refs.L) : '',
            M: row.refs.M ? (row.refs.M.value || '') : '',
            M_time: row.refs.M ? getTimeFromCell(row.refs.M) : '',
            N: row.refs.N ? (row.refs.N.value || '') : '',
            N_time: row.refs.N ? getTimeFromCell(row.refs.N) : '',
            O: row.nTd ? (row.nTd.textContent || '') : '',
            P: row.oTd ? (row.oTd.textContent || '') : '',
            Q: row.pTd ? (row.pTd.textContent || '') : '',
            R: row.qTd ? (row.qTd.textContent || '') : ''
          };
          inputSheetData.push(rowData);
        }
      });
    }
    
    // 축구(자동) 탭 (tableBodyAuto) 모든 행 데이터 수집 (빈 행 포함)
    if (tbody2) {
      const allRows2 = tbody2.querySelectorAll('tr');
      allRows2.forEach((row) => {
        if (row.refs) {
          const rowData = {
            A: row.noTd ? (row.noTd.textContent || '') : '',
            B: row.refs.B ? (row.refs.B.value || '') : '',
            C: row.refs.C ? (row.refs.C.value || '') : '',
            D: row.refs.D ? (row.refs.D.value || '') : '',
            E: row.refs.E ? (row.refs.E.value || '') : '',
            F: row.refs.F ? (row.refs.F.value || '') : '',
            G: row.refs.G ? (row.refs.G.value || '') : '',
            H: row.refs.H ? (row.refs.H.value || '') : '',
            H_time: row.refs.H ? getTimeFromCell(row.refs.H) : '',
            I: row.refs.I ? (row.refs.I.value || '') : '',
            J: row.refs.J ? (row.refs.J.value || '') : '',
            J_time: row.refs.J ? getTimeFromCell(row.refs.J) : '',
            K: row.refs.K ? (row.refs.K.value || '') : '',
            K_time: row.refs.K ? getTimeFromCell(row.refs.K) : '',
            L: row.refs.L ? (row.refs.L.value || '') : '',
            L_time: row.refs.L ? getTimeFromCell(row.refs.L) : '',
            M: row.refs.M ? (row.refs.M.value || '') : '',
            M_time: row.refs.M ? getTimeFromCell(row.refs.M) : '',
            N: row.refs.N ? (row.refs.N.value || '') : '',
            N_time: row.refs.N ? getTimeFromCell(row.refs.N) : '',
            O: row.nTd ? (row.nTd.textContent || '') : '',
            P: row.oTd ? (row.oTd.textContent || '') : '',
            Q: row.pTd ? (row.pTd.textContent || '') : '',
            R: row.qTd ? (row.qTd.textContent || '') : ''
          };
          inputSheetData.push(rowData);
        }
      });
    }
    
    // 기존 디바운싱 타이머 취소 (즉시 저장을 위해)
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    
    // 입력 시트 데이터를 Firebase에 즉시 저장 (isUpdatingFromFirebase 플래그 무시)
    try {
      // localStorage에도 먼저 저장
      localStorage.setItem('inputSheetTemp', JSON.stringify(inputSheetData));
      
      // Firebase에 즉시 저장
      await saveInputSheetData(inputSheetData);
      console.log('✅ 입력 시트 데이터 저장 완료:', inputSheetData.length, '행');
    } catch (error) {
      console.error('❌ 입력 시트 데이터 저장 실패:', error);
      // 입력 시트 저장 실패해도 계속 진행 (data 컬렉션은 이미 저장됨)
      // localStorage는 이미 저장되었으므로 백업으로 사용 가능
    }
    
    // 팝업 메시지 표시
    alert('저장되었습니다.');
    showAlert('저장되었습니다.');
    
    // 마지막 저장 시간 업데이트
    updateLastSaveTime();
    
    // saveToLocalStorage()는 호출하지 않음 (이미 저장했으므로)
  } catch (error) {
    console.error('데이터 저장 실패:', error);
    alert('데이터 저장에 실패했습니다.');
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
        if (row.refs.C) row.refs.C.value = item.C || '';
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
        row.refs.N.value = item.N || '';
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
    
    // 클릭한 행이 이미 선택되어 있는지 확인
    const isAlreadySelected = tr.classList.contains('row-selected');
    
    // 모든 행에서 선택 클래스 제거
    const allRows = tbody.querySelectorAll('tr');
    allRows.forEach(row => {
      row.classList.remove('row-selected');
    });
    
    // 같은 행을 다시 클릭한 경우가 아니면 선택 클래스 추가 (토글 기능)
    if (!isAlreadySelected) {
      tr.classList.add('row-selected');
      console.log('행 선택됨 (A열 클릭):', tr.cells[0]?.textContent || '알 수 없음');
    } else {
      console.log('행 선택 해제됨 (A열 클릭):', tr.cells[0]?.textContent || '알 수 없음');
    }
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
          
          const colMap = { 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H', 8: 'I', 9: 'J', 10: 'K', 11: 'L', 12: 'M', 13: 'N' };
          const colKey = colMap[colIdx];
          // B부터 N까지 선택 가능
          if (colKey && colIdx <= 13 && row.refs[colKey]) {
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
    
    // Ctrl+S: 저장하기
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveAll();
      return;
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
  const maxCol = 13; // B부터 N까지 (1~13, 14열)
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
      const colMap = { 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H', 8: 'I', 9: 'J', 10: 'K', 11: 'L', 12: 'M', 13: 'N' };
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
    const colMap = { 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H', 8: 'I', 9: 'J', 10: 'K', 11: 'L', 12: 'M', 13: 'N' };
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
  
  // 열 매핑: B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11, M=12, N=13 (A열은 번호이므로 제외)
  const colMap = { 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H', 8: 'I', 9: 'J', 10: 'K', 11: 'L', 12: 'M', 13: 'N' };
  
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
      
      // B부터 N까지 처리 (1~13, 14열)
      if (targetColIndex >= 1 && targetColIndex <= 13) {
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
    // 마지막 열 계산 (B부터 N까지 중 하나)
    let lastColOffset = lastLineValues.length - 1;
    if (currentColIndex === 1 && /^\d+$/.test(lastLineValues[0]?.trim())) {
      lastColOffset--; // A열이 포함된 경우 보정
    }
    const finalColIndex = Math.min(currentColIndex + lastColOffset, 13);
    moveToCell(finalRowIndex, finalColIndex);
  }
  
  // 붙여넣기 후 localStorage에 저장
  saveToLocalStorage();
}

// 실시간 리스너 설정
function setupRealtimeListener() {
  realtimeUnsubscribe = setupInputSheetListener((data) => {
    // 자신이 저장한 변경사항은 무시 (무한 루프 방지)
    // 사용자가 입력 중이면 실시간 업데이트를 무시 (데이터 손실 방지) - 최우선 보호
    if (isUserTyping) {
      console.warn('🚫 사용자 입력 중: 실시간 업데이트 차단');
      return;
    }
    
    if (!isUpdatingFromFirebase) {
      // 현재 테이블의 행 수 확인
      const tbody = document.getElementById('tableBody');
      const currentRows = tbody.querySelectorAll('tr').length;
      
      // 빈 배열이거나 데이터가 없으면 무시 (데이터 손실 방지)
      if (!data || data.length === 0) {
        console.warn('⚠️ 실시간 업데이트 무시: 빈 배열 (데이터 손실 방지, 현재:', currentRows, '행)');
        return;
      }
      
      // 기존 데이터 추출 (데이터 보존을 위해)
      const existingData = extractCurrentTableData();
      
      // 기존 데이터가 있고 새 데이터가 기존보다 적으면 병합 (데이터 손실 방지)
      if (existingData.length > 0 && data.length < existingData.length) {
        console.warn('⚠️ 실시간 업데이트: 기존 데이터 보존 및 병합 (기존:', existingData.length, '행, 새:', data.length, '행)');
        // 기존 데이터와 새 데이터 병합 (기존 데이터 우선)
        const mergedData = mergeTableData(existingData, data);
        isUpdatingFromFirebase = true;
        loadDataFromArray(mergedData);
        setTimeout(() => {
          isUpdatingFromFirebase = false;
        }, 500);
        return;
      }
      
      // 실시간 업데이트가 현재 데이터보다 훨씬 적으면 무시 (데이터 손실 방지)
      // 단, 현재 행이 1개 이하이고 새 데이터가 더 많으면 업데이트
      if (currentRows > 1 && data.length < currentRows * 0.5) {
        console.warn('⚠️ 실시간 업데이트 무시: 데이터 손실 방지 (현재:', currentRows, '행, 업데이트:', data.length, '행)');
        return;
      }
      
      isUpdatingFromFirebase = true;
      loadDataFromArray(data);
      // 약간의 지연 후 플래그 해제
      setTimeout(() => {
        isUpdatingFromFirebase = false;
      }, 500);
    }
  });
}

// 입력 시작 추적 함수
function markUserTyping() {
  isUserTyping = true;
  // 기존 타임아웃 취소
  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }
  // 10초 후 입력 종료로 표시 (더 긴 보호 시간)
  typingTimeout = setTimeout(() => {
    isUserTyping = false;
  }, 10000); // 3초 → 10초로 증가
}

// 현재 테이블 데이터 추출 (데이터 보존을 위해)
function extractCurrentTableData() {
  const tbody = document.getElementById('tableBody');
  const rows = tbody.querySelectorAll('tr');
  const currentData = [];
  
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
        A: row.noTd ? (row.noTd.textContent || '') : '',
        B: row.refs.B ? (row.refs.B.value || '') : '',
        C: row.refs.C ? (row.refs.C.value || '') : '',
        D: row.refs.D ? (row.refs.D.value || '') : '',
        E: row.refs.E ? (row.refs.E.value || '') : '',
        F: row.refs.F ? (row.refs.F.value || '') : '',
        G: row.refs.G ? (row.refs.G.value || '') : '',
        H: row.refs.H ? (row.refs.H.value || '') : '',
        H_time: row.refs.H ? getTimeFromCell(row.refs.H) : '',
        I: row.refs.I ? (row.refs.I.value || '') : '',
        J: row.refs.J ? (row.refs.J.value || '') : '',
        J_time: row.refs.J ? getTimeFromCell(row.refs.J) : '',
        K: row.refs.K ? (row.refs.K.value || '') : '',
        K_time: row.refs.K ? getTimeFromCell(row.refs.K) : '',
        L: row.refs.L ? (row.refs.L.value || '') : '',
        L_time: row.refs.L ? getTimeFromCell(row.refs.L) : '',
        M: row.refs.M ? (row.refs.M.value || '') : '',
        M_time: row.refs.M ? getTimeFromCell(row.refs.M) : '',
        N: row.refs.N ? (row.refs.N.value || '') : '',
        N_time: row.refs.N ? getTimeFromCell(row.refs.N) : '',
        O: row.nTd ? (row.nTd.textContent || '') : '',
        P: row.oTd ? (row.oTd.textContent || '') : '',
        Q: row.pTd ? (row.pTd.textContent || '') : '',
        R: row.qTd ? (row.qTd.textContent || '') : ''
      };
      
      // 데이터가 있는 행만 추가 (빈 행 제외)
      const hasData = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].some(k => rowData[k] && rowData[k].trim() !== '');
      if (hasData) {
        currentData.push(rowData);
      }
    }
  });
  
  return currentData;
}

// 테이블 데이터 병합 (기존 데이터 우선)
function mergeTableData(existingData, newData) {
  // 기존 데이터를 맵으로 변환 (B, C, D, E를 키로 사용)
  const existingMap = new Map();
  existingData.forEach(item => {
    const key = `${item.B || ''}_${item.C || ''}_${item.D || ''}_${item.E || ''}`;
    if (key !== '___') { // 빈 행이 아닌 경우만
      existingMap.set(key, item);
    }
  });
  
  // 새 데이터를 맵에 추가 (기존 데이터가 없을 때만)
  newData.forEach(item => {
    const key = `${item.B || ''}_${item.C || ''}_${item.D || ''}_${item.E || ''}`;
    if (key !== '___' && !existingMap.has(key)) {
      existingMap.set(key, item);
    }
  });
  
  // 맵을 배열로 변환
  return Array.from(existingMap.values());
}

// 배열 데이터를 테이블에 로드
function loadDataFromArray(data) {
  // 사용자가 입력 중이면 절대 덮어쓰지 않음 (최우선 보호)
  if (isUserTyping) {
    console.warn('🚫 사용자 입력 중: 데이터 로드 차단 (데이터 보호)');
    return;
  }
  
  const tbody = document.getElementById('tableBody');
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    // 빈 배열이면 기존 데이터를 유지 (데이터 손실 방지)
    const currentRows = tbody.querySelectorAll('tr').length;
    if (currentRows > 0) {
      // 기존 데이터 추출 및 유지
      const existingData = extractCurrentTableData();
      if (existingData.length > 0) {
        console.warn('⚠️ 빈 데이터 무시: 기존 데이터 유지 (', existingData.length, '행)');
        return; // 기존 데이터 유지
      }
      // localStorage에서 복원 시도
      const localData = loadFromLocalStorage();
      if (localData) {
        return;
      }
      return;
    }
    // 초기 로드이고 데이터가 없으면 빈 행 생성
    return;
  }
  
  // 기존 데이터 추출 (항상 백업)
  const existingData = extractCurrentTableData();
  
  // 기존 데이터가 있고 새 데이터가 기존보다 적으면 병합 (데이터 손실 방지)
  if (existingData.length > 0 && data.length < existingData.length) {
    console.warn('⚠️ 데이터 보호: 기존 데이터 보존 및 병합 (기존:', existingData.length, '행, 새:', data.length, '행)');
    // 기존 데이터와 새 데이터 병합 (기존 데이터 우선)
    const mergedData = mergeTableData(existingData, data);
    // 병합된 데이터 사용
    data = mergedData;
  }
  
  // 현재 포커스된 셀 저장 (정렬 후에도 찾을 수 있도록 고유 식별자 사용)
  const activeElement = document.activeElement;
  const isFocusedInTable = activeElement && activeElement.closest('#tableBody');
  
  // 포커스된 셀의 고유 식별자와 현재 값 저장
  let focusedRowKey = null; // B, C, D, E 값 조합으로 행 식별
  let focusedColKey = null;
  let focusedValue = null;
  if (isFocusedInTable && activeElement.tagName === 'INPUT') {
    const focusedRow = activeElement.closest('tr');
    if (focusedRow && focusedRow.refs) {
      // 행의 고유 식별자 생성 (B, C, D, E 값 조합)
      const rowKey = `${focusedRow.refs.B?.value || ''}_${focusedRow.refs.C?.value || ''}_${focusedRow.refs.D?.value || ''}_${focusedRow.refs.E?.value || ''}`;
      if (rowKey !== '___') { // 빈 행이 아닌 경우만
        focusedRowKey = rowKey;
        focusedColKey = activeElement.dataset.k;
        focusedValue = activeElement.value; // 현재 입력 중인 값 저장
      }
    }
  }
  
  // 위에서 이미 병합했으므로 data를 그대로 사용
  const dataToLoad = data;
  
  // 기존 행 제거
  tbody.innerHTML = '';
  tableData = [];
  
  // 데이터를 시간 순서로 정렬 (12:00~24:00가 당일 먼저, 00:00~12:00가 다음날)
  const sortedData = [...dataToLoad].sort((a, b) => {
    const timeA = parseTimeForSort(a.B || '');
    const timeB = parseTimeForSort(b.B || '');
    
    if (!timeA && !timeB) return 0;
    if (!timeA) return 1; // 시간 없는 것은 뒤로
    if (!timeB) return -1;
    
    return timeA - timeB; // 시간 순서대로 정렬
  });
  
  // 데이터 로드 - 모든 값을 명시적으로 처리
  const getItemValue = (item, key, focusedColKey, focusedValue, isFocusedCell) => {
    // 포커스된 셀이면 저장된 값 사용, 아니면 로드된 값 사용
    if (isFocusedCell && focusedColKey === key) {
      return focusedValue !== null && focusedValue !== undefined ? focusedValue : '';
    }
    // 로드된 값이 있으면 사용 (숫자 0도 유효한 값)
    if (item[key] !== null && item[key] !== undefined && item[key] !== '') {
      return item[key];
    }
    return '';
  };
  
  sortedData.forEach((item, index) => {
    // 🔄 이전 버전 데이터 호환성 처리 (BC → C, F의 홈/원정 → G로 이동)
    const normalizedItem = { ...item };
    
    // BC가 있으면 C로 변환 (이전 버전 호환)
    if (normalizedItem.BC && !normalizedItem.C) {
      normalizedItem.C = normalizedItem.BC;
      delete normalizedItem.BC;
    }
    
    // F에 "홈" 또는 "원정"이 있으면 G로 이동 (이전 버전 호환)
    if (normalizedItem.F && (normalizedItem.F === '홈' || normalizedItem.F === '원정') && !normalizedItem.G) {
      normalizedItem.G = normalizedItem.F;
      normalizedItem.F = ''; // F는 원정팀이므로 비움
    }
    
    // G_time, I_time 제거 (사용하지 않음)
    delete normalizedItem.G_time;
    delete normalizedItem.I_time;
    
    const row = addRow(index + 1);
    if (row.refs) {
      // 포커스된 필드가 현재 행이고 해당 열이면 저장된 값을 사용, 아니면 로드된 값 사용
      // 정렬 후에도 찾을 수 있도록 행의 고유 식별자 사용
      const currentRowKey = `${normalizedItem.B || ''}_${normalizedItem.C || ''}_${normalizedItem.D || ''}_${normalizedItem.E || ''}`;
      const isFocusedCell = (focusedRowKey && currentRowKey === focusedRowKey && focusedColKey);
      
      // 모든 열을 명시적으로 로드 (정규화된 데이터 사용)
      if (row.refs.B) {
        const bValue = getItemValue(normalizedItem, 'B', focusedColKey, focusedValue, isFocusedCell);
        row.refs.B.value = bValue;
      }
      if (row.refs.C) {
        const cValue = getItemValue(normalizedItem, 'C', focusedColKey, focusedValue, isFocusedCell);
        row.refs.C.value = cValue;
      }
      if (row.refs.D) {
        const dValue = getItemValue(normalizedItem, 'D', focusedColKey, focusedValue, isFocusedCell);
        row.refs.D.value = dValue;
      }
      if (row.refs.E) {
        const eValue = getItemValue(normalizedItem, 'E', focusedColKey, focusedValue, isFocusedCell);
        row.refs.E.value = eValue;
      }
      if (row.refs.F) {
        const fValue = getItemValue(normalizedItem, 'F', focusedColKey, focusedValue, isFocusedCell);
        row.refs.F.value = fValue;
      }
      if (row.refs.G) {
        const gValue = getItemValue(normalizedItem, 'G', focusedColKey, focusedValue, isFocusedCell);
        const gCellIndex = Array.from(row.cells).indexOf(row.refs.G.parentElement);
        row.refs.G.value = gValue;
      }
      if (row.refs.H) {
        const hValue = getItemValue(normalizedItem, 'H', focusedColKey, focusedValue, isFocusedCell);
        row.refs.H.value = hValue;
      }
      if (row.refs.I) row.refs.I.value = getItemValue(normalizedItem, 'I', focusedColKey, focusedValue, isFocusedCell);
      if (row.refs.J) row.refs.J.value = getItemValue(normalizedItem, 'J', focusedColKey, focusedValue, isFocusedCell);
      if (row.refs.K) row.refs.K.value = getItemValue(normalizedItem, 'K', focusedColKey, focusedValue, isFocusedCell);
      if (row.refs.L) row.refs.L.value = getItemValue(normalizedItem, 'L', focusedColKey, focusedValue, isFocusedCell);
      if (row.refs.M) row.refs.M.value = getItemValue(normalizedItem, 'M', focusedColKey, focusedValue, isFocusedCell);
      if (row.refs.N) row.refs.N.value = getItemValue(normalizedItem, 'N', focusedColKey, focusedValue, isFocusedCell);
      
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
      
      // 시간 정보 복원 (정규화된 데이터 사용)
      if (row.refs.H && normalizedItem.H_time) restoreTime(row.refs.H, normalizedItem.H_time); // H열 시간 표시 추가
      if (row.refs.J && normalizedItem.J_time) restoreTime(row.refs.J, normalizedItem.J_time); // J열 시간 표시 추가
      if (row.refs.K && normalizedItem.K_time) restoreTime(row.refs.K, normalizedItem.K_time);
      if (row.refs.L && normalizedItem.L_time) restoreTime(row.refs.L, normalizedItem.L_time);
      if (row.refs.M && normalizedItem.M_time) restoreTime(row.refs.M, normalizedItem.M_time);
      if (row.refs.N && normalizedItem.N_time) restoreTime(row.refs.N, normalizedItem.N_time); // N열 시간 표시 추가
      
      // 계산된 값 복원 (O, P, Q, R) - 정규화된 데이터 사용
      if (row.nTd && normalizedItem.O) row.nTd.textContent = normalizedItem.O; // 승 하락수치
      if (row.oTd && normalizedItem.P) row.oTd.textContent = normalizedItem.P; // 오버 하락수치
      if (row.pTd && normalizedItem.Q) row.pTd.textContent = normalizedItem.Q; // 오버 등급
      if (row.qTd && normalizedItem.R) row.qTd.textContent = normalizedItem.R; // 승 등급
    }
    // 각 행 로드 후 계산 (계산된 값이 없으면 새로 계산)
    if (row && row.refs) {
      updateRow(row);
    }
  });
  
  // 최소 30개 행 유지
  const currentRowCount = tbody.querySelectorAll('tr').length;
  if (currentRowCount < 30) {
    for (let i = currentRowCount; i < 30; i++) {
      addRow(i + 1);
    }
  }
  
  // 로드 완료 후 localStorage에도 저장 (백업)
  setTimeout(() => {
    saveToLocalStorage();
  }, 100);
  
  // 포커스 복원 (사용자가 입력 중이었다면) - 고유 식별자로 행 찾기
  if (focusedRowKey && focusedColKey) {
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const targetRow = rows.find(row => {
      if (row.refs) {
        const rowKey = `${row.refs.B?.value || ''}_${row.refs.C?.value || ''}_${row.refs.D?.value || ''}_${row.refs.E?.value || ''}`;
        return rowKey === focusedRowKey;
      }
      return false;
    });
    
    if (targetRow && targetRow.refs && targetRow.refs[focusedColKey]) {
      const input = targetRow.refs[focusedColKey];
      // 저장된 값으로 복원 (소수점이 포함된 경우를 위해)
      if (focusedValue !== null) {
        input.value = focusedValue;
      }
      // 커서를 끝으로 이동
      input.focus();
      if (input.setSelectionRange && focusedValue !== null) {
        input.setSelectionRange(focusedValue.length, focusedValue.length);
      }
    }
  }
  
  // 로드 완료 후 localStorage에 저장하여 백업 유지
  setTimeout(() => {
    saveToLocalStorage();
  }, 200);
}

// localStorage에 임시 저장 및 Firebase에 실시간 저장 (축구 탭과 축구(자동) 탭 모두 저장)
function saveToLocalStorage() {
  const tbody1 = document.getElementById('tableBody');
  const tbody2 = document.getElementById('tableBodyAuto');
  const tempData = [];
  
  // 축구 탭 (tableBody) 모든 행 저장 (빈 행 포함)
  if (tbody1) {
    const rows1 = tbody1.querySelectorAll('tr');
    rows1.forEach((row) => {
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
          A: row.noTd ? (row.noTd.textContent || '') : '',
          B: row.refs.B ? (row.refs.B.value || '') : '',
          C: row.refs.C ? (row.refs.C.value || '') : '', // 리그등급 (BC→C로 변경)
          D: row.refs.D ? (row.refs.D.value || '') : '',
          E: row.refs.E ? (row.refs.E.value || '') : '',
          F: row.refs.F ? (row.refs.F.value || '') : '',
          G: row.refs.G ? (row.refs.G.value || '') : '',
          // G_time 제거 (G열 시간 표시 없음)
          H: row.refs.H ? (row.refs.H.value || '') : '',
          H_time: row.refs.H ? getTimeFromCell(row.refs.H) : '', // H열 시간 표시 추가
          I: row.refs.I ? (row.refs.I.value || '') : '',
          // I_time 제거 (I열 시간 표시 없음)
          J: row.refs.J ? (row.refs.J.value || '') : '',
          J_time: row.refs.J ? getTimeFromCell(row.refs.J) : '', // J열 시간 표시 추가
          K: row.refs.K ? (row.refs.K.value || '') : '',
          K_time: row.refs.K ? getTimeFromCell(row.refs.K) : '',
          L: row.refs.L ? (row.refs.L.value || '') : '',
          L_time: row.refs.L ? getTimeFromCell(row.refs.L) : '',
          M: row.refs.M ? (row.refs.M.value || '') : '',
          M_time: row.refs.M ? getTimeFromCell(row.refs.M) : '',
          N: row.refs.N ? (row.refs.N.value || '') : '', // 오버 현배당
          N_time: row.refs.N ? getTimeFromCell(row.refs.N) : '', // N열 시간 표시 추가
          O: row.nTd ? (row.nTd.textContent || '') : '', // 승 하락수치 (15열)
          P: row.oTd ? (row.oTd.textContent || '') : '', // 오버 하락수치 (16열)
          Q: row.pTd ? (row.pTd.textContent || '') : '', // 오버 등급 (17열)
          R: row.qTd ? (row.qTd.textContent || '') : '' // 승 등급 (18열)
        };
        
        // 배열에 데이터 추가 (빈 행도 포함)
        tempData.push(rowData);
      }
    });
  }
  
  // 축구(자동) 탭 (tableBodyAuto) 모든 행 저장 (빈 행 포함)
  if (tbody2) {
    const rows2 = tbody2.querySelectorAll('tr');
    rows2.forEach((row) => {
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
          A: row.noTd ? (row.noTd.textContent || '') : '',
          B: row.refs.B ? (row.refs.B.value || '') : '',
          C: row.refs.C ? (row.refs.C.value || '') : '', // 리그등급 (BC→C로 변경)
          D: row.refs.D ? (row.refs.D.value || '') : '',
          E: row.refs.E ? (row.refs.E.value || '') : '',
          F: row.refs.F ? (row.refs.F.value || '') : '',
          G: row.refs.G ? (row.refs.G.value || '') : '',
          // G_time 제거 (G열 시간 표시 없음)
          H: row.refs.H ? (row.refs.H.value || '') : '',
          H_time: row.refs.H ? getTimeFromCell(row.refs.H) : '', // H열 시간 표시 추가
          I: row.refs.I ? (row.refs.I.value || '') : '',
          // I_time 제거 (I열 시간 표시 없음)
          J: row.refs.J ? (row.refs.J.value || '') : '',
          J_time: row.refs.J ? getTimeFromCell(row.refs.J) : '', // J열 시간 표시 추가
          K: row.refs.K ? (row.refs.K.value || '') : '',
          K_time: row.refs.K ? getTimeFromCell(row.refs.K) : '',
          L: row.refs.L ? (row.refs.L.value || '') : '',
          L_time: row.refs.L ? getTimeFromCell(row.refs.L) : '',
          M: row.refs.M ? (row.refs.M.value || '') : '',
          M_time: row.refs.M ? getTimeFromCell(row.refs.M) : '',
          N: row.refs.N ? (row.refs.N.value || '') : '', // 오버 현배당
          N_time: row.refs.N ? getTimeFromCell(row.refs.N) : '', // N열 시간 표시 추가
          O: row.nTd ? (row.nTd.textContent || '') : '', // 승 하락수치 (15열)
          P: row.oTd ? (row.oTd.textContent || '') : '', // 오버 하락수치 (16열)
          Q: row.pTd ? (row.pTd.textContent || '') : '', // 오버 등급 (17열)
          R: row.qTd ? (row.qTd.textContent || '') : '' // 승 등급 (18열)
        };
        
        // 배열에 데이터 추가 (빈 행도 포함)
        tempData.push(rowData);
      }
    });
  }
  
  try {
    // localStorage에 저장 (항상 저장)
    localStorage.setItem('inputSheetTemp', JSON.stringify(tempData));
    
    // Firebase에 실시간 저장 (Firebase에서 업데이트 중이 아닐 때만)
    // 디바운싱: 500ms 내에 여러 번 호출되면 마지막 것만 저장
    if (!isUpdatingFromFirebase) {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      saveTimeout = setTimeout(() => {
        saveInputSheetData(tempData).catch(err => {
          console.warn('⚠️ Firebase 저장 실패 (localStorage는 저장됨):', err);
          // 내부 오류인 경우 재시도
          if (err.message && err.message.includes('INTERNAL ASSERTION')) {
            console.error('Firestore 내부 오류. 데이터를 다시 시도합니다...');
            setTimeout(() => {
              saveInputSheetData(tempData).catch(retryErr => {
                console.error('재시도도 실패:', retryErr);
              });
            }, 2000);
          }
        });
      }, 500);
    }
    // Firebase 업데이트 중일 때는 조용히 localStorage만 저장 (콘솔 메시지 제거)
  } catch (error) {
    console.error('❌ localStorage 저장 실패:', error);
  }
}

// localStorage에서 복원
function loadFromLocalStorage() {
  try {
      const tempDataStr = localStorage.getItem('inputSheetTemp');
      if (tempDataStr) {
        const tempData = JSON.parse(tempDataStr);
        if (tempData && Array.isArray(tempData) && tempData.length > 0) {
          // 기존 행 제거
          const tbody = document.getElementById('tableBody');
          tbody.innerHTML = '';
          tableData = [];
        
        // 데이터 복원 (모든 행 복원)
        tempData.forEach((item, index) => {
          // 🔄 이전 버전 데이터 호환성 처리 (BC → C, F의 홈/원정 → G로 이동)
          const normalizedItem = { ...item };
          
          // BC가 있으면 C로 변환 (이전 버전 호환)
          if (normalizedItem.BC && !normalizedItem.C) {
            normalizedItem.C = normalizedItem.BC;
            delete normalizedItem.BC;
          }
          
          // F에 "홈" 또는 "원정"이 있으면 G로 이동 (이전 버전 호환)
          if (normalizedItem.F && (normalizedItem.F === '홈' || normalizedItem.F === '원정') && !normalizedItem.G) {
            normalizedItem.G = normalizedItem.F;
            normalizedItem.F = ''; // F는 원정팀이므로 비움
          }
          
          // G_time, I_time 제거 (사용하지 않음)
          delete normalizedItem.G_time;
          delete normalizedItem.I_time;
          
          const row = addRow(index + 1);
          if (row.refs) {
            if (row.refs.B) row.refs.B.value = (normalizedItem.B !== undefined && normalizedItem.B !== null) ? String(normalizedItem.B) : '';
            if (row.refs.C) row.refs.C.value = (normalizedItem.C !== undefined && normalizedItem.C !== null) ? String(normalizedItem.C) : '';
            if (row.refs.D) row.refs.D.value = (normalizedItem.D !== undefined && normalizedItem.D !== null) ? String(normalizedItem.D) : '';
            if (row.refs.E) row.refs.E.value = (normalizedItem.E !== undefined && normalizedItem.E !== null) ? String(normalizedItem.E) : '';
            if (row.refs.F) row.refs.F.value = (normalizedItem.F !== undefined && normalizedItem.F !== null) ? String(normalizedItem.F) : '';
            if (row.refs.G) {
              const gValue = (normalizedItem.G !== undefined && normalizedItem.G !== null) ? String(normalizedItem.G) : '';
              row.refs.G.value = gValue;
            }
            if (row.refs.H) row.refs.H.value = (normalizedItem.H !== undefined && normalizedItem.H !== null) ? String(normalizedItem.H) : '';
            if (row.refs.I) row.refs.I.value = (normalizedItem.I !== undefined && normalizedItem.I !== null) ? String(normalizedItem.I) : '';
            if (row.refs.J) row.refs.J.value = (normalizedItem.J !== undefined && normalizedItem.J !== null) ? String(normalizedItem.J) : '';
            if (row.refs.K) row.refs.K.value = (normalizedItem.K !== undefined && normalizedItem.K !== null) ? String(normalizedItem.K) : '';
            if (row.refs.L) row.refs.L.value = (normalizedItem.L !== undefined && normalizedItem.L !== null) ? String(normalizedItem.L) : '';
            if (row.refs.M) row.refs.M.value = (normalizedItem.M !== undefined && normalizedItem.M !== null) ? String(normalizedItem.M) : '';
            if (row.refs.N) row.refs.N.value = (normalizedItem.N !== undefined && normalizedItem.N !== null) ? String(normalizedItem.N) : '';
            
            // 시간 체크는 주기적 체크(setInterval)에서만 수행
            // localStorage 로드 시에는 시간 체크하지 않음
            
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
            
            // H, J, K, L, M, N 열의 시간 정보 복원 (정규화된 데이터 사용)
            if (row.refs.H && normalizedItem.H_time) restoreTime(row.refs.H, normalizedItem.H_time); // H열 시간 표시 추가
            if (row.refs.J && normalizedItem.J_time) restoreTime(row.refs.J, normalizedItem.J_time); // J열 시간 표시 추가
            if (row.refs.K && normalizedItem.K_time) restoreTime(row.refs.K, normalizedItem.K_time);
            if (row.refs.L && normalizedItem.L_time) restoreTime(row.refs.L, normalizedItem.L_time);
            if (row.refs.M && normalizedItem.M_time) restoreTime(row.refs.M, normalizedItem.M_time);
            if (row.refs.N && normalizedItem.N_time) restoreTime(row.refs.N, normalizedItem.N_time); // N열 시간 표시 추가
            
            // 계산된 값 복원 (O, P, Q, R) - 정규화된 데이터 사용
            if (row.nTd && normalizedItem.O) row.nTd.textContent = normalizedItem.O; // 승 하락수치
            if (row.oTd && normalizedItem.P) row.oTd.textContent = normalizedItem.P; // 오버 하락수치
            if (row.pTd && normalizedItem.Q) row.pTd.textContent = normalizedItem.Q; // 오버 등급
            if (row.qTd && normalizedItem.R) row.qTd.textContent = normalizedItem.R; // 승 등급
            
            // 행의 값이 모두 로드된 후 숨김 상태 확인
            setTimeout(async () => {
              if (row.refs.hideBtn && row.refs.opTd) {
                const rowId = `${normalizeValueForRowId(row.refs.B?.value)}_${normalizeValueForRowId(row.refs.C?.value)}_${normalizeValueForRowId(row.refs.D?.value)}_${normalizeValueForRowId(row.refs.E?.value)}`;
                const hiddenIds = await getHiddenRowIds();
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
        
        // 시간 체크는 주기적 체크(setInterval)에서만 수행
        // localStorage 로드 시에는 시간 체크하지 않음
        
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

// window.loadAccounts가 로드될 때까지 기다리는 함수
async function waitForLoadAccounts(maxWaitTime = 5000) {
  const startTime = Date.now();
  
  while (typeof window.loadAccounts !== 'function') {
    const elapsed = Date.now() - startTime;
    if (elapsed > maxWaitTime) {
      console.warn('⚠️ window.loadAccounts 로드 시간 초과 (5초)');
      return false;
    }
    
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return true;
}

// window.deleteAccount가 로드될 때까지 기다리는 함수
async function waitForDeleteAccount(maxWaitTime = 5000) {
  const startTime = Date.now();
  
  while (typeof window.deleteAccount !== 'function') {
    const elapsed = Date.now() - startTime;
    if (elapsed > maxWaitTime) {
      console.warn('⚠️ window.deleteAccount 로드 시간 초과 (5초)');
      return false;
    }
    
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return true;
}

// 모든 계정 가져오기 (Firebase)
async function getAllAccounts() {
  try {
    // window.loadAccounts가 로드될 때까지 기다림
    const isLoaded = await waitForLoadAccounts();
    
    if (isLoaded && typeof window.loadAccounts === 'function') {
      // Firebase에서 계정 정보 불러오기 (우선순위 1)
      const accounts = await window.loadAccounts();
      return accounts;
    } else {
      // window.loadAccounts가 로드되지 않은 경우 localStorage에서 불러오기 (폴백)
      console.warn('⚠️ window.loadAccounts가 로드되지 않았습니다. localStorage에서 불러옵니다.');
      const localAccounts = localStorage.getItem('viewPageAccounts');
      if (localAccounts) {
        const accounts = JSON.parse(localAccounts);
        console.log('📦 localStorage에서 계정 정보 불러오기:', accounts.length, '개');
      return accounts;
      }
    }
  } catch (error) {
    console.error('❌ 계정 불러오기 실패:', error);
    // 에러 발생 시 localStorage 폴백
    try {
      const localAccounts = localStorage.getItem('viewPageAccounts');
      if (localAccounts) {
        const accounts = JSON.parse(localAccounts);
        console.log('📦 에러 발생, localStorage 폴백으로 불러오기:', accounts.length, '개');
        return accounts;
      }
    } catch (e) {
      console.error('❌ localStorage 폴백도 실패:', e);
    }
  }
  return [];
}

// 계정 목록 새로고침
async function refreshAccountList() {
  const accountList = document.getElementById('accountList');
  const accounts = await getAllAccounts();
  
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
          <button class="btn btn-danger btn-sm" onclick="deleteAccountConfirm('${account.userId}')">삭제</button>
        </div>
      </div>
    `;
  }).join('');
}

// 계정 삭제 확인 및 실행
async function deleteAccountConfirm(userId) {
  if (!confirm(`정말로 계정 "${userId}"를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
    return;
  }
  
  try {
    console.log('🗑️ 계정 삭제 시작:', userId);
    
    // window.deleteAccount가 로드될 때까지 기다림
    const isLoaded = await waitForDeleteAccount();
    
    if (isLoaded && typeof window.deleteAccount === 'function') {
      const result = await window.deleteAccount(userId);
      
      if (result && result.success) {
        alert('✅ ' + result.message);
        
        // 계정 목록 새로고침
        await refreshAccountList();
      } else {
        alert('❌ ' + (result?.message || '계정 삭제에 실패했습니다.'));
        console.error('❌ 계정 삭제 실패:', result);
      }
    } else {
      // window.deleteAccount가 로드되지 않은 경우 localStorage에서 직접 삭제
      console.warn('⚠️ window.deleteAccount가 로드되지 않았습니다. localStorage에서 직접 삭제합니다.');
      try {
        const localAccounts = localStorage.getItem('viewPageAccounts');
        if (localAccounts) {
          const accounts = JSON.parse(localAccounts);
          const filteredAccounts = accounts.filter(acc => acc.userId !== userId);
          localStorage.setItem('viewPageAccounts', JSON.stringify(filteredAccounts));
          alert('✅ 계정이 삭제되었습니다. (로컬 저장)');
          await refreshAccountList();
        } else {
          alert('❌ 삭제할 계정을 찾을 수 없습니다.');
        }
      } catch (e) {
        console.error('❌ localStorage 삭제 실패:', e);
        alert('❌ 계정 삭제에 실패했습니다.');
      }
    }
  } catch (error) {
    console.error('❌ 계정 삭제 중 에러 발생:', error);
    alert('❌ 계정 삭제 중 오류가 발생했습니다.');
  }
}

// 계정 삭제 기능 (더 이상 사용하지 않음 - deleteAccountConfirm 사용)
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
async function saveAccount(event) {
  event.preventDefault();
  alert('saveAccount 함수 호출됨!');
  console.log('🚀 saveAccount 함수 시작');
  console.log('Event:', event);
  console.log('Form:', document.getElementById('accountForm'));
  
  const userId = document.getElementById('accountId').value.trim();
  const password = document.getElementById('accountPassword').value;
  const passwordConfirm = document.getElementById('accountPasswordConfirm').value;
  
  console.log('📝 입력된 아이디:', userId);
  
  if (!userId) {
    console.warn('⚠️ 아이디가 비어있음');
    alert('아이디를 입력해주세요.');
    return;
  }
  
  if (!password) {
    console.warn('⚠️ 비밀번호가 비어있음');
    alert('비밀번호를 입력해주세요.');
    return;
  }
  
  if (password !== passwordConfirm) {
    console.warn('⚠️ 비밀번호가 일치하지 않음');
    alert('비밀번호가 일치하지 않습니다.');
    document.getElementById('accountPasswordConfirm').focus();
    return;
  }
  
  // 계정 목록 가져오기
  let accounts = await getAllAccounts();
  
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
  
  // Firebase에 저장
  try {
    // window.saveAccounts가 로드될 때까지 기다림
    const isLoaded = await waitForLoadAccounts();
    
    if (isLoaded && typeof window.saveAccounts === 'function') {
      const success = await window.saveAccounts(accounts);
      
      if (success) {
        alert('계정이 Firebase에 저장되었습니다!');
      } else {
        alert('계정이 로컬에 저장되었습니다. (Firebase 연결 실패)');
        console.warn('⚠️ Firebase 저장 실패, localStorage에만 저장됨');
      }
    } else {
      // window.saveAccounts가 로드되지 않은 경우 localStorage에 저장
      console.warn('⚠️ window.saveAccounts가 로드되지 않았습니다. localStorage에 저장합니다.');
  localStorage.setItem('viewPageAccounts', JSON.stringify(accounts));
      alert('계정이 생성되었습니다! (Firebase 연결 대기 중)');
    }
  } catch (error) {
    console.error('❌ 계정 저장 중 에러 발생:', error);
    // 에러 발생 시 localStorage에 저장
    try {
      localStorage.setItem('viewPageAccounts', JSON.stringify(accounts));
      alert('계정이 로컬에 저장되었습니다. (에러 발생)');
    } catch (e) {
      console.error('❌ localStorage 저장도 실패:', e);
      alert('계정 저장에 실패했습니다. 콘솔을 확인해주세요.');
    }
  }
  
  // 계정 목록 새로고침
  await refreshAccountList();
  
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
// Firebase 마이그레이션 실행 (BC, G_time, I_time 필드 제거)
async function runMigration() {
  if (!confirm('Firebase의 모든 문서에서 BC, G_time, I_time 필드를 제거합니다.\n계속하시겠습니까?')) {
    return;
  }
  
  try {
    const result = await migrateRemoveOldFields();
    
    if (result.success) {
      alert(`✅ 마이그레이션 완료!\n\n- data 컬렉션: ${result.dataUpdated}개 문서 업데이트\n- inputSheet: ${result.inputSheetUpdated}개 행 업데이트\n\n페이지를 새로고침합니다.`);
      window.location.reload();
    }
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    alert('마이그레이션에 실패했습니다.\n콘솔을 확인해주세요.');
  }
}

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

// 축구(자동) 탭용 행 추가 함수
function addMultipleRowsAuto() {
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
  const tbody = document.getElementById('tableBodyAuto');
  if (!tbody) {
    alert('축구(자동) 탭을 찾을 수 없습니다.');
    return;
  }
  const currentRowCount = tbody.querySelectorAll('tr').length;
  
  // 지정된 개수만큼 행 추가
  for (let i = 0; i < numRows; i++) {
    addRowAuto(currentRowCount + i + 1);
  }
  
  showAlert(`${numRows}개의 행이 추가되었습니다.`);
}

// 축구(자동) 탭용 행 추가 함수 - addRow를 재사용하되 tableBodyAuto에 직접 추가
function addRowAuto(rowNum) {
  // tableBodyAuto를 직접 사용하여 중복 방지
  const tbody = document.getElementById('tableBodyAuto');
  if (!tbody) {
    console.warn('tableBodyAuto를 찾을 수 없습니다.');
    return null;
  }
  
  // 이미 해당 번호의 행이 있는지 확인 (중복 방지)
  const existingRows = tbody.querySelectorAll('tr');
  const existingRowNums = Array.from(existingRows).map(row => {
    const noCell = row.querySelector('td:first-child');
    return noCell ? parseInt(noCell.textContent) : 0;
  });
  
  // 같은 번호의 행이 이미 있으면 추가하지 않음
  if (existingRowNums.includes(rowNum)) {
    console.log('⚠️ 행 번호', rowNum, '이(가) 이미 존재합니다. 건너뜁니다.');
    return null;
  }
  
  // addRow 함수를 호출하되, mainAutoSheet가 활성화되어 있는지 확인
  const activeSheet = document.querySelector('.sheet-content.active');
  const mainAutoSheet = document.getElementById('mainAutoSheet');
  
  if (activeSheet && activeSheet.id === 'mainAutoSheet') {
    // mainAutoSheet가 활성화된 상태이므로 addRow가 자동으로 tableBodyAuto를 사용함
    return addRow(rowNum);
  } else if (mainAutoSheet) {
    // mainAutoSheet가 활성화되지 않은 경우, 임시로 활성화
    const wasActive = mainAutoSheet.classList.contains('active');
    const wasDisplayed = mainAutoSheet.style.display !== 'none';
    
    if (!wasActive) {
      mainAutoSheet.classList.add('active');
      mainAutoSheet.style.display = 'block';
    }
    
    const tr = addRow(rowNum);
    
    // 원래 상태로 복원
    if (!wasActive) {
      mainAutoSheet.classList.remove('active');
    }
    if (!wasDisplayed) {
      mainAutoSheet.style.display = 'none';
    }
    
    return tr;
  }
  
  // fallback: addRow 호출 (활성 시트 확인)
  return addRow(rowNum);
}

// 축구(자동) 탭용 저장 함수
async function saveAllAuto() {
  if (!currentOptions) {
    showAlert('옵션을 먼저 불러와주세요.', 'error');
    return;
  }
  
  const rows = document.querySelectorAll('#tableBodyAuto tr');
  const dataToSave = [];
  
  rows.forEach((row) => {
    updateRow(row); // 계산 후 저장
    
    const rowData = {
      A: row.noTd ? (row.noTd.textContent || '') : (row.cells[0] ? row.cells[0].textContent : ''),
      B: row.refs && row.refs.B ? (row.refs.B.value || '') : '',
      C: row.refs && row.refs.C ? (row.refs.C.value || '') : '',
      D: row.refs && row.refs.D ? (row.refs.D.value || '') : '',
      E: row.refs && row.refs.E ? (row.refs.E.value || '') : '',
      F: row.refs && row.refs.F ? (row.refs.F.value || '') : '',
      G: row.refs && row.refs.G ? (row.refs.G.value || '') : '',
      H: row.refs && row.refs.H ? (row.refs.H.value || '') : '',
      I: row.refs && row.refs.I ? (row.refs.I.value || '') : '',
      J: row.refs && row.refs.J ? (row.refs.J.value || '') : '',
      K: row.refs && row.refs.K ? (row.refs.K.value || '') : '',
      L: row.refs && row.refs.L ? (row.refs.L.value || '') : '',
      M: row.refs && row.refs.M ? (row.refs.M.value || '') : '',
      N: row.refs && row.refs.N ? (row.refs.N.value || '') : '',
      O: row.nTd ? (row.nTd.textContent || '') : '',
      P: row.oTd ? (row.oTd.textContent || '') : '',
      Q: row.pTd ? (row.pTd.textContent || '') : '',
      R: row.qTd ? (row.qTd.textContent || '') : ''
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
    // 현재 저장할 행의 B, C, D, E 조합 목록 생성
    const currentRowKeys = new Set();
    dataToSave.forEach(rowData => {
      const key = `${normalizeValueForRowId(rowData.B)}_${normalizeValueForRowId(rowData.C)}_${normalizeValueForRowId(rowData.D)}_${normalizeValueForRowId(rowData.E)}`;
      if (key !== '___') {
        currentRowKeys.add(key);
      }
    });
    
    // Firebase에서 모든 저장된 데이터 불러오기
    const allSavedData = await loadData();
    
    // 삭제할 항목 찾기
    const itemsToDelete = [];
    allSavedData.forEach(savedItem => {
      const savedKey = `${normalizeValueForRowId(savedItem.B)}_${normalizeValueForRowId(savedItem.C)}_${normalizeValueForRowId(savedItem.D)}_${normalizeValueForRowId(savedItem.E)}`;
      if (savedKey !== '___' && !currentRowKeys.has(savedKey) && savedItem.id) {
        itemsToDelete.push(savedItem.id);
      }
    });
    
    // 삭제와 저장을 하나의 배치로 처리
    const saveResult = await saveDataBatch(dataToSave, allSavedData);
    
    // 삭제 작업도 배치로 처리
    if (itemsToDelete.length > 0) {
      const deleteBatch = writeBatch(db);
      itemsToDelete.forEach(id => {
        const docRef = doc(db, 'data', id);
        deleteBatch.delete(docRef);
      });
      await deleteBatch.commit();
      console.log(`${itemsToDelete.length}개의 삭제된 행이 Firebase에서 제거되었습니다.`);
    }
    
    console.log(`저장 완료: 총 ${saveResult.saved}개 (업데이트: ${saveResult.updated}, 생성: ${saveResult.created})`);
    
    // 팝업 메시지 표시
    alert('저장되었습니다.');
    showAlert('저장되었습니다.');
    
    // 마지막 저장 시간 업데이트
    const lastSaveTimeElement = document.getElementById('lastSaveTimeAuto');
    if (lastSaveTimeElement) {
      const now = new Date();
      lastSaveTimeElement.textContent = `마지막 저장: ${now.toLocaleTimeString('ko-KR')}`;
    }
    
    // 서버 저장 성공 시 localStorage도 업데이트
    saveToLocalStorage();
  } catch (error) {
    console.error('데이터 저장 실패:', error);
    alert('데이터 저장에 실패했습니다.');
    showAlert('데이터 저장에 실패했습니다.', 'error');
  }
}

// 전역으로 함수들을 export (HTML의 onclick 속성에서 사용하기 위해)
window.addRow = addRow;
// 조회 페이지로 이동 (로그인 우회)
function handleViewClick(event) {
  try {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // 입력 페이지에서 조회 페이지로 이동 시 로그인 상태 설정
    sessionStorage.setItem('isLoggedIn', 'true');
    
    // 현재 URL에서 프로토콜, 호스트, 포트 추출
    const urlObj = new URL(window.location.href);
    
    // 루트 경로의 view.html로 이동 (절대 경로)
    // bjb/ 폴더에서도 루트의 view.html로 이동
    const viewUrl = `${urlObj.origin}/view.html`;
    
    console.log('현재 URL:', window.location.href);
    console.log('Origin:', urlObj.origin);
    console.log('이동할 URL:', viewUrl);
    
    // 즉시 이동
    window.location.href = viewUrl;
    
    return false;
  } catch (error) {
    console.error('handleViewClick 오류:', error);
    // 오류 발생 시에도 절대 경로로 시도
    const origin = window.location.origin || window.location.protocol + '//' + window.location.host;
    window.location.href = origin + '/view.html';
    return false;
  }
}

// 전역으로 노출
window.handleViewClick = handleViewClick;

window.addMultipleRows = addMultipleRows;
window.addMultipleRowsAuto = addMultipleRowsAuto;
window.addRowAuto = addRowAuto;
window.openOptions = openOptions;
window.saveAll = saveAll;
window.saveAllAuto = saveAllAuto;
window.openAccountModal = openAccountModal;
window.openAccountManageModal = openAccountManageModal;
window.closeAccountModal = closeAccountModal;
window.closeAccountManageModal = closeAccountManageModal;
window.saveAccount = saveAccount;
window.deleteAccountConfirm = deleteAccountConfirm;
window.deleteAllRows = deleteAllRows;
window.handleViewClick = handleViewClick;

// 마지막 저장 시간 업데이트
function updateLastSaveTime() {
  const lastSaveTimeElement = document.getElementById('lastSaveTime');
  if (lastSaveTimeElement) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeString = `${hours}:${minutes}:${seconds}`;
    lastSaveTimeElement.textContent = `마지막 저장: ${timeString}`;
    
    // 요소가 보이도록 스타일 확인
    lastSaveTimeElement.style.display = 'inline-block';
    lastSaveTimeElement.style.visibility = 'visible';
    
    // localStorage에 저장 시간 저장
    localStorage.setItem('lastSaveTime', timeString);
  } else {
    console.warn('lastSaveTime 요소를 찾을 수 없습니다.');
  }
}

// 마지막 저장 시간 불러오기
function loadLastSaveTime() {
  const lastSaveTimeElement = document.getElementById('lastSaveTime');
  if (lastSaveTimeElement) {
    const savedTime = localStorage.getItem('lastSaveTime');
    if (savedTime) {
      lastSaveTimeElement.textContent = `마지막 저장: ${savedTime}`;
    } else {
      lastSaveTimeElement.textContent = '저장 이력 없음';
    }
    // 요소가 보이도록 스타일 확인
    lastSaveTimeElement.style.display = 'inline-block';
    lastSaveTimeElement.style.visibility = 'visible';
  } else {
    console.warn('lastSaveTime 요소를 찾을 수 없습니다.');
  }
}
