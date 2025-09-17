import { test, expect } from '@playwright/test';

test.describe('Trakshya Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/api/auth/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-user',
            email: 'test@example.com',
            name: 'Test User',
          },
        }),
      });
    });

    // Mock API endpoints
    await page.route('**/api/ai/recommendations', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          recommendations: [
            {
              id: 'rec-1',
              type: 'delay',
              title: 'Hold Train 123 for 2 mins → Saves 14 mins overall',
              description: 'Reduces conflict near Kanpur Jn',
              confidence: 0.87,
              impact: {
                delayReduction: 14,
                throughputImprovement: 12,
              },
              actions: {
                trainId: '123',
                delayMinutes: 2,
              },
              reasoning: 'Test reasoning',
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route('**/api/energy/series', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          points: Array.from({ length: 24 }, (_, i) => ({
            h: i,
            base: 60 + Math.random() * 20,
            opt: 50 + Math.random() * 20,
          })),
        }),
      });
    });

    await page.goto('/');
  });

  test('loads dashboard with key metrics', async ({ page }) => {
    // Check if main dashboard elements are present
    await expect(page.locator('[data-testid="active-trains"]')).toBeVisible();
    await expect(page.locator('[data-testid="avg-delay"]')).toBeVisible();
    await expect(page.locator('[data-testid="energy-efficiency"]')).toBeVisible();
    await expect(page.locator('[data-testid="network-throughput"]')).toBeVisible();

    // Check metric values are displayed
    await expect(page.locator('[data-testid="active-trains"]')).toContainText('142');
    await expect(page.locator('[data-testid="avg-delay"]')).toContainText('4.2');
    await expect(page.locator('[data-testid="energy-efficiency"]')).toContainText('92.4');
    await expect(page.locator('[data-testid="network-throughput"]')).toContainText('87.6');
  });

  test('displays AI recommendations', async ({ page }) => {
    // Wait for recommendations to load
    await expect(page.locator('[data-testid="decision-card"]')).toBeVisible();
    
    // Check recommendation content
    await expect(page.locator('text=Hold Train 123 for 2 mins')).toBeVisible();
    await expect(page.locator('text=87%')).toBeVisible(); // confidence
    await expect(page.locator('text=-14m')).toBeVisible(); // delay reduction
    
    // Check action buttons
    await expect(page.locator('button:has-text("Accept")')).toBeVisible();
    await expect(page.locator('button:has-text("Reject")')).toBeVisible();
  });

  test('accepts AI recommendation', async ({ page }) => {
    // Mock the decision API
    await page.route('**/decisions', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Wait for recommendation to load
    await expect(page.locator('[data-testid="decision-card"]')).toBeVisible();
    
    // Click accept button
    await page.click('button:has-text("Accept")');
    
    // Check for success toast
    await expect(page.locator('text=Recommendation applied')).toBeVisible();
  });

  test('opens scenario simulation modal', async ({ page }) => {
    // Click what-if scenarios button
    await page.click('button:has-text("What-If Scenarios")');
    
    // Check modal is open
    await expect(page.locator('[data-testid="scenario-modal"]')).toBeVisible();
    await expect(page.locator('text=Scenario Simulation Center')).toBeVisible();
    
    // Check predefined scenarios are listed
    await expect(page.locator('text=Dense Fog')).toBeVisible();
    await expect(page.locator('text=Signal System Failure')).toBeVisible();
    await expect(page.locator('text=Emergency Track Closure')).toBeVisible();
  });

  test('runs scenario simulation', async ({ page }) => {
    // Mock scenario API
    await page.route('**/api/ai/scenario', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          explanation: 'Dense fog will reduce visibility and require speed restrictions.',
        }),
      });
    });

    // Open scenario modal
    await page.click('button:has-text("What-If Scenarios")');
    
    // Select a scenario
    await page.click('text=Dense Fog');
    
    // Run simulation
    await page.click('button:has-text("Run Simulation")');
    
    // Check simulation progress
    await expect(page.locator('text=Running Simulation')).toBeVisible();
    
    // Wait for completion (with timeout)
    await expect(page.locator('text=Simulation Results')).toBeVisible({ timeout: 10000 });
  });

  test('displays energy analytics chart', async ({ page }) => {
    // Check energy chart is present
    await expect(page.locator('[data-testid="energy-chart"]')).toBeVisible();
    
    // Check chart controls
    await expect(page.locator('button[aria-label="Line chart"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Area chart"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Bar chart"]')).toBeVisible();
    
    // Switch chart type
    await page.click('button[aria-label="Area chart"]');
    
    // Check chart updated (this would require more specific selectors in real implementation)
    await page.waitForTimeout(500); // Allow for chart transition
  });

  test('opens AI assistant panel', async ({ page }) => {
    // Click AI assistant button
    await page.click('[data-testid="ai-assistant-button"]');
    
    // Check panel is open
    await expect(page.locator('[data-testid="ai-assistant-panel"]')).toBeVisible();
    await expect(page.locator('text=AI Assistant')).toBeVisible();
    
    // Check input field
    await expect(page.locator('[data-testid="ai-input"]')).toBeVisible();
    await expect(page.locator('[data-voice-button]')).toBeVisible();
  });

  test('sends message to AI assistant', async ({ page }) => {
    // Mock AI chat API
    await page.route('**/api/ai/chat', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: 'I can help you analyze train conflicts and optimize routes.',
        }),
      });
    });

    // Open AI assistant
    await page.click('[data-testid="ai-assistant-button"]');
    
    // Type message
    await page.fill('[data-testid="ai-input"]', 'Show me current conflicts');
    
    // Send message
    await page.click('button:has-text("Send")');
    
    // Check response appears
    await expect(page.locator('text=I can help you analyze')).toBeVisible();
  });

  test('navigates with keyboard shortcuts', async ({ page }) => {
    // Test map focus shortcut
    await page.keyboard.press('Control+m');
    
    // Check map is focused (would need specific implementation)
    await expect(page.locator('[data-testid="map-container"]')).toBeFocused();
    
    // Test search shortcut
    await page.keyboard.press('Control+k');
    
    // Check search is focused
    await expect(page.locator('[data-search-input]')).toBeFocused();
  });

  test('toggles dark mode', async ({ page }) => {
    // Check initial theme
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
    
    // Toggle theme (assuming theme toggle button exists)
    await page.click('[data-testid="theme-toggle"]');
    
    // Check theme changed
    await expect(html).toHaveClass(/light/);
  });

  test('displays conflict heatmap', async ({ page }) => {
    // Mock conflict data
    await page.route('**/api/conflicts', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conflicts: [
            {
              id: 'conflict-1',
              location: 'Kanpur Junction',
              severity: 'high',
              trains: ['123', '456'],
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Check heatmap is present
    await expect(page.locator('[data-testid="conflict-heatmap"]')).toBeVisible();
    
    // Check heatmap controls
    await expect(page.locator('[data-testid="time-range-slider"]')).toBeVisible();
    await expect(page.locator('[data-testid="severity-filter"]')).toBeVisible();
  });

  test('exports data', async ({ page }) => {
    // Set up download handler
    const downloadPromise = page.waitForEvent('download');
    
    // Click export button (assuming it exists in energy chart)
    await page.click('[data-testid="export-csv-button"]');
    
    // Wait for download
    const download = await downloadPromise;
    
    // Check download filename
    expect(download.suggestedFilename()).toMatch(/energy-efficiency.*\.csv/);
  });

  test('handles offline mode', async ({ page }) => {
    // Go offline
    await page.context().setOffline(true);
    
    // Reload page
    await page.reload();
    
    // Check offline indicator
    await expect(page.locator('text=Offline')).toBeVisible();
    
    // Check cached data is still displayed
    await expect(page.locator('[data-testid="active-trains"]')).toBeVisible();
  });

  test('responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check mobile navigation
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    
    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');
    
    // Check menu items
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Analytics')).toBeVisible();
  });

  test('accessibility compliance', async ({ page }) => {
    // Check skip links
    await page.keyboard.press('Tab');
    await expect(page.locator('text=Skip to main content')).toBeVisible();
    
    // Check ARIA labels
    await expect(page.locator('[aria-label="Main navigation"]')).toBeVisible();
    await expect(page.locator('[aria-label="Search trains"]')).toBeVisible();
    
    // Check focus indicators
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveCSS('outline', /.*solid.*/);
  });
});
