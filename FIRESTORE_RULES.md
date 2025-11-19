# Firebase Firestore 보안 규칙

이 파일은 Firebase Console에서 Firestore 보안 규칙을 설정할 때 사용하는 규칙입니다.

## 설정 방법

1. Firebase Console (https://console.firebase.google.com) 접속
2. 프로젝트 선택
3. 왼쪽 메뉴에서 "Firestore Database" 클릭
4. "규칙" 탭 클릭
5. 아래 규칙을 복사하여 붙여넣기
6. "게시" 버튼 클릭

## 보안 규칙

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
    
    // sheet1 컬렉션 (시트1 데이터)
    match /sheet1/{document=**} {
      allow read, write: if true;
    }
  }
}
```

## 중요 사항

- 이 규칙은 모든 사용자에게 읽기/쓰기 권한을 허용합니다.
- 프로덕션 환경에서는 인증된 사용자만 접근할 수 있도록 수정하는 것을 권장합니다.
- 규칙을 변경한 후 반드시 "게시" 버튼을 클릭해야 적용됩니다.
