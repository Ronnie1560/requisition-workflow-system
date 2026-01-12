import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

/**
 * Authentication State Setup
 * Creates authenticated state for tests that need logged-in user
 */

const authFile = path.join(__dirname, '../.auth/user.json')

// Test credentials - replace with actual test account
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || 'test@example.com'
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || 'testpassword123'

setup('authenticate', async ({ page }) => {
  // Skip auth setup if no credentials provided
  if (!process.env.PLAYWRIGHT_TEST_EMAIL) {
    console.log('Skipping auth setup - no test credentials provided')
    return
  }

  // Navigate to login
  await page.goto('/')
  
  // Wait for login form
  await page.waitForSelector('form', { timeout: 10000 })
  
  // Fill credentials
  const emailInput = page.locator('input[type="email"], input[name="email"]').first()
  const passwordInput = page.locator('input[type="password"]').first()
  
  await emailInput.fill(TEST_EMAIL)
  await passwordInput.fill(TEST_PASSWORD)
  
  // Submit
  await page.locator('button[type="submit"]').click()
  
  // Wait for redirect to dashboard or main app
  await page.waitForURL(/\/(dashboard|requisitions|home)/, { timeout: 30000 })
  
  // Ensure auth directory exists
  const authDir = path.dirname(authFile)
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }
  
  // Save signed-in state
  await page.context().storageState({ path: authFile })
})
