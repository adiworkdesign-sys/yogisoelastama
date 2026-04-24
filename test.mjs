import { chromium } from "playwright";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:5174/");
  await page.waitForLoadState("networkidle");
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(1000);
  await page.click('img[alt="LDR Scream of Tyrannosaurus"]');
  await page.waitForTimeout(2500);
  const styles = await page.evaluate(() => {
    const rootDiv = document.querySelector("#root > div > div > div");
    return {
      body: document.body.style.cssText,
      html: document.documentElement.style.cssText,
      motionDiv: rootDiv ? rootDiv.style.cssText : "not found",
      routeContainer: rootDiv ? rootDiv.parentElement.style.cssText : "not found"
    };
  });
  console.log(JSON.stringify(styles, null, 2));
  await browser.close();
})();
