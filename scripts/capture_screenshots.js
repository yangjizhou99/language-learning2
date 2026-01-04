const { chromium } = require('playwright');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\92515\\.gemini\\antigravity\\brain\\cb62c7b0-1621-42e3-98f4-65dbf0c95631';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Set viewport size for consistent screenshots
    await page.setViewportSize({ width: 1280, height: 800 });

    console.log('Navigating to login...');
    await page.goto('http://localhost:3001/login');

    console.log('Logging in...');
    await page.fill('input[type="email"]', 'yangjizhou100@gmail.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('Login successful, on dashboard.');

    // Wait for some content to load (e.g., knowledge map)
    await page.waitForTimeout(3000);

    console.log('Capturing Dashboard...');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'dashboard.png') });

    console.log('Navigating to Stats...');
    await page.goto('http://localhost:3001/profile/stats');
    await page.waitForTimeout(3000); // Wait for charts
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'stats.png') });

    console.log('Navigating to Shadowing List...');
    await page.goto('http://localhost:3001/shadowing');
    await page.waitForTimeout(3000); // Wait for list

    // Click the first item to go to player
    const firstItem = page.locator('a[href^="/shadowing/"]').first();
    if (await firstItem.count() > 0) {
        console.log('Clicking first shadowing item...');
        await firstItem.click();
        await page.waitForTimeout(5000); // Wait for player to load
        console.log('Capturing Shadowing Player...');
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'shadowing_player.png') });
    } else {
        console.log('No shadowing items found to click.');
    }

    await browser.close();
    console.log('Screenshots captured.');
})();
