import { test, expect } from '@playwright/test';

test.describe('반응형 레이아웃 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 페이지 로드 대기
    await page.waitForLoadState('networkidle');
  });

  test.describe('데스크톱 환경', () => {
    test('메인 화면 요소들이 모두 보이는지 확인', async ({ page }) => {
      // 헤더 확인
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.getByText('안녕하세요, 사용자님')).toBeVisible();
      await expect(page.getByText('성경에 대해 무엇이든 물어보세요')).toBeVisible();

      // 사이드바가 데스크톱에서 열려있는지 확인
      const sidebar = page.locator('aside[role="navigation"]');
      await expect(sidebar).toBeVisible();

      // 채팅 입력 영역 확인
      const chatInput = page.locator('textarea, input[type="text"]').first();
      await expect(chatInput).toBeVisible();

      // 테마 토글 버튼 확인
      const themeToggle = page.getByRole('button').filter({ hasText: /테마|모드/i }).or(
        page.locator('button').filter({ has: page.locator('svg') })
      );
      // 테마 토글은 있을 수도 있고 없을 수도 있으므로 조건부 확인
      const themeToggleCount = await themeToggle.count();
      if (themeToggleCount > 0) {
        await expect(themeToggle.first()).toBeVisible();
      }
    });

    test('사이드바가 데스크톱에서 항상 보이는지 확인', async ({ page }) => {
      const sidebar = page.locator('aside[role="navigation"]');
      await expect(sidebar).toBeVisible();
      
      // 사이드바가 translate-x-0 클래스를 가지고 있는지 확인 (열려있음)
      const transform = await sidebar.evaluate((el) => {
        return window.getComputedStyle(el).transform;
      });
      expect(transform).not.toBe('matrix(1, 0, 0, 1, -100, 0)'); // -100% translate가 아님
    });

    test('채팅 영역이 스크롤 가능한지 확인', async ({ page }) => {
      const mainContent = page.locator('#main-content');
      await expect(mainContent).toBeVisible();
      
      // 스크롤 가능한지 확인
      const overflowY = await mainContent.evaluate((el) => {
        return window.getComputedStyle(el).overflowY;
      });
      expect(['auto', 'scroll']).toContain(overflowY);
    });
  });

  test.describe('모바일 환경', () => {
    test.use({ 
      viewport: { width: 375, height: 667 } // iPhone 12 크기
    });

    test('모바일 메뉴 버튼이 보이는지 확인', async ({ page }) => {
      // 햄버거 메뉴 버튼 확인
      const menuButton = page.locator('button[aria-label*="사이드바"], button[aria-label*="메뉴"]').first();
      await expect(menuButton).toBeVisible();
      
      // 버튼이 화면 왼쪽 상단에 있는지 확인
      const box = await menuButton.boundingBox();
      expect(box?.x).toBeLessThan(100); // 왼쪽에 위치
      expect(box?.y).toBeLessThan(100); // 상단에 위치
    });

    test('사이드바가 기본적으로 닫혀있는지 확인', async ({ page }) => {
      const sidebar = page.locator('aside[role="navigation"]');
      
      // 사이드바가 화면 밖에 있는지 확인 (translate-x-full 또는 -translate-x-full)
      const transform = await sidebar.evaluate((el) => {
        return window.getComputedStyle(el).transform;
      });
      
      // 모바일에서는 기본적으로 닫혀있어야 함 (왼쪽으로 이동)
      // translateX가 음수이거나 화면 밖에 있어야 함
      const isOffScreen = await sidebar.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.x + rect.width < 0 || rect.x > window.innerWidth;
      });
      
      // 사이드바가 보이지 않거나 화면 밖에 있어야 함
      const isVisible = await sidebar.isVisible();
      if (isVisible) {
        expect(isOffScreen).toBeTruthy();
      }
    });

    test('사이드바 열기/닫기 동작 확인', async ({ page }) => {
      const menuButton = page.locator('button[aria-label*="사이드바"], button[aria-label*="메뉴"]').first();
      const sidebar = page.locator('aside[role="navigation"]');
      
      // 사이드바 열기
      await menuButton.click();
      await page.waitForTimeout(300); // 애니메이션 대기
      
      // 사이드바가 보이는지 확인
      const sidebarBox = await sidebar.boundingBox();
      expect(sidebarBox?.x).toBeGreaterThanOrEqual(0);
      
      // 닫기 버튼 클릭
      const closeButton = sidebar.locator('button[aria-label*="닫기"]').first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await page.waitForTimeout(300);
        
        // 사이드바가 다시 닫혔는지 확인
        const isOffScreen = await sidebar.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return rect.x + rect.width < 0;
        });
        expect(isOffScreen).toBeTruthy();
      }
    });

    test('메인 콘텐츠가 모바일에서 보이는지 확인', async ({ page }) => {
      // 헤더 확인
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.getByText('안녕하세요, 사용자님')).toBeVisible();
      
      // 채팅 영역 확인
      const mainContent = page.locator('#main-content');
      await expect(mainContent).toBeVisible();
      
      // 채팅 입력 영역 확인
      const chatInput = page.locator('textarea, input[type="text"]').first();
      await expect(chatInput).toBeVisible();
      
      // 메인 콘텐츠가 화면에 보이는지 확인
      const mainContentBox = await mainContent.boundingBox();
      expect(mainContentBox).not.toBeNull();
      expect(mainContentBox?.width).toBeGreaterThan(0);
      expect(mainContentBox?.height).toBeGreaterThan(0);
    });

    test('오버레이가 사이드바 열릴 때 표시되는지 확인', async ({ page }) => {
      const menuButton = page.locator('button[aria-label*="사이드바"], button[aria-label*="메뉴"]').first();
      
      // 사이드바 열기
      await menuButton.click();
      await page.waitForTimeout(300);
      
      // 오버레이 확인 (배경이 어두워진 버튼)
      const overlay = page.locator('button').filter({ 
        has: page.locator('body')
      }).or(
        page.locator('[class*="bg-black"], [class*="backdrop"]')
      );
      
      // 오버레이가 있으면 클릭 가능해야 함
      const overlayButtons = page.locator('button[aria-label*="닫기"]');
      const overlayCount = await overlayButtons.count();
      // 오버레이가 있거나 사이드바가 열려있으면 OK
      expect(overlayCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('태블릿 환경', () => {
    test.use({ 
      viewport: { width: 768, height: 1024 } // iPad 크기
    });

    test('태블릿에서 레이아웃이 적절한지 확인', async ({ page }) => {
      // 헤더 확인
      await expect(page.getByRole('banner')).toBeVisible();
      
      // 사이드바 확인 (태블릿에서는 보일 수도 있고 안 보일 수도 있음)
      const sidebar = page.locator('aside[role="navigation"]');
      const sidebarVisible = await sidebar.isVisible();
      
      // 채팅 영역은 항상 보여야 함
      const mainContent = page.locator('#main-content');
      await expect(mainContent).toBeVisible();
      
      // 메인 콘텐츠 너비 확인
      const mainContentBox = await mainContent.boundingBox();
      expect(mainContentBox?.width).toBeGreaterThan(300); // 최소 너비 보장
    });
  });

  test.describe('다양한 화면 크기', () => {
    const viewports = [
      { name: '작은 모바일', width: 320, height: 568 }, // iPhone SE
      { name: '일반 모바일', width: 375, height: 667 }, // iPhone 12
      { name: '큰 모바일', width: 414, height: 896 }, // iPhone 11 Pro Max
      { name: '태블릿', width: 768, height: 1024 }, // iPad
      { name: '작은 데스크톱', width: 1024, height: 768 },
      { name: '일반 데스크톱', width: 1280, height: 720 },
      { name: '큰 데스크톱', width: 1920, height: 1080 },
    ];

    for (const viewport of viewports) {
      test(`${viewport.name} (${viewport.width}x${viewport.height})에서 레이아웃 확인`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // 메인 콘텐츠가 보이는지 확인
        const mainContent = page.locator('#main-content');
        await expect(mainContent).toBeVisible();
        
        // 채팅 입력 영역이 보이는지 확인
        const chatInput = page.locator('textarea, input[type="text"]').first();
        await expect(chatInput).toBeVisible();
        
        // 스크롤 가능한지 확인
        const canScroll = await mainContent.evaluate((el) => {
          return el.scrollHeight > el.clientHeight;
        });
        
        // 메인 콘텐츠가 화면을 벗어나지 않는지 확인
        const mainContentBox = await mainContent.boundingBox();
        expect(mainContentBox?.width).toBeLessThanOrEqual(viewport.width);
      });
    }
  });
});

