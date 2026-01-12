import { test as setup } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

/**
 * Authentication State Setup
 * Creates authenticated state for tests that need logged-in user
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const authFile = path.join(__dirname, '../.auth/user.json')

// Test credentials - replace with actual test account
const TEST_EMAIL = globalThis.process?.env?.PLAYWRIGHT_TEST_EMAIL || 'test@example.com'
const TEST_PASSWORD = globalThis.process?.env?.PLAYWRIGHT_TEST_PASSWORD || 'testpassword123'

setup('authenticate', async ({ page }) => {
  // Skip auth setup if no credentials provided
  if (!globalThis.process?.env?.PLAYWRIGHT_TEST_EMAIL) {
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
