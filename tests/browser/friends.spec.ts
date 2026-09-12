import { test, expect } from '@playwright/test'

/**
 * Friend sharing driven from the browser, which is the GPS source until the
 * native app ships.
 *
 * This is the one check that proves the whole path: a real geolocation fix from
 * the sharer's browser, through the authenticated ingest route, into the
 * friends-only read, onto the other person's screen — and then that it stops
 * being visible when sharing is turned off.
 */
test('a browser shares its location with a friend and stops when asked', async ({ browser }) => {
  const sharer = await browser.newContext({ geolocation: { latitude: 11.1811, longitude: -60.7333, accuracy: 8 }, permissions: ['geolocation'] })
  const friend = await browser.newContext({ geolocation: { latitude: 11.19, longitude: -60.74, accuracy: 8 }, permissions: ['geolocation'] })
  const sharerPage = await sharer.newPage()
  const friendPage = await friend.newPage()

  async function signIn(page: import('@playwright/test').Page, email = 'browser@example.test') {
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill('browser-test-password-12')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  }

  // The sharer signs in and opens the invite dialog to mint a link. The header
  // also has a Sign in link, so scope to the page content.
  await sharerPage.goto('http://127.0.0.1:4173/browser-band/friends')
  await sharerPage.locator('#main-content').getByRole('link', { name: 'Sign in', exact: true }).click()
  await signIn(sharerPage)
  await expect(sharerPage.getByRole('heading', { name: 'Find your friends' })).toBeVisible()
  await sharerPage.getByRole('button', { name: 'Create an invite link' }).click()
  const inviteUrl = await sharerPage.locator('p.break-all').first().innerText()

  // A second person accepts it, which is their explicit consent to connect.
  await friendPage.goto(inviteUrl.trim())
  await friendPage.locator('#main-content').getByRole('link', { name: 'Sign in', exact: true }).click()
  await signIn(friendPage, 'friend@example.test')
  await expect(friendPage.getByRole('heading', { name: 'Friend invite' })).toBeVisible()
  await friendPage.getByRole('button', { name: 'Accept invite' }).click()
  await expect(friendPage.getByRole('heading', { name: 'Friend invite' })).toHaveCount(0)

  // Pressing start is the only thing that makes the sharer visible.
  await sharerPage.getByRole('button', { name: 'Start sharing' }).click()
  await expect(sharerPage.getByText('Sharing with your friends')).toBeVisible()
  await expect(sharerPage.getByText('Last sent at', { exact: false })).toBeVisible({ timeout: 20000 })

  // The friend sees a live pin, described as coming from a browser rather than
  // claiming a motion state the browser cannot actually report.
  await expect(friendPage.getByText('Live · updated', { exact: false })).toBeVisible({ timeout: 20000 })
  await expect(friendPage.getByRole('img', { name: 'Friends map' })).toBeVisible()

  await friendPage.screenshot({ path: 'test-results/friends-friend-view.png', fullPage: true })

  // Stopping sharing must remove the pin, not leave a stale one behind.
  await sharerPage.getByRole('button', { name: 'Stop sharing' }).click()
  await expect(friendPage.getByText('Not sharing right now')).toBeVisible({ timeout: 20000 })

  await sharer.close()
  await friend.close()
})
