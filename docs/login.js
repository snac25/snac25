// window.loadAccounts가 로드될 때까지 기다리는 함수
async function waitForLoadAccounts(maxWaitTime = 5000) {
  const startTime = Date.now();
  
  while (typeof window.loadAccounts !== 'function') {
    if (Date.now() - startTime > maxWaitTime) {
      console.warn('window.loadAccounts 로드 시간 초과');
      return false;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return true;
}

// 로그인 처리
async function handleLogin(event) {
  event.preventDefault();
  
  const userId = document.getElementById('userId').value.trim();
  const userPassword = document.getElementById('userPassword').value;
  
  if (!userId) {
    alert('아이디를 입력해주세요.');
    return;
  }
  
  if (!userPassword) {
    alert('비밀번호를 입력해주세요.');
    return;
  }
  
  // Firebase에서 계정 정보 불러오기
  let accounts = [];
  
  try {
    // window.loadAccounts가 로드될 때까지 기다림
    const isLoaded = await waitForLoadAccounts();
    
    if (isLoaded && typeof window.loadAccounts === 'function') {
      // Firebase에서 계정 정보 불러오기 (우선순위 1)
      accounts = await window.loadAccounts();
      console.log('✅ Firebase에서 계정 정보 불러오기 성공:', accounts.length, '개');
    } else {
      // window.loadAccounts가 로드되지 않은 경우 localStorage에서 불러오기 (폴백)
      console.warn('⚠️ window.loadAccounts가 로드되지 않았습니다. localStorage에서 불러옵니다.');
      const localAccounts = localStorage.getItem('viewPageAccounts');
      if (localAccounts) {
        accounts = JSON.parse(localAccounts);
        console.log('📦 localStorage에서 계정 정보 불러오기:', accounts.length, '개');
    } else {
      // 기존 단일 계정 형식 호환성 처리
      const oldAccountStr = localStorage.getItem('viewPageAccount');
      if (oldAccountStr) {
        const oldAccount = JSON.parse(oldAccountStr);
        accounts = [oldAccount];
          console.log('📦 기존 단일 계정 형식에서 불러오기');
        }
      }
    }
  } catch (error) {
    console.error('❌ 계정 불러오기 실패:', error);
    // 에러 발생 시 localStorage 폴백
    try {
      const localAccounts = localStorage.getItem('viewPageAccounts');
      if (localAccounts) {
        accounts = JSON.parse(localAccounts);
        console.log('📦 에러 발생, localStorage 폴백으로 불러오기:', accounts.length, '개');
      }
    } catch (e) {
      console.error('❌ localStorage 폴백도 실패:', e);
    }
  }
  
  if (accounts.length === 0) {
    alert('등록된 계정이 없습니다. 입력 페이지에서 계정을 설정해주세요.');
    document.getElementById('userId').value = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userId').focus();
    return;
  }
  
  // 계정 목록에서 일치하는 계정 찾기
  const matchedAccount = accounts.find(acc => acc.userId === userId && acc.password === userPassword);
  
  if (matchedAccount) {
    // 로그인 성공
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('loggedInUserId', userId);
    window.location.href = 'view.html';
  } else {
    alert('아이디 또는 비밀번호가 일치하지 않습니다.');
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').focus();
  }
}

// 페이지 로드 시 이미 로그인되어 있으면 조회 페이지로 리다이렉트
window.addEventListener('DOMContentLoaded', () => {
  const isLoggedIn = sessionStorage.getItem('isLoggedIn');
  if (isLoggedIn === 'true') {
    window.location.href = 'view.html';
  }
});

// 전역으로 함수 export (HTML의 onsubmit에서 사용하기 위해)
window.handleLogin = handleLogin;

