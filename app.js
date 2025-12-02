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
  updateDoc,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase Firestore를 사용한 옵션 불러오기
async function loadOptions() {
  try {
    const optionsRef = doc(db, 'settings', 'options');
    const optionsSnap = await getDoc(optionsRef);
    
    if (optionsSnap.exists()) {
      const data = optionsSnap.data();
      console.log('Firebase에서 불러온 옵션:', JSON.stringify(data, null, 2));
      return data;
    } else {
      // 기본 옵션 반환
      return {
        column17: {
          gradeMapping: {
            'a': {
              jMinusNRange: { min: 0, max: 100 },
              hMinusMRange: { min: 0, max: 100 },
              mValueRange: { min: 0, max: 100 },
              iValueRange: { min: 0, max: 100 },
              jGreaterThanLGreaterThanN: false,
              leagueGrades: ['A', 'B', 'C']
            },
            'b': {
              jMinusNRange: { min: 0, max: 100 },
              hMinusMRange: { min: 0, max: 100 },
              mValueRange: { min: 0, max: 100 },
              iValueRange: { min: 0, max: 100 },
              jGreaterThanLGreaterThanN: false,
              leagueGrades: ['A', 'B', 'C']
            },
            'c': {
              jMinusNRange: { min: 0, max: 100 },
              hMinusMRange: { min: 0, max: 100 },
              mValueRange: { min: 0, max: 100 },
              iValueRange: { min: 0, max: 100 },
              jGreaterThanLGreaterThanN: false,
              leagueGrades: ['A', 'B', 'C']
            },
            'd': {
              jMinusNRange: { min: 0, max: 100 },
              hMinusMRange: { min: 0, max: 100 },
              mValueRange: { min: 0, max: 100 },
              iValueRange: { min: 0, max: 100 },
              jGreaterThanLGreaterThanN: false,
              leagueGrades: ['A', 'B', 'C']
            }
          }
        },
        column18: {
          leagueGradeMapping: {
            'A': {
              hMinusMRange: { min: 0, max: 100 },
              mValueRange: { min: 0, max: 100 },
              hGreaterThanKGreaterThanM: false
            },
            'B': {
              hMinusMRange: { min: 0, max: 100 },
              mValueRange: { min: 0, max: 100 },
              hGreaterThanKGreaterThanM: false
            },
            'C': {
              hMinusMRange: { min: 0, max: 100 },
              mValueRange: { min: 0, max: 100 },
              hGreaterThanKGreaterThanM: false
            }
          }
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
    console.log('Firebase에 저장할 옵션:', JSON.stringify(options, null, 2));
    await setDoc(optionsRef, options);
    console.log('Firebase 저장 완료');
    return { success: true, message: '옵션이 저장되었습니다.' };
  } catch (error) {
    console.error('옵션 저장 실패:', error);
    throw error;
  }
}

// 데이터 정규화 및 필드 제거 헬퍼 함수
function normalizeAndCleanData(data) {
  const normalized = { ...data };
  
  // BC 필드가 있으면 C로 변환하고 BC 제거
  if (normalized.BC !== undefined) {
    if (!normalized.C) {
      normalized.C = normalized.BC;
    }
    delete normalized.BC;
  }
  
  // F에 "홈" 또는 "원정"이 있으면 G로 이동하고 F는 비우기
  if (normalized.F && (normalized.F === '홈' || normalized.F === '원정')) {
    if (!normalized.G) {
      normalized.G = normalized.F;
    }
    normalized.F = ''; // F는 원정팀이므로 비움
  }
  
  // 불필요한 필드 명시적으로 제거
  delete normalized.BC;
  delete normalized.G_time;
  delete normalized.I_time;
  
  // 최종 정리: BC, G_time, I_time 필드가 확실히 없는 객체 생성
  const cleaned = {};
  for (const key in normalized) {
    if (key !== 'BC' && key !== 'G_time' && key !== 'I_time') {
      cleaned[key] = normalized[key];
    }
  }
  
  return cleaned;
}

// Firebase Firestore를 사용한 데이터 저장하기
// B, C, D, E 값이 같은 문서가 있으면 업데이트, 없으면 새로 생성
async function saveData(data) {
  try {
    // 데이터 정규화 및 불필요한 필드 제거
    const cleanData = normalizeAndCleanData(data);
    
    const dataRef = collection(db, 'data');
    
    // B, C, D, E 값으로 기존 문서 검색
    const matchQuery = query(
      dataRef,
      where('B', '==', cleanData.B || ''),
      where('C', '==', cleanData.C || ''),
      where('D', '==', cleanData.D || ''),
      where('E', '==', cleanData.E || '')
    );
    
    const querySnapshot = await getDocs(matchQuery);
    
    if (!querySnapshot.empty) {
      // 기존 문서가 있으면 업데이트 (첫 번째 문서만 업데이트)
      const existingDoc = querySnapshot.docs[0];
      const existingData = existingDoc.data();
      
      // 명시적으로 필요한 필드만 포함하여 새 문서 생성 (BC, G_time, I_time 절대 제외)
      const finalData = {
        A: cleanData.A || '',
        B: cleanData.B || '',
        C: cleanData.C || '',
        D: cleanData.D || '',
        E: cleanData.E || '',
        F: cleanData.F || '',
        G: cleanData.G || '',
        H: cleanData.H || '',
        I: cleanData.I || '',
        J: cleanData.J || '',
        K: cleanData.K || '',
        L: cleanData.L || '',
        M: cleanData.M || '',
        N: cleanData.N || '',
        O: cleanData.O || '',
        P: cleanData.P || '',
        Q: cleanData.Q || '',
        R: cleanData.R || '',
        H_time: cleanData.H_time || '',
        J_time: cleanData.J_time || '',
        K_time: cleanData.K_time || '',
        L_time: cleanData.L_time || '',
        M_time: cleanData.M_time || '',
        N_time: cleanData.N_time || '',
        createdAt: existingData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // BC, G_time, I_time이 절대 포함되지 않았는지 최종 검증
      if (finalData.BC !== undefined || finalData.G_time !== undefined || finalData.I_time !== undefined) {
        console.error('❌ 치명적 오류: BC, G_time, I_time 필드가 finalData에 포함되었습니다!');
        delete finalData.BC;
        delete finalData.G_time;
        delete finalData.I_time;
      }
      
      // setDoc을 사용하여 문서를 완전히 다시 설정 (BC, G_time, I_time 필드 제거를 보장)
      await setDoc(doc(db, 'data', existingDoc.id), finalData);
      return { success: true, data: { id: existingDoc.id, ...finalData }, updated: true };
    } else {
      // 기존 문서가 없으면 새로 생성
      // 명시적으로 필요한 필드만 포함하여 새 문서 생성 (BC, G_time, I_time 절대 제외)
      const finalData = {
        A: cleanData.A || '',
        B: cleanData.B || '',
        C: cleanData.C || '',
        D: cleanData.D || '',
        E: cleanData.E || '',
        F: cleanData.F || '',
        G: cleanData.G || '',
        H: cleanData.H || '',
        I: cleanData.I || '',
        J: cleanData.J || '',
        K: cleanData.K || '',
        L: cleanData.L || '',
        M: cleanData.M || '',
        N: cleanData.N || '',
        O: cleanData.O || '',
        P: cleanData.P || '',
        Q: cleanData.Q || '',
        R: cleanData.R || '',
        H_time: cleanData.H_time || '',
        J_time: cleanData.J_time || '',
        K_time: cleanData.K_time || '',
        L_time: cleanData.L_time || '',
        M_time: cleanData.M_time || '',
        N_time: cleanData.N_time || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // BC, G_time, I_time이 절대 포함되지 않았는지 최종 검증
      if (finalData.BC !== undefined || finalData.G_time !== undefined || finalData.I_time !== undefined) {
        console.error('❌ 치명적 오류: BC, G_time, I_time 필드가 finalData에 포함되었습니다!');
        delete finalData.BC;
        delete finalData.G_time;
        delete finalData.I_time;
      }
      
      const docRef = await addDoc(dataRef, finalData);
      return { success: true, data: { id: docRef.id, ...finalData }, updated: false };
    }
  } catch (error) {
    console.error('데이터 저장 실패:', error);
    throw error;
  }
}

// 배치 작업으로 여러 데이터를 한 번에 저장 (속도 향상)
// existingData를 전달하면 loadData()를 다시 호출하지 않음 (성능 향상)
async function saveDataBatch(dataArray, existingData = null) {
  try {
    if (!dataArray || dataArray.length === 0) {
      return { success: true, saved: 0, updated: 0, created: 0 };
    }
    
    const dataRef = collection(db, 'data');
    
    // 기존 데이터가 전달되지 않았을 때만 불러오기
    const allExistingData = existingData || await loadData();
    
    // 기존 데이터를 키로 매핑 (B_C_D_E 형식)
    const existingDataMap = new Map();
    allExistingData.forEach(item => {
      const key = `${normalizeAndCleanData(item).B || ''}_${normalizeAndCleanData(item).C || ''}_${normalizeAndCleanData(item).D || ''}_${normalizeAndCleanData(item).E || ''}`;
      if (key !== '___') {
        existingDataMap.set(key, item);
      }
    });
    
    const MAX_BATCH_SIZE = 500;
    let saved = 0;
    let updated = 0;
    let created = 0;
    
    // 데이터 정규화 및 정리
    const normalizedDataArray = dataArray.map(data => normalizeAndCleanData(data));
    
    // 배치 작업을 청크로 나누어 처리
    for (let i = 0; i < normalizedDataArray.length; i += MAX_BATCH_SIZE) {
      const chunk = normalizedDataArray.slice(i, i + MAX_BATCH_SIZE);
      const batch = writeBatch(db);
      
      // 각 데이터에 대해 배치 작업 추가
      for (const cleanData of chunk) {
        const key = `${cleanData.B || ''}_${cleanData.C || ''}_${cleanData.D || ''}_${cleanData.E || ''}`;
        
        // 최종 데이터 생성
        const finalData = {
          A: cleanData.A || '',
          B: cleanData.B || '',
          C: cleanData.C || '',
          D: cleanData.D || '',
          E: cleanData.E || '',
          F: cleanData.F || '',
          G: cleanData.G || '',
          H: cleanData.H || '',
          I: cleanData.I || '',
          J: cleanData.J || '',
          K: cleanData.K || '',
          L: cleanData.L || '',
          M: cleanData.M || '',
          N: cleanData.N || '',
          O: cleanData.O || '',
          P: cleanData.P || '',
          Q: cleanData.Q || '',
          R: cleanData.R || '',
          H_time: cleanData.H_time || '',
          J_time: cleanData.J_time || '',
          K_time: cleanData.K_time || '',
          L_time: cleanData.L_time || '',
          M_time: cleanData.M_time || '',
          N_time: cleanData.N_time || '',
          updatedAt: new Date().toISOString()
        };
        
        // BC, G_time, I_time 제거 확인
        if (finalData.BC !== undefined || finalData.G_time !== undefined || finalData.I_time !== undefined) {
          delete finalData.BC;
          delete finalData.G_time;
          delete finalData.I_time;
        }
        
        const existingItem = existingDataMap.get(key);
        
        if (existingItem && existingItem.id) {
          // 기존 문서 업데이트
          finalData.createdAt = existingItem.createdAt || new Date().toISOString();
          const docRef = doc(db, 'data', existingItem.id);
          batch.set(docRef, finalData);
          updated++;
        } else {
          // 새 문서 생성
          finalData.createdAt = new Date().toISOString();
          const docRef = doc(dataRef);
          batch.set(docRef, finalData);
          created++;
        }
        
        saved++;
      }
      
      // 배치 커밋
      await batch.commit();
    }
    
    return { success: true, saved, updated, created };
  } catch (error) {
    console.error('배치 데이터 저장 실패:', error);
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

// ============================================
// 18열(Q, 승) 계산 - 모든 설정된 조건을 만족해야 함
// ============================================
function calculateColumn18(row, options) {
  const { column18 } = options;
  if (!column18 || !column18.leagueGradeMapping) {
    console.log('calculateColumn18 - 옵션 없음');
    return '';
  }

  const H = parseFloat(row.H);
  const K = parseFloat(row.K);
  const M = parseFloat(row.M);
  const leagueGrade = String(row.C ?? '').toUpperCase(); // 리그등급 (BC→C로 변경)

  const num = v => !isNaN(v);

  console.log('=== calculateColumn18 시작 ===', {
    row,
    parsedValues: { H, K, M },
    leagueGrade,
    gradeMappingKeys: Object.keys(column18.leagueGradeMapping || {})
  });

  // C(리그등급)가 A/B/C 아니면 승 표시 안 함
  if (!['A', 'B', 'C'].includes(leagueGrade)) {
    console.log('calculateColumn18 - 리그등급이 A/B/C가 아님:', leagueGrade);
    return '';
  }

  const cond = column18.leagueGradeMapping[leagueGrade];
  if (!cond) {
    console.log('calculateColumn18 - 해당 리그등급의 조건 없음:', leagueGrade);
    return '';
  }

  let used = 0;   // 실제 검사된 조건 수
  let ok = 0;     // 만족한 조건 수

  // ---------------------------
  // 1) H - M 범위 조건: 옵션에 설정되어 있으면 반드시 체크 (값이 없으면 불만족)
  // ---------------------------
  if (cond.hMinusMRange &&
      cond.hMinusMRange.min != null &&
      cond.hMinusMRange.max != null) {
    used++; // 조건이 설정되어 있으면 반드시 체크
    if (num(H) && num(M)) {
      const v = H - M;
      const min = Number(cond.hMinusMRange.min);
      const max = Number(cond.hMinusMRange.max);
      // 부동소수점 정밀도 문제 해결: 값을 반올림하여 비교 (소수점 10자리)
      const vRounded = Math.round(v * 1e10) / 1e10;
      const minRounded = Math.round(min * 1e10) / 1e10;
      const maxRounded = Math.round(max * 1e10) / 1e10;
      if ((vRounded >= minRounded) && (vRounded <= maxRounded)) ok++;
    }
    // 값이 없거나 범위를 벗어나면 ok는 증가하지 않음 (조건 불만족)
  }

  // ---------------------------
  // 2) M 값 범위 조건: 옵션에 설정되어 있으면 반드시 체크 (값이 없으면 불만족)
  // ---------------------------
  if (cond.mValueRange &&
      cond.mValueRange.min != null &&
      cond.mValueRange.max != null) {
    used++; // 조건이 설정되어 있으면 반드시 체크
    if (num(M)) {
      const min = Number(cond.mValueRange.min);
      const max = Number(cond.mValueRange.max);
      // 부동소수점 정밀도 문제 해결: 값을 반올림하여 비교 (소수점 10자리)
      const mRounded = Math.round(M * 1e10) / 1e10;
      const minRounded = Math.round(min * 1e10) / 1e10;
      const maxRounded = Math.round(max * 1e10) / 1e10;
      if ((mRounded >= minRounded) && (mRounded <= maxRounded)) ok++;
    }
    // 값이 없거나 범위를 벗어나면 ok는 증가하지 않음 (조건 불만족)
  }

  // ---------------------------
  // 3) H > K > M 조건: 옵션에 설정되어 있으면 반드시 체크 (값이 없으면 불만족)
  // ---------------------------
  if (cond.hGreaterThanKGreaterThanM === true) {
    used++; // 조건이 설정되어 있으면 반드시 체크
    if (num(H) && num(K) && num(M)) {
      if (H > K && K > M) ok++;
    }
    // 값이 없거나 조건을 만족하지 않으면 ok는 증가하지 않음 (조건 불만족)
  }

  // ---------------------------
  // 조건이 하나도 없으면 승 표시 안 함
  // ---------------------------
  if (used === 0) {
    console.log('calculateColumn18 - 검사된 조건 없음:', { used, ok });
    return '';
  }

  // ---------------------------
  // 검사된 조건 모두 만족한 경우만 승(o)
  // ---------------------------
  const result = (used === ok) ? 'o' : '';
  console.log('calculateColumn18 - 최종 결과:', {
    leagueGrade,
    used,
    ok,
    result,
    conditions: {
      hMinusMRange: cond.hMinusMRange,
      mValueRange: cond.mValueRange,
      hGreaterThanKGreaterThanM: cond.hGreaterThanKGreaterThanM
    }
  });
  return result;
}

// 17열(오버 등급) 계산 함수 - J > L > N 조건 포함 버전
function calculateColumn17(row, options) {
  const { column17 } = options;
  if (!column17 || !column17.gradeMapping) return '';

  const H = parseFloat(row.H);
  const I = parseFloat(row.I);
  const J = parseFloat(row.J);
  const L = parseFloat(row.L);
  const M = parseFloat(row.M);
  const N = parseFloat(row.N);
  const leagueGrade = (row.C || '').toUpperCase(); // 리그등급 (BC→C로 변경)

  const num = v => !isNaN(v);

  for (const [grade, cond] of Object.entries(column17.gradeMapping)) {
    let used = 0;
    let ok = 0;

    // J - N 범위 조건: 옵션에 설정되어 있으면 반드시 체크 (값이 없으면 불만족)
    if (cond.jMinusNRange && cond.jMinusNRange.min != null && cond.jMinusNRange.max != null) {
      used++; // 조건이 설정되어 있으면 반드시 체크
      if (num(J) && num(N)) {
        const v = J - N;
        // 부동소수점 비교를 위해 min, max를 숫자로 확실히 변환
        const min = Number(cond.jMinusNRange.min);
        const max = Number(cond.jMinusNRange.max);
        // 부동소수점 정밀도 문제 해결: 값을 반올림하여 비교 (소수점 10자리)
        const vRounded = Math.round(v * 1e10) / 1e10;
        const minRounded = Math.round(min * 1e10) / 1e10;
        const maxRounded = Math.round(max * 1e10) / 1e10;
        const inRange = (vRounded >= minRounded) && (vRounded <= maxRounded);
        console.log(`[등급 ${grade}] J-N 범위 체크:`, {
          J, N, v, vRounded,
          min, minRounded, max, maxRounded,
          inRange,
          comparison: `${vRounded} >= ${minRounded} && ${vRounded} <= ${maxRounded}`
        });
        if (inRange) ok++;
      }
      // 값이 없거나 범위를 벗어나면 ok는 증가하지 않음 (조건 불만족)
    }

    // H - M 범위 조건: 옵션에 설정되어 있으면 반드시 체크 (값이 없으면 불만족)
    if (cond.hMinusMRange && cond.hMinusMRange.min != null && cond.hMinusMRange.max != null) {
      used++; // 조건이 설정되어 있으면 반드시 체크
      if (num(H) && num(M)) {
        const v = H - M;
        // 부동소수점 비교를 위해 min, max를 숫자로 확실히 변환
        const min = Number(cond.hMinusMRange.min);
        const max = Number(cond.hMinusMRange.max);
        // 부동소수점 정밀도 문제 해결: 값을 반올림하여 비교 (소수점 10자리)
        const vRounded = Math.round(v * 1e10) / 1e10;
        const minRounded = Math.round(min * 1e10) / 1e10;
        const maxRounded = Math.round(max * 1e10) / 1e10;
        if ((vRounded >= minRounded) && (vRounded <= maxRounded)) ok++;
      }
      // 값이 없거나 범위를 벗어나면 ok는 증가하지 않음 (조건 불만족)
    }

    // M 값 범위 조건: 옵션에 설정되어 있으면 반드시 체크 (값이 없으면 불만족)
    if (cond.mValueRange && cond.mValueRange.min != null && cond.mValueRange.max != null) {
      used++; // 조건이 설정되어 있으면 반드시 체크
      if (num(M)) {
        // 부동소수점 비교를 위해 min, max를 숫자로 확실히 변환
        const min = Number(cond.mValueRange.min);
        const max = Number(cond.mValueRange.max);
        // 부동소수점 정밀도 문제 해결: 값을 반올림하여 비교 (소수점 10자리)
        const mRounded = Math.round(M * 1e10) / 1e10;
        const minRounded = Math.round(min * 1e10) / 1e10;
        const maxRounded = Math.round(max * 1e10) / 1e10;
        if ((mRounded >= minRounded) && (mRounded <= maxRounded)) ok++;
      }
      // 값이 없거나 범위를 벗어나면 ok는 증가하지 않음 (조건 불만족)
    }

    // I열 값 범위 조건: 옵션에 설정되어 있으면 반드시 체크 (값이 없으면 불만족)
    if (cond.iValueRange && 
        cond.iValueRange.min !== undefined && 
        cond.iValueRange.max !== undefined) {
      used++; // 조건이 설정되어 있으면 반드시 체크
      
      // 입력창에 값이 실제로 존재하는가?
      const hasIInput = row.I !== '' && row.I !== null && row.I !== undefined;

      if (hasIInput && !isNaN(I)) {
        // 부동소수점 비교를 위해 min, max를 숫자로 확실히 변환
        const min = Number(cond.iValueRange.min);
        const max = Number(cond.iValueRange.max);
        // 부동소수점 정밀도 문제 해결: 값을 반올림하여 비교 (소수점 10자리)
        const iRounded = Math.round(I * 1e10) / 1e10;
        const minRounded = Math.round(min * 1e10) / 1e10;
        const maxRounded = Math.round(max * 1e10) / 1e10;
        const inRange = (iRounded >= minRounded) && (iRounded <= maxRounded);
        if (inRange) ok++;
        // 범위 밖이면 ok는 증가하지 않음 (조건 불만족)
      }
      // 값이 없으면 ok는 증가하지 않음 (조건 불만족)
    }

    // J > L > N 조건: 옵션에 설정되어 있으면 반드시 체크 (값이 없으면 불만족)
    if (cond.jGreaterThanLGreaterThanN === true) {
      used++; // 조건이 설정되어 있으면 반드시 체크
      if (num(J) && num(L) && num(N)) {
        let jGreaterThanLGreaterThanNOK = true;
        
        // 허용값 적용: L과 N에서 허용값을 뺀 값을 사용
        let adjustedL = L;
        let adjustedN = N;
        
        // 12열(L열) 허용값 적용: L - lAllowValue
        if (cond.lAllowValue !== undefined && cond.lAllowValue !== null && !isNaN(cond.lAllowValue)) {
          adjustedL = L - cond.lAllowValue;
        }
        
        // 14열(N열) 허용값 적용: N - nAllowValue
        if (cond.nAllowValue !== undefined && cond.nAllowValue !== null && !isNaN(cond.nAllowValue)) {
          adjustedN = N - cond.nAllowValue;
        }
        
        // 기본 J > adjustedL > adjustedN 조건 체크
        if (!(J > adjustedL && adjustedL > adjustedN)) {
          jGreaterThanLGreaterThanNOK = false;
        }
        
        // 기존 lRange/nRange 호환성 (이전 데이터 마이그레이션용)
        if (cond.lRange && (cond.lRange.min !== 0 || cond.lRange.max !== 0)) {
          const lMin = cond.lRange.min;
          const lMax = cond.lRange.max;
          
          // min이 0이 아니면 L > min 체크
          if (lMin !== 0 && !(L > lMin)) {
            jGreaterThanLGreaterThanNOK = false;
          }
          
          // max가 0이 아니면 L < max 체크
          if (lMax !== 0 && !(L < lMax)) {
            jGreaterThanLGreaterThanNOK = false;
          }
        }
        
        // 기존 nRange 호환성 (이전 데이터 마이그레이션용)
        if (cond.nRange && (cond.nRange.min !== 0 || cond.nRange.max !== 0)) {
          const nMin = cond.nRange.min;
          const nMax = cond.nRange.max;
          
          // min이 0이 아니면 N > min 체크
          if (nMin !== 0 && !(N > nMin)) {
            jGreaterThanLGreaterThanNOK = false;
          }
          
          // max가 0이 아니면 N < max 체크
          if (nMax !== 0 && !(N < nMax)) {
            jGreaterThanLGreaterThanNOK = false;
          }
        }
        
        if (jGreaterThanLGreaterThanNOK) ok++;
      }
      // 값이 없거나 조건을 만족하지 않으면 ok는 증가하지 않음 (조건 불만족)
    }

    // 리그 등급 체크: 옵션에 설정되어 있으면 반드시 체크
    if (Array.isArray(cond.leagueGrades) && cond.leagueGrades.length > 0) {
      used++; // 조건이 설정되어 있으면 반드시 체크
      if (cond.leagueGrades.includes(leagueGrade)) ok++;
      // 리그 등급이 조건에 없으면 ok는 증가하지 않음 (조건 불만족)
    }

    if (used > 0 && used === ok) {
      return grade.toUpperCase();
    }
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
    // 데이터 정리: undefined, null, 순환 참조 제거 (빈 문자열도 유지)
    // BC → C 변환, F의 홈/원정 → G 이동, 불필요한 필드 제거
    const cleanedData = data.map((row, index) => {
      // 데이터 정규화 및 불필요한 필드 제거
      const normalizedRow = normalizeAndCleanData(row);
      
      const cleanedRow = {};
      for (const key in normalizedRow) {
        // BC, G_time, I_time 필드는 절대 포함하지 않음
        if (key === 'BC' || key === 'G_time' || key === 'I_time') {
          continue;
        }
        
        // undefined와 null만 제외 (빈 문자열은 유지)
        if (normalizedRow[key] !== undefined && normalizedRow[key] !== null) {
          // 문자열로 변환 가능한 값만 저장
          if (typeof normalizedRow[key] === 'string' || typeof normalizedRow[key] === 'number' || typeof normalizedRow[key] === 'boolean') {
            cleanedRow[key] = normalizedRow[key];
          } else if (typeof normalizedRow[key] === 'object') {
            // 객체는 JSON 문자열로 변환
            try {
              cleanedRow[key] = JSON.stringify(normalizedRow[key]);
            } catch (e) {
              // 변환 실패 시 건너뛰기
              console.warn('데이터 변환 실패:', key, normalizedRow[key]);
            }
          }
        } else if (normalizedRow[key] === '') {
          // 빈 문자열은 명시적으로 저장
          cleanedRow[key] = '';
        }
      }
      
      // 최종 확인: BC, G_time, I_time이 절대 포함되지 않았는지 검증
      if (cleanedRow.BC !== undefined || cleanedRow.G_time !== undefined || cleanedRow.I_time !== undefined) {
        console.error('❌ 오류: BC, G_time, I_time 필드가 여전히 존재합니다!', cleanedRow);
        delete cleanedRow.BC;
        delete cleanedRow.G_time;
        delete cleanedRow.I_time;
      }
      
      return cleanedRow;
    });
    
    const inputSheetRef = doc(db, 'inputSheet', 'current');
    
    // 모든 데이터 저장
    const dataToSave = {
      data: cleanedData,
      updatedAt: new Date().toISOString(),
      rowCount: cleanedData.length
    };
    
    console.log('💾 입력 시트 데이터 저장 시도:', {
      rowCount: cleanedData.length,
      firstRow: cleanedData[0] || null,
      lastRow: cleanedData[cleanedData.length - 1] || null
    });
    
    await setDoc(inputSheetRef, dataToSave);
    
    console.log('✅ 입력 시트 데이터 저장 완료:', cleanedData.length, '행');
    
    // 저장 후 확인 (검증)
    const verifySnap = await getDoc(inputSheetRef);
    if (verifySnap.exists()) {
      const savedData = verifySnap.data().data || [];
      console.log('✅ 저장 확인 완료:', savedData.length, '행이 Firebase에 저장되었습니다.');
    } else {
      console.error('❌ 저장 확인 실패: 문서가 존재하지 않습니다.');
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
      const data = inputSheetSnap.data().data || [];
      return data;
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
    const unsubscribe = onSnapshot(
      inputSheetRef, 
      {
        includeMetadataChanges: false // 메타데이터 변경은 무시
      },
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data().data || [];
          console.log('실시간 업데이트 감지:', data.length, '행');
          callback(data);
        } else {
          callback([]);
        }
      }, 
      (error) => {
        // 네트워크 오류는 무시하고 콘솔에만 로그
        if (error.code === 'unavailable' || error.code === 'deadline-exceeded' || error.message?.includes('ERR_QUIC')) {
          console.warn('Firestore 연결 일시 중단 (재연결 시도 중):', error.message);
          return;
        }
        
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
      }
    );
    
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

// Firebase에 계정 정보 저장
async function saveAccounts(accounts) {
  try {
    // db가 초기화되었는지 확인
    if (!db) {
      throw new Error('Firebase db가 초기화되지 않았습니다.');
    }
    
    const accountsRef = doc(db, 'settings', 'accounts');
    await setDoc(accountsRef, { 
      accounts: accounts,
      lastUpdated: new Date().toISOString()
    });
    
    // Firebase 저장 성공 시에도 localStorage에 동기화 (오프라인 백업용)
    try {
      localStorage.setItem('viewPageAccounts', JSON.stringify(accounts));
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
      
      // localStorage에도 동기화 (오프라인 백업용)
      try {
        localStorage.setItem('viewPageAccounts', JSON.stringify(accounts));
      } catch (e) {
        console.warn('⚠️ localStorage 동기화 실패:', e);
      }
      
      return accounts;
    } else {
      // Firebase에 데이터가 없으면 localStorage에서 불러오기 (마이그레이션)
      try {
        const localAccounts = localStorage.getItem('viewPageAccounts');
        if (localAccounts) {
          const accounts = JSON.parse(localAccounts);
          if (accounts.length > 0) {
            await saveAccounts(accounts);
            return accounts;
          }
        }
      } catch (e) {
        console.warn('⚠️ localStorage 불러오기 실패:', e);
      }
      
      return [];
    }
  } catch (error) {
    console.error('❌ Firebase 계정 불러오기 실패:', error);
    // Firebase 실패 시 localStorage 폴백
    try {
      const localAccounts = localStorage.getItem('viewPageAccounts');
      if (localAccounts) {
        const accounts = JSON.parse(localAccounts);
        return accounts;
      }
    } catch (e) {
      console.error('❌ localStorage 폴백도 실패:', e);
    }
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
    
    
    // localStorage에도 동기화
    try {
      localStorage.setItem('viewPageAccounts', JSON.stringify(filteredAccounts));
    } catch (e) {
      console.warn('⚠️ localStorage 동기화 실패:', e);
    }
    
    return { success: true, message: '계정이 삭제되었습니다.' };
  } catch (error) {
    console.error('❌ Firebase 계정 삭제 실패:', error);
    
    // Firebase 실패 시 localStorage에서 직접 삭제 시도
    try {
      const localAccounts = localStorage.getItem('viewPageAccounts');
      if (localAccounts) {
        const accounts = JSON.parse(localAccounts);
        const filteredAccounts = accounts.filter(acc => acc.userId !== userId);
        localStorage.setItem('viewPageAccounts', JSON.stringify(filteredAccounts));
        return { success: true, message: '계정이 삭제되었습니다. (로컬 저장)' };
      }
    } catch (e) {
      console.error('❌ localStorage 폴백도 실패:', e);
    }
    
    return { success: false, message: '계정 삭제에 실패했습니다.' };
  }
}

// Firebase의 모든 문서에서 BC, G_time, I_time 필드를 제거 (마이그레이션)
async function migrateRemoveOldFields() {
  try {
    console.log('🔄 마이그레이션 시작: BC, G_time, I_time 필드 제거...');
    
    // data 컬렉션 전체 스캔
    const dataSnapshot = await getDocs(collection(db, 'data'));
    let dataUpdated = 0;
    
    for (const docSnapshot of dataSnapshot.docs) {
      const data = docSnapshot.data();
      if (data.BC !== undefined || data.G_time !== undefined || data.I_time !== undefined) {
        const cleaned = normalizeAndCleanData(data);
        cleaned.createdAt = data.createdAt || cleaned.createdAt || new Date().toISOString();
        cleaned.updatedAt = new Date().toISOString();
        await setDoc(doc(db, 'data', docSnapshot.id), cleaned);
        dataUpdated++;
      }
    }
    
    // inputSheet/current 정리
    const inputSheetRef = doc(db, 'inputSheet', 'current');
    const inputSheetSnap = await getDoc(inputSheetRef);
    let inputSheetUpdated = 0;
    
    if (inputSheetSnap.exists()) {
      const rows = inputSheetSnap.data().data || [];
      let needsUpdate = false;
      const cleanedRows = rows.map((row = {}) => {
        if (row.BC !== undefined || row.G_time !== undefined || row.I_time !== undefined) {
          needsUpdate = true;
        }
        return normalizeAndCleanData(row);
      });
      
      if (needsUpdate) {
        await setDoc(inputSheetRef, {
          data: cleanedRows,
          rowCount: cleanedRows.length,
          updatedAt: new Date().toISOString()
        });
        inputSheetUpdated = cleanedRows.length;
      }
    }
    
    return { success: true, dataUpdated, inputSheetUpdated };
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    return { success: false, error };
  }
}

// 숨김 행 ID 목록을 Firebase에 저장
async function saveHiddenRowIds(hiddenRowIds) {
  try {
    const hiddenRef = doc(db, 'settings', 'hiddenRowIds');
    await setDoc(hiddenRef, {
      ids: hiddenRowIds,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error('숨김 행 ID 저장 실패:', error);
    throw error;
  }
}

// Firebase에서 숨김 행 ID 목록 불러오기
async function loadHiddenRowIds() {
  try {
    const hiddenRef = doc(db, 'settings', 'hiddenRowIds');
    const hiddenSnap = await getDoc(hiddenRef);
    
    if (hiddenSnap.exists()) {
      const data = hiddenSnap.data();
      return data.ids || [];
    }
    return [];
  } catch (error) {
    console.error('숨김 행 ID 불러오기 실패:', error);
    return [];
  }
}

// 숨김 행 ID 목록 실시간 리스너 설정
function setupHiddenRowIdsListener(callback) {
  try {
    const hiddenRef = doc(db, 'settings', 'hiddenRowIds');
    const unsubscribe = onSnapshot(hiddenRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback(data.ids || []);
      } else {
        callback([]);
      }
    }, (error) => {
      console.error('숨김 행 ID 리스너 오류:', error);
    });
    return unsubscribe;
  } catch (error) {
    console.error('숨김 행 ID 리스너 설정 실패:', error);
    return null;
  }
}

export { loadOptions, saveOptions, saveData, saveDataBatch, loadData, loadFilteredData, deleteData, deleteAllData, calculateColumn17, calculateColumn18, showAlert, saveInputSheetData, loadInputSheetData, setupInputSheetListener, saveSheet1Data, loadSheet1Data, saveAccounts, loadAccounts, deleteAccount, migrateRemoveOldFields, saveHiddenRowIds, loadHiddenRowIds, setupHiddenRowIdsListener };

// 전역으로 함수들을 export (기존 코드와의 호환성을 위해)
window.loadOptions = loadOptions;
window.saveOptions = saveOptions;
window.saveData = saveData;
window.loadData = loadData;
window.loadFilteredData = loadFilteredData;
window.deleteData = deleteData;
window.calculateColumn17 = calculateColumn17;
window.calculateColumn18 = calculateColumn18;
window.showAlert = showAlert;
window.saveAccounts = saveAccounts;
window.loadAccounts = loadAccounts;
window.deleteAccount = deleteAccount;
window.saveSheet1Data = saveSheet1Data;
window.loadSheet1Data = loadSheet1Data;
window.migrateRemoveOldFields = migrateRemoveOldFields;




