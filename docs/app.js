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
  onSnapshot,
  updateDoc
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
// B, C, D, E 값이 같은 문서가 있으면 업데이트, 없으면 새로 생성
async function saveData(data) {
  try {
    const dataRef = collection(db, 'data');
    
    // B, C, D, E 값으로 기존 문서 검색
    const matchQuery = query(
      dataRef,
      where('B', '==', data.B || ''),
      where('C', '==', data.C || ''),
      where('D', '==', data.D || ''),
      where('E', '==', data.E || '')
    );
    
    const querySnapshot = await getDocs(matchQuery);
    
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    if (!querySnapshot.empty) {
      // 기존 문서가 있으면 업데이트 (첫 번째 문서만 업데이트)
      const existingDoc = querySnapshot.docs[0];
      const existingData = existingDoc.data();
      
      // createdAt은 유지하고 updatedAt만 추가
      updateData.createdAt = existingData.createdAt || new Date().toISOString();
      
      await updateDoc(doc(db, 'data', existingDoc.id), updateData);
      console.log(`✅ 기존 문서 업데이트: ${existingDoc.id} (매치: ${data.B}, ${data.C}, ${data.D}, ${data.E})`);
      return { success: true, data: { id: existingDoc.id, ...updateData }, updated: true };
    } else {
      // 기존 문서가 없으면 새로 생성
      updateData.createdAt = new Date().toISOString();
      const docRef = await addDoc(dataRef, updateData);
      console.log(`✅ 새 문서 생성: ${docRef.id} (매치: ${data.B}, ${data.C}, ${data.D}, ${data.E})`);
      return { success: true, data: { id: docRef.id, ...updateData }, updated: false };
    }
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
    console.log(`💾 저장 시작: 총 ${data.length}행`);
    
    // L, M 열 데이터 확인
    const rowsWithL = data.filter(row => row.L !== undefined && row.L !== null && row.L !== '');
    const rowsWithM = data.filter(row => row.M !== undefined && row.M !== null && row.M !== '');
    console.log(`💾 저장 전 확인: L열 ${rowsWithL.length}행, M열 ${rowsWithM.length}행`);
    
    // 데이터 정리: undefined, null, 순환 참조 제거 (빈 문자열도 유지)
    const cleanedData = data.map((row, index) => {
      const cleanedRow = {};
      for (const key in row) {
        // undefined와 null만 제외 (빈 문자열은 유지)
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
        } else if (row[key] === '') {
          // 빈 문자열은 명시적으로 저장
          cleanedRow[key] = '';
        }
      }
      
      // 디버깅: 처음 3개 행의 모든 데이터 확인
      if (index < 3) {
        console.log(`🔥 Firebase 저장 행 ${index + 1}:`, cleanedRow);
      }
      
      return cleanedRow;
    });
    
    // 정리 후 L, M 열 데이터 확인
    const cleanedRowsWithL = cleanedData.filter(row => row.L !== undefined && row.L !== null && row.L !== '');
    const cleanedRowsWithM = cleanedData.filter(row => row.M !== undefined && row.M !== null && row.M !== '');
    console.log(`💾 정리 후 확인: L열 ${cleanedRowsWithL.length}행, M열 ${cleanedRowsWithM.length}행`);
    
    // 데이터 크기 계산 (JSON 문자열로 변환하여 크기 측정)
    const dataSize = JSON.stringify(cleanedData).length;
    const maxSize = 900000; // 900KB (1MB 제한에 여유를 두기 위해)
    console.log(`💾 데이터 크기: ${(dataSize / 1024).toFixed(2)}KB`);
    
    const inputSheetRef = doc(db, 'inputSheet', 'current');
    
    // 데이터 크기가 제한을 초과하면 경고하고 일부만 저장
    if (dataSize > maxSize) {
      // 크기를 줄이기 위해 행 수를 줄임
      const maxRows = Math.floor((maxSize / dataSize) * cleanedData.length * 0.9); // 90% 여유
      console.warn(`⚠️ 데이터가 너무 큽니다 (${(dataSize / 1024).toFixed(2)}KB). 처음 ${maxRows}행만 저장합니다.`);
      
      const truncatedData = cleanedData.slice(0, maxRows);
      const truncatedRowsWithL = truncatedData.filter(row => row.L !== undefined && row.L !== null && row.L !== '');
      const truncatedRowsWithM = truncatedData.filter(row => row.M !== undefined && row.M !== null && row.M !== '');
      console.warn(`⚠️ 잘린 데이터: L열 ${truncatedRowsWithL.length}행, M열 ${truncatedRowsWithM.length}행`);
      
      await setDoc(inputSheetRef, {
        data: truncatedData,
        updatedAt: new Date().toISOString(),
        rowCount: cleanedData.length,
        truncated: true,
        originalSize: dataSize
      });
      console.log('입력 시트 저장 성공 (일부만 저장):', truncatedData.length, '행 / 원본:', cleanedData.length, '행');
    } else {
      // 모든 데이터 저장
      await setDoc(inputSheetRef, {
        data: cleanedData,
        updatedAt: new Date().toISOString(),
        rowCount: cleanedData.length
      });
      console.log('✅ 입력 시트 저장 성공:', cleanedData.length, '행');
      console.log(`✅ 저장 완료: L열 ${cleanedRowsWithL.length}행, M열 ${cleanedRowsWithM.length}행`);
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
    } else if (error.message && error.message.includes('Payload size')) {
      console.error('⚠️ Firestore 페이로드 크기 초과!');
      console.error('데이터가 너무 큽니다. 행 수를 줄이거나 데이터를 분할해야 합니다.');
      showAlert('데이터가 너무 커서 저장할 수 없습니다. 일부 행을 삭제하고 다시 시도해주세요.', 'error');
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
    // db가 초기화되었는지 확인
    if (!db) {
      throw new Error('Firebase db가 초기화되지 않았습니다.');
    }
    
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
    
    console.log('🔄 Firebase에 금지 데이터 저장 시도 중...', cleanedData.length, '개 항목');
    
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
    // db가 초기화되었는지 확인
    if (!db) {
      console.warn('⚠️ Firebase db가 초기화되지 않았습니다. localStorage에서 불러옵니다.');
      // localStorage에서 폴백
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
    }
    
    console.log('🔄 Firebase에서 금지 데이터 불러오기 시도 중...');
    
    // Firebase에서 먼저 불러오기 (최신 데이터)
    const sheet1Ref = doc(db, 'sheet1', 'current');
    const sheet1Doc = await getDoc(sheet1Ref);
    
    if (sheet1Doc.exists()) {
      const data = sheet1Doc.data().data || [];
      // localStorage에도 저장
      localStorage.setItem('sheet1Data', JSON.stringify(data));
      console.log('✅ Firebase에서 금지 데이터 불러오기 성공:', data.length, '개 항목');
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

// Firebase에 계정 정보 저장
async function saveAccounts(accounts) {
  try {
    // db가 초기화되었는지 확인
    if (!db) {
      throw new Error('Firebase db가 초기화되지 않았습니다.');
    }
    
    console.log('🔄 Firebase에 계정 저장 시도 중...', accounts.length, '개 계정');
    console.log('📝 저장할 계정 데이터:', accounts);
    
    const accountsRef = doc(db, 'settings', 'accounts');
    await setDoc(accountsRef, { 
      accounts: accounts,
      lastUpdated: new Date().toISOString()
    });
    
    console.log('✅ 계정 정보가 Firebase에 저장되었습니다.');
    
    // Firebase 저장 성공 시에도 localStorage에 동기화 (오프라인 백업용)
    try {
      localStorage.setItem('viewPageAccounts', JSON.stringify(accounts));
      console.log('📦 localStorage에도 동기화 완료');
    } catch (e) {
      console.warn('⚠️ localStorage 동기화 실패:', e);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Firebase 계정 저장 실패:', error);
    console.error('❌ 에러 상세:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    // localStorage에 백업 저장
    try {
      localStorage.setItem('viewPageAccounts', JSON.stringify(accounts));
      console.log('📦 localStorage에 백업 저장 완료');
    } catch (e) {
      console.error('❌ localStorage 백업 저장도 실패:', e);
    }
    return false;
  }
}

// Firebase에서 계정 정보 불러오기
async function loadAccounts() {
  try {
    // db가 초기화되었는지 확인
    if (!db) {
      throw new Error('Firebase db가 초기화되지 않았습니다.');
    }
    
    const accountsRef = doc(db, 'settings', 'accounts');
    const accountsSnap = await getDoc(accountsRef);
    
    if (accountsSnap.exists()) {
      const data = accountsSnap.data();
      const accounts = data.accounts || [];
      console.log('✅ Firebase에서 계정 정보 불러오기 성공:', accounts.length, '개');
      
      // localStorage에도 동기화 (오프라인 백업용)
      try {
        localStorage.setItem('viewPageAccounts', JSON.stringify(accounts));
        console.log('📦 localStorage에도 동기화 완료');
      } catch (e) {
        console.warn('⚠️ localStorage 동기화 실패:', e);
      }
      
      return accounts;
    } else {
      // Firebase에 데이터가 없으면 localStorage에서 불러오기 (마이그레이션)
      console.log('⚠️ Firebase에 계정 정보가 없습니다. localStorage 확인 중...');
      try {
        const localAccounts = localStorage.getItem('viewPageAccounts');
        if (localAccounts) {
          const accounts = JSON.parse(localAccounts);
          if (accounts.length > 0) {
            console.log('📦 localStorage에서 계정 정보를 찾았습니다. Firebase로 마이그레이션 중...', accounts.length, '개');
            await saveAccounts(accounts);
            return accounts;
          }
        }
      } catch (e) {
        console.warn('⚠️ localStorage 불러오기 실패:', e);
      }
      
      console.log('⚠️ Firebase와 localStorage 모두에 계정 정보가 없습니다.');
      return [];
    }
  } catch (error) {
    console.error('❌ Firebase 계정 불러오기 실패:', error);
    console.error('❌ 에러 상세:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    // Firebase 실패 시 localStorage 폴백
    try {
      const localAccounts = localStorage.getItem('viewPageAccounts');
      if (localAccounts) {
        const accounts = JSON.parse(localAccounts);
        console.log('📦 localStorage에서 계정 정보 불러오기 (폴백):', accounts.length, '개');
        return accounts;
      }
    } catch (e) {
      console.error('❌ localStorage 폴백도 실패:', e);
    }
    console.log('⚠️ 모든 소스에서 계정 정보를 불러올 수 없습니다.');
    return [];
  }
}

// Firebase에서 계정 삭제
async function deleteAccount(userId) {
  try {
    // db가 초기화되었는지 확인
    if (!db) {
      throw new Error('Firebase db가 초기화되지 않았습니다.');
    }
    
    console.log('🗑️ Firebase에서 계정 삭제 시도 중...', userId);
    
    // 현재 계정 목록 불러오기
    const accounts = await loadAccounts();
    
    // 해당 userId를 가진 계정 찾아서 제거
    const filteredAccounts = accounts.filter(acc => acc.userId !== userId);
    
    if (filteredAccounts.length === accounts.length) {
      console.warn('⚠️ 삭제할 계정을 찾을 수 없습니다:', userId);
      return { success: false, message: '삭제할 계정을 찾을 수 없습니다.' };
    }
    
    // Firebase에 업데이트된 계정 목록 저장
    const accountsRef = doc(db, 'settings', 'accounts');
    await setDoc(accountsRef, { 
      accounts: filteredAccounts,
      lastUpdated: new Date().toISOString()
    });
    
    console.log('✅ 계정이 Firebase에서 삭제되었습니다.');
    
    // localStorage에도 동기화
    try {
      localStorage.setItem('viewPageAccounts', JSON.stringify(filteredAccounts));
      console.log('📦 localStorage에도 동기화 완료');
    } catch (e) {
      console.warn('⚠️ localStorage 동기화 실패:', e);
    }
    
    return { success: true, message: '계정이 삭제되었습니다.' };
  } catch (error) {
    console.error('❌ Firebase 계정 삭제 실패:', error);
    console.error('❌ 에러 상세:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    // Firebase 실패 시 localStorage에서 직접 삭제 시도
    try {
      const localAccounts = localStorage.getItem('viewPageAccounts');
      if (localAccounts) {
        const accounts = JSON.parse(localAccounts);
        const filteredAccounts = accounts.filter(acc => acc.userId !== userId);
        localStorage.setItem('viewPageAccounts', JSON.stringify(filteredAccounts));
        console.log('📦 localStorage에서 계정 삭제 완료 (폴백)');
        return { success: true, message: '계정이 삭제되었습니다. (로컬 저장)' };
      }
    } catch (e) {
      console.error('❌ localStorage 폴백도 실패:', e);
    }
    
    return { success: false, message: '계정 삭제에 실패했습니다.' };
  }
}

export { loadOptions, saveOptions, saveData, loadData, loadFilteredData, deleteData, deleteAllData, calculatePColumn, calculateQColumn, showAlert, saveInputSheetData, loadInputSheetData, setupInputSheetListener, saveSheet1Data, loadSheet1Data, saveAccounts, loadAccounts, deleteAccount };

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
window.saveAccounts = saveAccounts;
window.loadAccounts = loadAccounts;
window.deleteAccount = deleteAccount;
window.saveSheet1Data = saveSheet1Data;
window.loadSheet1Data = loadSheet1Data;




