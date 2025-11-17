# Firestore 보안 규칙 설정 가이드

## 문제
실시간 동기화 기능을 사용하려면 Firestore 보안 규칙에서 `inputSheet` 컬렉션에 대한 읽기/쓰기 권한이 필요합니다.

## 해결 방법

### 1. Firebase Console 접속
1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. 프로젝트 `snac25-69db3` 선택

### 2. Firestore Database로 이동
1. 왼쪽 메뉴에서 **Firestore Database** 클릭
2. 상단 탭에서 **규칙** 클릭

### 3. 보안 규칙 수정
다음 규칙을 추가하거나 기존 규칙을 수정하세요:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // settings 컬렉션 (옵션 설정)
    match /settings/{document=**} {
      allow read, write: if true;
    }
    
    // data 컬렉션 (조회 데이터)
    match /data/{document=**} {
      allow read, write: if true;
    }
    
    // inputSheet 컬렉션 (실시간 입력 시트)
    match /inputSheet/{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 4. 규칙 게시
1. **게시** 버튼 클릭
2. 규칙이 적용되는데 몇 초 정도 걸릴 수 있습니다

## 주의사항
- 현재 규칙은 모든 사용자에게 읽기/쓰기 권한을 허용합니다
- 프로덕션 환경에서는 인증을 추가하여 보안을 강화하는 것을 권장합니다
- 예: `allow read, write: if request.auth != null;` (인증된 사용자만)

