import { test, expect } from '@playwright/test'

test('page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Overlay & Clash Check')).toBeVisible()
})
