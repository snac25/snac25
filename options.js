// app.js에서 함수 import
import { loadOptions, saveOptions, showAlert } from './app.js';

// 페이지 로드 시 옵션 불러오기
window.addEventListener('DOMContentLoaded', () => {
  loadOptionsData();
  initOptionsTabs();
});

// 탭 전환 기능
function initOptionsTabs() {
  const tabs = document.querySelectorAll('.options-tab');
  const tabContents = document.querySelectorAll('.options-tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = tab.getAttribute('data-tab');
      
      // 모든 탭과 컨텐츠에서 active 클래스 제거
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // 선택된 탭과 컨텐츠에 active 클래스 추가
      tab.classList.add('active');
      const targetContent = document.getElementById(`${targetTab}-tab`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// 옵션 불러오기
async function loadOptionsData() {
  try {
    const options = await loadOptions();
    if (options) {
      // 17열 옵션 설정
      if (options.column17) {
        ['a', 'b', 'c', 'd', 'aPlus', 'bPlus'].forEach(grade => {
          const gradeOptions = options.column17.gradeMapping[grade] || {};
          
          // 안전하게 요소를 찾아서 값 설정
          const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value || '';
          };
          
          const setChecked = (id, checked) => {
            const el = document.getElementById(id);
            if (el) el.checked = checked || false;
          };
          
          setValue(`${grade}JMinusNMin`, gradeOptions.jMinusNRange?.min);
          setValue(`${grade}JMinusNMax`, gradeOptions.jMinusNRange?.max);
          setValue(`${grade}HMinusMMin`, gradeOptions.hMinusMRange?.min);
          setValue(`${grade}HMinusMMax`, gradeOptions.hMinusMRange?.max);
          setValue(`${grade}MValueMin`, gradeOptions.mValueRange?.min);
          setValue(`${grade}MValueMax`, gradeOptions.mValueRange?.max);
          setValue(`${grade}IValueMin`, gradeOptions.iValueRange?.min);
          setValue(`${grade}IValueMax`, gradeOptions.iValueRange?.max);
          setChecked(`${grade}JGreaterThanLGreaterThanN`, gradeOptions.jGreaterThanLGreaterThanN);
          
          // 기존 범위 형식과 새 단일 값 형식 모두 지원
          const lValue = gradeOptions.lValue ?? gradeOptions.lRange?.min ?? '';
          const nValue = gradeOptions.nValue ?? gradeOptions.nRange?.min ?? '';
          setValue(`${grade}LValue`, lValue);
          setValue(`${grade}NValue`, nValue);
          
          setChecked(`${grade}LeagueGradeA`, gradeOptions.leagueGrades?.includes('A'));
          setChecked(`${grade}LeagueGradeB`, gradeOptions.leagueGrades?.includes('B'));
          setChecked(`${grade}LeagueGradeC`, gradeOptions.leagueGrades?.includes('C'));
          setChecked(`${grade}LeagueGradeS`, gradeOptions.leagueGrades?.includes('S'));
        });
      }
      
      // 18열 옵션 설정
      if (options.column18) {
        ['A', 'B', 'C', 'S'].forEach(leagueGrade => {
          const leagueOptions = options.column18.leagueGradeMapping[leagueGrade] || {};
          
          // 안전하게 요소를 찾아서 값 설정
          const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value || '';
          };
          
          const setChecked = (id, checked) => {
            const el = document.getElementById(id);
            if (el) el.checked = checked || false;
          };
          
          // 옵션 세트 1
          setValue(`league${leagueGrade}HMinusMMin`, leagueOptions.hMinusMRange?.min);
          setValue(`league${leagueGrade}HMinusMMax`, leagueOptions.hMinusMRange?.max);
          setValue(`league${leagueGrade}MValueMin`, leagueOptions.mValueRange?.min);
          setValue(`league${leagueGrade}MValueMax`, leagueOptions.mValueRange?.max);
          setValue(`league${leagueGrade}HValueMin`, leagueOptions.hValueRange?.min);
          setValue(`league${leagueGrade}HValueMax`, leagueOptions.hValueRange?.max);
          setChecked(`league${leagueGrade}HGreaterThanKGreaterThanM`, leagueOptions.hGreaterThanKGreaterThanM);
          
          // 기존 범위 형식과 새 단일 값 형식 모두 지원
          const kValue = leagueOptions.kValue ?? leagueOptions.kRange?.min ?? '';
          const mValue = leagueOptions.mValue ?? leagueOptions.mRange?.min ?? '';
          setValue(`league${leagueGrade}KValue`, kValue);
          setValue(`league${leagueGrade}MValue`, mValue);
          
          // 옵션 세트 2
          const optionSet2 = leagueOptions.optionSet2 || {};
          setValue(`league${leagueGrade}2HMinusMMin`, optionSet2.hMinusMRange?.min);
          setValue(`league${leagueGrade}2HMinusMMax`, optionSet2.hMinusMRange?.max);
          setValue(`league${leagueGrade}2MValueMin`, optionSet2.mValueRange?.min);
          setValue(`league${leagueGrade}2MValueMax`, optionSet2.mValueRange?.max);
          setValue(`league${leagueGrade}2HValueMin`, optionSet2.hValueRange?.min);
          setValue(`league${leagueGrade}2HValueMax`, optionSet2.hValueRange?.max);
          setChecked(`league${leagueGrade}2HGreaterThanKGreaterThanM`, optionSet2.hGreaterThanKGreaterThanM);
          
          // 기존 범위 형식과 새 단일 값 형식 모두 지원
          const k2Value = optionSet2.kValue ?? optionSet2.kRange?.min ?? '';
          const m2Value = optionSet2.mValue ?? optionSet2.mRange?.min ?? '';
          setValue(`league${leagueGrade}2KValue`, k2Value);
          setValue(`league${leagueGrade}2MValue`, m2Value);
        });
      }
      
      showAlert('옵션이 불러와졌습니다.');
    } else {
      console.log('저장된 옵션이 없습니다.');
    }
  } catch (error) {
    console.error('옵션 불러오기 오류:', error);
    showAlert('옵션을 불러올 수 없습니다: ' + (error.message || error), 'error');
  }
}

// 옵션 저장
async function saveOptionsData() {
  try {
    // 17열 옵션 수집
    const column17 = {
      gradeMapping: {}
    };
    
    ['a', 'b', 'c', 'd', 'aPlus', 'bPlus'].forEach(grade => {
      // 안전하게 요소를 찾아서 값 가져오기
      const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? parseFloat(el.value) : NaN;
      };
      
      const getChecked = (id) => {
        const el = document.getElementById(id);
        return el ? el.checked : false;
      };
      
      const jMinusNMin = getValue(`${grade}JMinusNMin`);
      const jMinusNMax = getValue(`${grade}JMinusNMax`);
      const hMinusMMin = getValue(`${grade}HMinusMMin`);
      const hMinusMMax = getValue(`${grade}HMinusMMax`);
      const mValueMin = getValue(`${grade}MValueMin`);
      const mValueMax = getValue(`${grade}MValueMax`);
      const iValueMin = getValue(`${grade}IValueMin`);
      const iValueMax = getValue(`${grade}IValueMax`);
      console.log(`[${grade}] I값 범위:`, { iValueMin, iValueMax, isNaNMin: isNaN(iValueMin), isNaNMax: isNaN(iValueMax) });
      const jGreaterThanLGreaterThanN = getChecked(`${grade}JGreaterThanLGreaterThanN`);
      const lValue = getValue(`${grade}LValue`);
      const nValue = getValue(`${grade}NValue`);
      const leagueGradeA = getChecked(`${grade}LeagueGradeA`);
      const leagueGradeB = getChecked(`${grade}LeagueGradeB`);
      const leagueGradeC = getChecked(`${grade}LeagueGradeC`);
      const leagueGradeS = getChecked(`${grade}LeagueGradeS`);
      
      const gradeOptions = {};
      
      // 각 옵션이 설정되어 있으면 추가
      if (!isNaN(jMinusNMin) && !isNaN(jMinusNMax)) {
        gradeOptions.jMinusNRange = { min: jMinusNMin, max: jMinusNMax };
      }
      if (!isNaN(hMinusMMin) && !isNaN(hMinusMMax)) {
        gradeOptions.hMinusMRange = { min: hMinusMMin, max: hMinusMMax };
      }
      if (!isNaN(mValueMin) && !isNaN(mValueMax)) {
        gradeOptions.mValueRange = { min: mValueMin, max: mValueMax };
      }
      if (!isNaN(iValueMin) && !isNaN(iValueMax)) {
        gradeOptions.iValueRange = { min: iValueMin, max: iValueMax };
        console.log(`[${grade}] iValueRange 추가됨:`, gradeOptions.iValueRange);
      } else {
        console.log(`[${grade}] iValueRange 추가 안됨 (값 없음)`);
      }
      
      // jGreaterThanLGreaterThanN은 항상 저장 (true/false 모두)
      gradeOptions.jGreaterThanLGreaterThanN = jGreaterThanLGreaterThanN;
      console.log(`[${grade}] jGreaterThanLGreaterThanN 저장:`, jGreaterThanLGreaterThanN);
      
      // 12열(L열) 값 저장 (값이 있으면 저장)
      if (!isNaN(lValue)) {
        gradeOptions.lValue = lValue;
      }
      
      // 14열(N열) 값 저장 (값이 있으면 저장)
      if (!isNaN(nValue)) {
        gradeOptions.nValue = nValue;
      }
      
      const leagueGrades = [];
      if (leagueGradeA) leagueGrades.push('A');
      if (leagueGradeB) leagueGrades.push('B');
      if (leagueGradeC) leagueGrades.push('C');
      if (leagueGradeS) leagueGrades.push('S');
      if (leagueGrades.length > 0) {
        gradeOptions.leagueGrades = leagueGrades;
      }
      
      // jGreaterThanLGreaterThanN이 있으면 항상 저장 (다른 옵션이 없어도)
      if (Object.keys(gradeOptions).length > 0) {
        column17.gradeMapping[grade] = gradeOptions;
        console.log(`[${grade}] gradeOptions 저장됨:`, gradeOptions);
      } else {
        console.log(`[${grade}] gradeOptions 저장 안됨 (옵션 없음)`);
      }
    });
    
    // 18열 옵션 수집
    const column18 = {
      leagueGradeMapping: {}
    };
    
    ['A', 'B', 'C', 'S'].forEach(leagueGrade => {
      // 안전하게 요소를 찾아서 값 가져오기
      const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? parseFloat(el.value) : NaN;
      };
      
      const getChecked = (id) => {
        const el = document.getElementById(id);
        return el ? el.checked : false;
      };
      
      const hMinusMMin = getValue(`league${leagueGrade}HMinusMMin`);
      const hMinusMMax = getValue(`league${leagueGrade}HMinusMMax`);
      const mValueMin = getValue(`league${leagueGrade}MValueMin`);
      const mValueMax = getValue(`league${leagueGrade}MValueMax`);
      const hValueMin = getValue(`league${leagueGrade}HValueMin`);
      const hValueMax = getValue(`league${leagueGrade}HValueMax`);
      const hGreaterThanKGreaterThanM = getChecked(`league${leagueGrade}HGreaterThanKGreaterThanM`);
      const kValue = getValue(`league${leagueGrade}KValue`);
      const mValue = getValue(`league${leagueGrade}MValue`);
      
      const leagueOptions = {};
      
      if (!isNaN(hMinusMMin) && !isNaN(hMinusMMax)) {
        leagueOptions.hMinusMRange = { min: hMinusMMin, max: hMinusMMax };
      }
      
      if (!isNaN(mValueMin) && !isNaN(mValueMax)) {
        leagueOptions.mValueRange = { min: mValueMin, max: mValueMax };
      }
      
      if (!isNaN(hValueMin) && !isNaN(hValueMax)) {
        leagueOptions.hValueRange = { min: hValueMin, max: hValueMax };
      }
      
      leagueOptions.hGreaterThanKGreaterThanM = hGreaterThanKGreaterThanM;
      
      // 11열(K열) 값 저장 (값이 있으면 저장)
      if (!isNaN(kValue)) {
        leagueOptions.kValue = kValue;
      }
      
      // 13열(M열) 값 저장 (값이 있으면 저장)
      if (!isNaN(mValue)) {
        leagueOptions.mValue = mValue;
      }
      
      // 옵션 세트 2 수집
      const h2MinusMMin = getValue(`league${leagueGrade}2HMinusMMin`);
      const h2MinusMMax = getValue(`league${leagueGrade}2HMinusMMax`);
      const m2ValueMin = getValue(`league${leagueGrade}2MValueMin`);
      const m2ValueMax = getValue(`league${leagueGrade}2MValueMax`);
      const h2ValueMin = getValue(`league${leagueGrade}2HValueMin`);
      const h2ValueMax = getValue(`league${leagueGrade}2HValueMax`);
      const h2GreaterThanKGreaterThanM = getChecked(`league${leagueGrade}2HGreaterThanKGreaterThanM`);
      const k2Value = getValue(`league${leagueGrade}2KValue`);
      const m2Value = getValue(`league${leagueGrade}2MValue`);
      
      const optionSet2 = {};
      
      if (!isNaN(h2MinusMMin) && !isNaN(h2MinusMMax)) {
        optionSet2.hMinusMRange = { min: h2MinusMMin, max: h2MinusMMax };
      }
      
      if (!isNaN(m2ValueMin) && !isNaN(m2ValueMax)) {
        optionSet2.mValueRange = { min: m2ValueMin, max: m2ValueMax };
      }
      
      if (!isNaN(h2ValueMin) && !isNaN(h2ValueMax)) {
        optionSet2.hValueRange = { min: h2ValueMin, max: h2ValueMax };
      }
      
      optionSet2.hGreaterThanKGreaterThanM = h2GreaterThanKGreaterThanM;
      
      // 11열(K열) 값 저장 (값이 있으면 저장)
      if (!isNaN(k2Value)) {
        optionSet2.kValue = k2Value;
      }
      
      // 13열(M열) 값 저장 (값이 있으면 저장)
      if (!isNaN(m2Value)) {
        optionSet2.mValue = m2Value;
      }
      
      // 옵션 세트 2가 있으면 추가
      if (Object.keys(optionSet2).length > 0) {
        leagueOptions.optionSet2 = optionSet2;
      }
      
      // 최소한 하나의 옵션이 설정되어 있으면 저장
      if (Object.keys(leagueOptions).length > 0) {
        column18.leagueGradeMapping[leagueGrade] = leagueOptions;
      }
    });
    
    const options = {
      column17,
      column18
    };
    
    console.log('저장할 옵션:', JSON.stringify(options, null, 2));
    
    await saveOptions(options);
    showAlert('옵션이 저장되었습니다!', 'success');
    // 추가 알림: alert로도 표시
    alert('옵션이 저장되었습니다!');
  } catch (error) {
    showAlert('옵션 저장에 실패했습니다.', 'error');
    alert('옵션 저장에 실패했습니다.');
  }
}

// 전역으로 함수 export
window.loadOptionsData = loadOptionsData;
window.saveOptionsData = saveOptionsData;