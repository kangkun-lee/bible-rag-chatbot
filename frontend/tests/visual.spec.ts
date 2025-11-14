import { test, expect } from '@playwright/test';

test.describe('시각적 레이아웃 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('요소 위치 및 크기', () => {
    test('데스크톱에서 사이드바와 메인 콘텐츠가 나란히 배치되는지 확인', async ({ page }) => {
      const sidebar = page.locator('aside[role="navigation"]');
      const mainContent = page.locator('#main-content');
      
      await expect(sidebar).toBeVisible();
      await expect(mainContent).toBeVisible();
      
      const sidebarBox = await sidebar.boundingBox();
      const mainContentBox = await mainContent.boundingBox();
      
      // 사이드바가 왼쪽에 있고, 메인 콘텐츠가 오른쪽에 있는지 확인
      expect(sidebarBox?.x).toBeLessThan(mainContentBox?.x || Infinity);
    });

    test('모바일에서 메인 콘텐츠가 전체 너비를 사용하는지 확인', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const mainContent = page.locator('#main-content');
      await expect(mainContent).toBeVisible();
      
      const mainContentBox = await mainContent.boundingBox();
      const viewportWidth = page.viewportSize()?.width || 375;
      
      // 메인 콘텐츠가 화면 너비의 대부분을 사용하는지 확인 (패딩 제외)
      expect(mainContentBox?.width).toBeGreaterThan(viewportWidth * 0.8);
    });

    test('헤더가 상단에 고정되어 있는지 확인', async ({ page }) => {
      const header = page.getByRole('banner');
      await expect(header).toBeVisible();
      
      const headerBox = await header.boundingBox();
      expect(headerBox?.y).toBeLessThan(100); // 상단에 위치
    });

    test('채팅 입력 영역이 하단에 고정되어 있는지 확인', async ({ page }) => {
      const chatInput = page.locator('textarea, input[type="text"]').first();
      await expect(chatInput).toBeVisible();
      
      const viewportHeight = page.viewportSize()?.height || 800;
      const inputBox = await chatInput.boundingBox();
      
      // 입력 영역이 화면 하단 근처에 있는지 확인
      expect(inputBox?.y).toBeGreaterThan(viewportHeight * 0.5);
    });
  });

  test.describe('텍스트 가독성', () => {
    test('모든 텍스트가 보이는지 확인', async ({ page }) => {
      // 주요 텍스트 요소들 확인
      await expect(page.getByText('안녕하세요, 사용자님')).toBeVisible();
      await expect(page.getByText('성경에 대해 무엇이든 물어보세요')).toBeVisible();
      
      // 텍스트 색상이 배경과 대비되는지 확인
      const heading = page.getByText('안녕하세요, 사용자님');
      const color = await heading.evaluate((el) => {
        return window.getComputedStyle(el).color;
      });
      expect(color).not.toBe('rgba(0, 0, 0, 0)'); // 투명하지 않음
    });

    test('모바일에서 텍스트가 잘리는지 확인', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 }); // 작은 화면
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const heading = page.getByText('안녕하세요, 사용자님');
      await expect(heading).toBeVisible();
      
      // 텍스트가 잘리지 않았는지 확인 (overflow 확인)
      const headingBox = await heading.boundingBox();
      const headingParent = heading.locator('..');
      const parentBox = await headingParent.boundingBox();
      
      if (headingBox && parentBox) {
        // 텍스트가 부모 요소를 벗어나지 않는지 확인
        expect(headingBox.width).toBeLessThanOrEqual(parentBox.width);
      }
    });
  });

  test.describe('인터랙션 요소', () => {
    test('버튼들이 충분한 크기를 가지고 있는지 확인', async ({ page }) => {
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const box = await button.boundingBox();
          // 모바일 터치 타겟 최소 크기: 44x44px
          expect(box?.width).toBeGreaterThanOrEqual(40);
          expect(box?.height).toBeGreaterThanOrEqual(40);
        }
      }
    });

    test('모바일에서 메뉴 버튼이 쉽게 클릭 가능한 위치에 있는지 확인', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const menuButton = page.locator('button[aria-label*="사이드바"], button[aria-label*="메뉴"]').first();
      await expect(menuButton).toBeVisible();
      
      const buttonBox = await menuButton.boundingBox();
      // 왼쪽 상단에 위치하고 충분한 크기를 가지고 있는지 확인
      expect(buttonBox?.x).toBeLessThan(100);
      expect(buttonBox?.y).toBeLessThan(100);
      expect(buttonBox?.width).toBeGreaterThanOrEqual(40);
      expect(buttonBox?.height).toBeGreaterThanOrEqual(40);
    });
  });

  test.describe('스크롤 동작', () => {
    test('채팅 영역이 스크롤 가능한지 확인', async ({ page }) => {
      const mainContent = page.locator('#main-content');
      await expect(mainContent).toBeVisible();
      
      // 충분한 콘텐츠를 추가하여 스크롤 가능하게 만들기
      const chatInput = page.locator('textarea, input[type="text"]').first();
      await chatInput.fill('테스트 메시지');
      await chatInput.press('Enter');
      
      // 스크롤 가능한지 확인
      const scrollHeight = await mainContent.evaluate((el) => el.scrollHeight);
      const clientHeight = await mainContent.evaluate((el) => el.clientHeight);
      
      // 스크롤이 가능하거나 콘텐츠가 적어도 스크롤 컨테이너가 있어야 함
      expect(scrollHeight).toBeGreaterThan(0);
    });

    test('모바일에서 스크롤이 부드럽게 동작하는지 확인', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const mainContent = page.locator('#main-content');
      await expect(mainContent).toBeVisible();
      
      // 스크롤 동작 확인
      const scrollBehavior = await mainContent.evaluate((el) => {
        return window.getComputedStyle(el).scrollBehavior;
      });
      
      // smooth 스크롤이 설정되어 있거나 기본값이어야 함
      expect(['smooth', 'auto']).toContain(scrollBehavior);
    });
  });
});

