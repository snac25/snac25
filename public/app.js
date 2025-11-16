// 공통 유틸리티 함수들
import { db } from './firebase-config.js';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc,
  query,
  where,
  orderBy
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase Firestore를 사용한 옵션 불러오기
async function loadOptions() {
  try {
    const optionsRef = doc(db, 'settings', 'options');
    const optionsSnap = await getDoc(optionsRef);
    
    if (optionsSnap.exists()) {
      return optionsSnap.data();
    } else {
      // 기본 옵션 반환
      return {
        pColumn: {
          resultMapping: {
            'a': { 
              iMinusMRange: { min: 0, max: 25 }, 
              gMinusLRange: { min: 0, max: 25 },
              iGreaterThanKGreaterThanM: false
            },
            'b': { 
              iMinusMRange: { min: 26, max: 50 }, 
              gMinusLRange: { min: 26, max: 50 },
              iGreaterThanKGreaterThanM: false
            },
            'c': { 
              iMinusMRange: { min: 51, max: 75 }, 
              gMinusLRange: { min: 51, max: 75 },
              iGreaterThanKGreaterThanM: false
            },
            'd': { 
              iMinusMRange: { min: 76, max: 100 }, 
              gMinusLRange: { min: 76, max: 100 },
              iGreaterThanKGreaterThanM: false
            }
          }
        },
        qColumn: {
          gMinusLRange: { min: 0, max: 100 },
          gGreaterThanJGreaterThanL: false
        }
      };
    }
  } catch (error) {
    console.error('옵션 불러오기 실패:', error);
    return null;
  }
}

// Firebase Firestore를 사용한 옵션 저장하기
async function saveOptions(options) {
  try {
    const optionsRef = doc(db, 'settings', 'options');
    await setDoc(optionsRef, options);
    return { success: true, message: '옵션이 저장되었습니다.' };
  } catch (error) {
    console.error('옵션 저장 실패:', error);
    throw error;
  }
}

// Firebase Firestore를 사용한 데이터 저장하기
async function saveData(data) {
  try {
    const dataRef = collection(db, 'data');
    const docRef = await addDoc(dataRef, {
      ...data,
      createdAt: new Date().toISOString()
    });
    return { success: true, data: { id: docRef.id, ...data } };
  } catch (error) {
    console.error('데이터 저장 실패:', error);
    throw error;
  }
}

// Firebase Firestore를 사용한 데이터 불러오기
async function loadData() {
  try {
    const dataRef = collection(db, 'data');
    const querySnapshot = await getDocs(dataRef);
    
    const data = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // createdAt 기준으로 정렬 (없으면 최신순)
    data.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    
    return data;
  } catch (error) {
    console.error('데이터 불러오기 실패:', error);
    return [];
  }
}

// Firebase Firestore를 사용한 필터링된 데이터 불러오기
async function loadFilteredData() {
  try {
    const dataRef = collection(db, 'data');
    const querySnapshot = await getDocs(dataRef);
    
    const allData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 클라이언트 측에서 필터링
    const filtered = allData.filter(row => {
      const pMatch = row.P && ['a', 'b', 'c', 'd'].includes(row.P);
      const qMatch = row.Q === 'o';
      return pMatch || qMatch;
    });
    
    return filtered;
  } catch (error) {
    console.error('필터링된 데이터 불러오기 실패:', error);
    return [];
  }
}

// 데이터 삭제하기 (Firebase)
async function deleteData(id) {
  try {
    const dataRef = doc(db, 'data', id);
    await deleteDoc(dataRef);
    return { success: true };
  } catch (error) {
    console.error('데이터 삭제 실패:', error);
    throw error;
  }
}

// P열 계산 함수
function calculatePColumn(row, options) {
  const { pColumn } = options;
  // 빈 값은 NaN으로 처리 (0으로 변환하지 않음)
  const G = (row.G === '' || row.G === null || row.G === undefined) ? NaN : parseFloat(row.G);
  const I = (row.I === '' || row.I === null || row.I === undefined) ? NaN : parseFloat(row.I);
  const K = (row.K === '' || row.K === null || row.K === undefined) ? NaN : parseFloat(row.K);
  const L = (row.L === '' || row.L === null || row.L === undefined) ? NaN : parseFloat(row.L);
  const M = (row.M === '' || row.M === null || row.M === undefined) ? NaN : parseFloat(row.M);

  // 필요한 값이 모두 숫자인지 확인
  if (isNaN(G) || isNaN(I) || isNaN(K) || isNaN(L) || isNaN(M)) {
    return '';
  }

  const iMinusM = I - M;
  const gMinusL = G - L;
  const iGreaterThanKGreaterThanM = I > K && K > M;

  // 결과 매핑 확인
  for (const [result, mapping] of Object.entries(pColumn.resultMapping)) {
    const mappingIMinusM = iMinusM >= mapping.iMinusMRange.min && iMinusM <= mapping.iMinusMRange.max;
    const mappingGMinusL = gMinusL >= mapping.gMinusLRange.min && gMinusL <= mapping.gMinusLRange.max;
    const iKMCondition = mapping.iGreaterThanKGreaterThanM ? iGreaterThanKGreaterThanM : true;
    
    // 모든 조건 만족 확인
    if (mappingIMinusM && mappingGMinusL && iKMCondition) {
      return result;
    }
  }

  return '';
}

// Q열 계산 함수 - 옵션 설정의 모든 값이 맞아야 'o' 반환
function calculateQColumn(row, options) {
  const { qColumn } = options;
  // 빈 값은 NaN으로 처리 (0으로 변환하지 않음)
  const G = (row.G === '' || row.G === null || row.G === undefined) ? NaN : parseFloat(row.G);
  const J = (row.J === '' || row.J === null || row.J === undefined) ? NaN : parseFloat(row.J);
  const L = (row.L === '' || row.L === null || row.L === undefined) ? NaN : parseFloat(row.L);

  // 필요한 값이 모두 숫자인지 확인
  if (isNaN(G) || isNaN(J) || isNaN(L)) {
    return '';
  }

  const gMinusL = G - L;
  const gGreaterThanJGreaterThanL = G > J && J > L;

  // 옵션 설정의 모든 값이 맞아야 함
  const gMinusLInRange = gMinusL >= qColumn.gMinusLRange.min && gMinusL <= qColumn.gMinusLRange.max;
  const gJLCondition = qColumn.gGreaterThanJGreaterThanL ? gGreaterThanJGreaterThanL : true;

  // 모든 조건이 만족되어야 'o' 반환
  if (gMinusLInRange && gJLCondition) {
    return 'o';
  }

  return '';
}

// 알림 표시
function showAlert(message, type = 'success') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  
  const container = document.querySelector('.container');
  container.insertBefore(alertDiv, container.firstChild);
  
  setTimeout(() => {
    alertDiv.remove();
  }, 3000);
}

// 모듈 export
export { loadOptions, saveOptions, saveData, loadData, loadFilteredData, deleteData, calculatePColumn, calculateQColumn, showAlert };

// 전역으로 함수들을 export (기존 코드와의 호환성을 위해)
window.loadOptions = loadOptions;
window.saveOptions = saveOptions;
window.saveData = saveData;
window.loadData = loadData;
window.loadFilteredData = loadFilteredData;
window.deleteData = deleteData;
window.calculatePColumn = calculatePColumn;
window.calculateQColumn = calculateQColumn;
window.showAlert = showAlert;



