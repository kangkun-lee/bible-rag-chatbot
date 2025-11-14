# Playwright 테스트 가이드

이 디렉토리에는 모바일과 PC 환경에서 화면이 제대로 보이는지 확인하는 Playwright 테스트가 포함되어 있습니다.

## 테스트 실행

### 모든 테스트 실행
```bash
npm run test
```

### UI 모드로 실행 (추천)
```bash
npm run test:ui
```

### 모바일 환경만 테스트
```bash
npm run test:mobile
```

### 데스크톱 환경만 테스트
```bash
npm run test:desktop
```

### 반응형 레이아웃 테스트만 실행
```bash
npm run test:responsive
```

### 시각적 레이아웃 테스트만 실행
```bash
npm run test:visual
```

## 테스트 파일 설명

### `responsive.spec.ts`
다양한 화면 크기와 디바이스에서 레이아웃이 제대로 작동하는지 확인합니다.

**테스트 항목:**
- 데스크톱 환경: 사이드바, 헤더, 채팅 영역 표시 확인
- 모바일 환경: 메뉴 버튼, 사이드바 열기/닫기, 메인 콘텐츠 표시 확인
- 태블릿 환경: 중간 크기 화면에서 레이아웃 확인
- 다양한 화면 크기: 320px부터 1920px까지 다양한 해상도 테스트

### `visual.spec.ts`
시각적 요소들의 위치, 크기, 가독성을 확인합니다.

**테스트 항목:**
- 요소 위치 및 크기: 사이드바, 메인 콘텐츠, 헤더, 입력 영역 위치 확인
- 텍스트 가독성: 텍스트 표시 및 잘림 확인
- 인터랙션 요소: 버튼 크기 및 클릭 가능성 확인
- 스크롤 동작: 스크롤 가능 여부 및 부드러운 동작 확인

## 테스트 환경

Playwright는 다음 환경에서 테스트를 실행합니다:

### 데스크톱
- Chrome (Chromium)
- Firefox
- Safari (WebKit)

### 모바일
- Pixel 5 (Android Chrome)
- iPhone 12 (iOS Safari)
- Galaxy S21 (Android)

## 개발 워크플로우

1. **코드 변경 후 테스트 실행**
   ```bash
   npm run test:ui
   ```

2. **특정 화면 크기에서만 테스트**
   - UI 모드에서 원하는 프로젝트(디바이스) 선택

3. **실패한 테스트 디버깅**
   - 스크린샷이 자동으로 저장됩니다
   - `playwright-report` 디렉토리에서 HTML 리포트 확인
   - UI 모드에서 실패한 테스트를 다시 실행하여 디버깅

## 주의사항

- 테스트 실행 전에 개발 서버가 실행 중이어야 합니다 (`npm run dev`)
- Playwright는 자동으로 개발 서버를 시작하지만, 수동으로 실행해도 됩니다
- CI 환경에서는 자동으로 서버를 시작합니다

## 문제 해결

### 테스트가 실패하는 경우
1. 개발 서버가 실행 중인지 확인
2. 브라우저가 최신 버전인지 확인: `npx playwright install`
3. 스크린샷과 트레이스를 확인하여 문제 파악

### 특정 테스트만 실행
```bash
npx playwright test tests/responsive.spec.ts -g "모바일"
```

### 헤드리스 모드 비활성화
```bash
npx playwright test --headed
```

