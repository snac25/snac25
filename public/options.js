// app.js에서 함수 import
import { loadOptions, saveOptions, showAlert } from './app.js';

// 페이지 로드 시 옵션 불러오기
window.addEventListener('DOMContentLoaded', () => {
  loadOptionsData();
});

// 옵션 불러오기
async function loadOptionsData() {
  try {
    const options = await loadOptions();
    if (options) {
      // 결과값 매핑 설정
      ['a', 'b', 'c', 'd'].forEach(result => {
        const mapping = options.pColumn.resultMapping[result] || {};
        document.getElementById(`${result}IMinusMMin`).value = mapping.iMinusMRange?.min || '';
        document.getElementById(`${result}IMinusMMax`).value = mapping.iMinusMRange?.max || '';
        document.getElementById(`${result}GMinusLMin`).value = mapping.gMinusLRange?.min || '';
        document.getElementById(`${result}GMinusLMax`).value = mapping.gMinusLRange?.max || '';
        document.getElementById(`${result}IKMCondition`).checked = mapping.iGreaterThanKGreaterThanM || false;
      });
      
      // Q열 옵션 설정
      document.getElementById('qGMinusLMin').value = options.qColumn.gMinusLRange.min || 0;
      document.getElementById('qGMinusLMax').value = options.qColumn.gMinusLRange.max || 100;
      document.getElementById('qGJLCondition').checked = options.qColumn.gGreaterThanJGreaterThanL || false;
      
      showAlert('옵션이 불러와졌습니다.');
    }
  } catch (error) {
    showAlert('옵션을 불러올 수 없습니다.', 'error');
  }
}

// 옵션 저장
async function saveOptionsData() {
  try {
    // P열 옵션 수집
    const pColumn = {
      resultMapping: {}
    };
    
    // 결과값 매핑 수집
    ['a', 'b', 'c', 'd'].forEach(result => {
      const iMinusMMin = parseFloat(document.getElementById(`${result}IMinusMMin`).value);
      const iMinusMMax = parseFloat(document.getElementById(`${result}IMinusMMax`).value);
      const gMinusLMin = parseFloat(document.getElementById(`${result}GMinusLMin`).value);
      const gMinusLMax = parseFloat(document.getElementById(`${result}GMinusLMax`).value);
      const iKMCondition = document.getElementById(`${result}IKMCondition`).checked;
      
      if (!isNaN(iMinusMMin) && !isNaN(iMinusMMax) && !isNaN(gMinusLMin) && !isNaN(gMinusLMax)) {
        pColumn.resultMapping[result] = {
          iMinusMRange: { min: iMinusMMin, max: iMinusMMax },
          gMinusLRange: { min: gMinusLMin, max: gMinusLMax },
          iGreaterThanKGreaterThanM: iKMCondition
        };
      }
    });
    
    // Q열 옵션 수집
    const qColumn = {
      gMinusLRange: {
        min: parseFloat(document.getElementById('qGMinusLMin').value) || 0,
        max: parseFloat(document.getElementById('qGMinusLMax').value) || 100
      },
      gGreaterThanJGreaterThanL: document.getElementById('qGJLCondition').checked
    };
    
    const options = {
      pColumn,
      qColumn
    };
    
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

