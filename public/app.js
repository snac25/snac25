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
  orderBy,
  onSnapshot
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

// 모든 저장된 데이터 삭제하기 (Firebase)
async function deleteAllData() {
  try {
    const dataRef = collection(db, 'data');
    const querySnapshot = await getDocs(dataRef);
    
    // 모든 문서 삭제
    const deletePromises = [];
    querySnapshot.forEach((docSnapshot) => {
      deletePromises.push(deleteDoc(doc(db, 'data', docSnapshot.id)));
    });
    
    await Promise.all(deletePromises);
    return { success: true, count: querySnapshot.size };
  } catch (error) {
    console.error('모든 데이터 삭제 실패:', error);
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
// 실시간 입력 시트 데이터 저장
async function saveInputSheetData(data) {
  try {
    // 데이터 크기 제한 (Firestore 문서 최대 크기: 1MB)
    // 각 행이 약 1KB라고 가정하면 최대 1000행까지 가능
    if (data.length > 1000) {
      console.warn('데이터가 너무 큽니다. 처음 1000행만 저장합니다.');
      data = data.slice(0, 1000);
    }
    
    // 데이터 정리: undefined, null, 순환 참조 제거
    const cleanedData = data.map(row => {
      const cleanedRow = {};
      for (const key in row) {
        if (row[key] !== undefined && row[key] !== null) {
          // 문자열로 변환 가능한 값만 저장
          if (typeof row[key] === 'string' || typeof row[key] === 'number' || typeof row[key] === 'boolean') {
            cleanedRow[key] = row[key];
          } else if (typeof row[key] === 'object') {
            // 객체는 JSON 문자열로 변환
            try {
              cleanedRow[key] = JSON.stringify(row[key]);
            } catch (e) {
              // 변환 실패 시 건너뛰기
              console.warn('데이터 변환 실패:', key, row[key]);
            }
          }
        }
      }
      return cleanedRow;
    });
    
    const inputSheetRef = doc(db, 'inputSheet', 'current');
    
    // 배치 크기 제한 (한 번에 저장할 수 있는 데이터 크기 제한)
    const batchSize = 500;
    if (cleanedData.length <= batchSize) {
      await setDoc(inputSheetRef, {
        data: cleanedData,
        updatedAt: new Date().toISOString(),
        rowCount: cleanedData.length
      });
      console.log('입력 시트 저장 성공:', cleanedData.length, '행');
    } else {
      // 데이터가 너무 크면 분할 저장
      console.warn('데이터가 너무 큽니다. 처음', batchSize, '행만 저장합니다.');
      await setDoc(inputSheetRef, {
        data: cleanedData.slice(0, batchSize),
        updatedAt: new Date().toISOString(),
        rowCount: cleanedData.length,
        truncated: true
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('입력 시트 저장 실패:', error);
    if (error.code === 'permission-denied') {
      console.error('⚠️ Firestore 보안 규칙 오류!');
      showAlert('Firestore 보안 규칙이 설정되지 않았습니다. Firebase Console에서 규칙을 업데이트해주세요.', 'error');
    } else if (error.message && error.message.includes('INTERNAL ASSERTION')) {
      console.error('⚠️ Firestore 내부 오류 발생');
      console.error('데이터 구조를 확인하거나 Firebase SDK를 업데이트해주세요.');
      showAlert('데이터 저장 중 오류가 발생했습니다. 페이지를 새로고침하고 다시 시도해주세요.', 'error');
    }
    throw error;
  }
}

// 실시간 입력 시트 데이터 불러오기
async function loadInputSheetData() {
  try {
    const inputSheetRef = doc(db, 'inputSheet', 'current');
    const inputSheetSnap = await getDoc(inputSheetRef);
    
    if (inputSheetSnap.exists()) {
      return inputSheetSnap.data().data || [];
    }
    return [];
  } catch (error) {
    console.error('입력 시트 불러오기 실패:', error);
    if (error.code === 'permission-denied') {
      console.error('⚠️ Firestore 보안 규칙 오류!');
      console.error('Firebase Console에서 다음 규칙을 추가해주세요:');
      console.error(`
match /inputSheet/{document=**} {
  allow read, write: if true;
}
      `);
    }
    return [];
  }
}

// 실시간 입력 시트 리스너 설정
function setupInputSheetListener(callback) {
  try {
    const inputSheetRef = doc(db, 'inputSheet', 'current');
    const unsubscribe = onSnapshot(inputSheetRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data().data || [];
        console.log('실시간 업데이트 감지:', data.length, '행');
        callback(data);
      } else {
        console.log('입력 시트 문서가 없습니다.');
        callback([]);
      }
    }, (error) => {
      console.error('입력 시트 리스너 에러:', error);
      if (error.code === 'permission-denied') {
        console.error('⚠️ Firestore 보안 규칙 오류!');
        console.error('Firebase Console에서 다음 규칙을 추가해주세요:');
        console.error(`
match /inputSheet/{document=**} {
  allow read, write: if true;
}
        `);
        showAlert('Firestore 보안 규칙이 설정되지 않았습니다. Firebase Console에서 규칙을 업데이트해주세요.', 'error');
      }
    });
    
    console.log('실시간 리스너 설정 완료');
    return unsubscribe;
  } catch (error) {
    console.error('입력 시트 리스너 설정 실패:', error);
    if (error.code === 'permission-denied') {
      console.error('⚠️ Firestore 보안 규칙 오류!');
    }
    return null;
  }
}

// 시트1 데이터 저장
async function saveSheet1Data(data) {
  try {
    // 데이터 크기 제한
    if (data.length > 1000) {
      console.warn('데이터가 너무 큽니다. 처음 1000행만 저장합니다.');
      data = data.slice(0, 1000);
    }
    
    // 데이터 정리
    const cleanedData = data.map(row => {
      const cleanedRow = {};
      for (const key in row) {
        if (row[key] !== undefined && row[key] !== null) {
          if (typeof row[key] === 'string' || typeof row[key] === 'number' || typeof row[key] === 'boolean') {
            cleanedRow[key] = row[key];
          }
        }
      }
      return cleanedRow;
    });
    
    const sheet1Ref = doc(db, 'sheet1', 'current');
    const dataToSave = {
      data: cleanedData,
      updatedAt: new Date().toISOString(),
      rowCount: cleanedData.length
    };
    
    // 데이터 검증
    if (!dataToSave.data || !Array.isArray(dataToSave.data)) {
      throw new Error('유효하지 않은 데이터 형식입니다.');
    }
    
    await setDoc(sheet1Ref, dataToSave, { merge: false });
    
    // localStorage에도 저장
    localStorage.setItem('sheet1Data', JSON.stringify(cleanedData));
    
    console.log('시트1 저장 성공:', cleanedData.length, '행');
    return { success: true, count: cleanedData.length };
  } catch (error) {
    console.error('시트1 저장 실패:', error);
    throw error;
  }
}

// 시트1 데이터 불러오기
async function loadSheet1Data() {
  try {
    // Firebase에서 먼저 불러오기 (최신 데이터)
    const sheet1Ref = doc(db, 'sheet1', 'current');
    const sheet1Doc = await getDoc(sheet1Ref);
    
    if (sheet1Doc.exists()) {
      const data = sheet1Doc.data().data || [];
      // localStorage에도 저장
      localStorage.setItem('sheet1Data', JSON.stringify(data));
      return data;
    }
    
    // Firebase에 없으면 localStorage에서 확인
    const localDataStr = localStorage.getItem('sheet1Data');
    if (localDataStr) {
      try {
        return JSON.parse(localDataStr);
      } catch (e) {
        console.error('localStorage 파싱 오류:', e);
        return [];
      }
    }
    
    return [];
  } catch (error) {
    console.error('시트1 불러오기 실패:', error);
    // 오류 발생 시 localStorage에서 시도
    try {
      const localDataStr = localStorage.getItem('sheet1Data');
      if (localDataStr) {
        return JSON.parse(localDataStr);
      }
    } catch (e) {
      console.error('localStorage 폴백 실패:', e);
    }
    return [];
  }
}

export { loadOptions, saveOptions, saveData, loadData, loadFilteredData, deleteData, deleteAllData, calculatePColumn, calculateQColumn, showAlert, saveInputSheetData, loadInputSheetData, setupInputSheetListener, saveSheet1Data, loadSheet1Data };

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



