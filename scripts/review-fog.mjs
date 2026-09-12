import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
const origin = process.env.REVIEW_ORIGIN ?? 'https://windies-truck-tracker.web.app'
const prefix = process.env.REVIEW_PREFIX ?? 'before'
const browser = await chromium.launch()
const report=[]
for(const [size,width,height] of [['mobile',390,844],['desktop',1440,1000]]) {
 const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1})
 if (process.env.REVIEW_API_ORIGIN) await page.route('**/api/**', async route => {
   const url = new URL(route.request().url())
   const response = await route.fetch({url:process.env.REVIEW_API_ORIGIN + url.pathname + url.search})
   await route.fulfill({response})
 })
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 for(const [name,path] of [['tracker','/fog-angels'],['photos','/fog-angels/photos'],['guide','/fog-angels/guide'],['updates','/fog-angels/updates']]) {
  await page.goto(origin+path,{waitUntil:'domcontentloaded'})
  await page.locator('h1').waitFor({timeout:20000})
  if (name === 'tracker') await page.getByRole('heading', {name:/Meeting reference/}).waitFor({timeout:20000})
  if (name === 'tracker') await page.locator('.maplibregl-canvas').waitFor({timeout:20000})
  if (name === 'guide') await page.getByText('Fantasy Island 2026',{exact:true}).waitFor({timeout:20000})
  if (name === 'updates') await page.getByRole('heading',{name:'Welcome to Fantasy Island'}).waitFor({timeout:20000})
  await page.locator('img').evaluateAll(imgs => Promise.all(imgs.map(i => { i.loading = 'eager'; return i.decode().catch(()=>{}) })))
  if (name === 'tracker') await page.waitForTimeout(15000)
  await page.screenshot({path:`artifacts/site-review/${prefix}-${size}-${name}.png`,fullPage:true,animations:'disabled'})
  report.push({size,name,url:page.url(),headings:await page.locator('h1,h2').allTextContents(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),brokenImages:await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src)),errors:[...errors]})
 }
 await page.close()
}
writeFileSync(`artifacts/site-review/${prefix}-report.json`,JSON.stringify(report,null,2))
console.log(JSON.stringify(report,null,2))
await browser.close()
