# 엑셀 입력 조회 시스템

엑셀 형태의 입력 시트와 조회 페이지를 제공하는 웹 애플리케이션입니다.

## 주요 기술 스택

- **Frontend**: HTML, CSS, JavaScript (ES6 Modules)
- **Backend**: Node.js, Express
- **Database**: Firebase Firestore
- **Deployment**: Firebase Hosting (예정)

## 기능

- **입력 페이지**: 17개 열을 가진 테이블에서 G, I, J, K, L, M 열에 숫자를 입력
- **자동 계산**: P열과 Q열이 입력값에 따라 자동으로 계산됨
- **조회 페이지**: P열이 a, b, c, d 중 하나이거나 Q열에 "o" 값이 있는 항목만 필터링하여 표시
- **옵션 설정**: P열과 Q열의 계산 조건을 사용자 정의 가능

## 설치 및 실행

1. 의존성 설치:
```bash
npm install
```

2. 서버 실행:
```bash
npm start
```

3. 브라우저에서 접속:
```
http://localhost:3000/input.html
```

## 사용 방법

### 1. 옵션 설정 (먼저 설정 필요)

1. "옵션 설정" 페이지로 이동
2. P열 계산 옵션 설정:
   - I-M 범위: 최소값 ~ 최대값
   - G-L 범위: 최소값 ~ 최대값
   - I>K>M 조건 체크박스
   - 결과값 매핑 (a, b, c, d): 각 결과값에 대한 I-M 범위와 G-L 범위 설정
3. Q열 계산 옵션 설정:
   - G-L 범위: 최소값 ~ 최대값
   - G>J>L 조건 체크박스
4. "옵션 저장" 버튼 클릭

### 2. 데이터 입력

1. "입력" 페이지로 이동
2. "행 추가" 버튼으로 행 추가
3. G, I, J, K, L, M 열에 숫자 입력
4. "계산" 버튼을 클릭하거나 입력 시 자동으로 P열과 Q열이 계산됨
5. "저장" 버튼으로 데이터 저장

### 3. 데이터 조회

1. "조회" 페이지로 이동
2. P열이 a, b, c, d 중 하나이거나 Q열에 "o" 값이 있는 항목만 자동으로 필터링되어 표시됨
3. P열은 결과값과 함께 M값이 표시됨
4. Q열은 "o" 표시와 함께 L값이 표시됨

## Firebase 설정

이 프로젝트는 Firebase Firestore를 사용하여 데이터를 저장합니다.

1. Firebase Console에서 프로젝트 생성
2. `public/firebase-config.js` 파일에 Firebase 설정 정보 입력
3. Firestore Database 생성 및 보안 규칙 설정

## 파일 구조

```
snac/
├── public/
│   ├── input.html          # 입력 페이지
│   ├── view.html           # 조회 페이지
│   ├── login.html          # 로그인 페이지
│   ├── options.html        # 옵션 설정 페이지
│   ├── styles.css          # 공통 스타일
│   ├── app.js              # 공통 JavaScript (Firebase 연동, 계산 로직)
│   ├── firebase-config.js  # Firebase 설정
│   ├── input.js            # 입력 페이지 JavaScript
│   ├── view.js             # 조회 페이지 JavaScript
│   ├── login.js            # 로그인 페이지 JavaScript
│   └── options.js          # 옵션 설정 페이지 JavaScript
├── server.js               # Express 서버
├── package.json            # 프로젝트 설정
├── .gitignore              # Git 제외 파일 목록
└── README.md               # 이 파일
```

## 계산 로직

### P열 계산

다음 3가지 조건을 모두 만족해야 함:
1. I-M의 값이 설정된 범위 내에 있어야 함
2. G-L의 값이 설정된 범위 내에 있어야 함
3. I>K>M 조건 (옵션에서 체크한 경우만)

모든 조건을 만족하면, 결과값 매핑에 따라 a, b, c, d 중 하나가 할당됨.

### Q열 계산

다음 2가지 조건을 모두 만족해야 함:
1. G-L의 값이 설정된 범위 내에 있어야 함
2. G>J>L 조건 (옵션에서 체크한 경우만)

모든 조건을 만족하면 "o"가 표시됨.

