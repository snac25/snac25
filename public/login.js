// 로그인 처리
function handleLogin(event) {
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
  
  // localStorage에서 저장된 계정 정보 확인
  let accounts = [];
  
  try {
    const accountsStr = localStorage.getItem('viewPageAccounts');
    if (accountsStr) {
      accounts = JSON.parse(accountsStr);
    } else {
      // 기존 단일 계정 형식 호환성 처리
      const oldAccountStr = localStorage.getItem('viewPageAccount');
      if (oldAccountStr) {
        const oldAccount = JSON.parse(oldAccountStr);
        accounts = [oldAccount];
      }
    }
  } catch (error) {
    console.warn('계정 불러오기 실패:', error);
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

