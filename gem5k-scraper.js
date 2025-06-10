// gem5k-scraper.js
const { chromium } = require("playwright");
require("dotenv").config();

const assetUrls = [
  "https://blockinar.io/things/asset-info?core_id=Qqkw4QTHKXA03PhfuiHI&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=LBOxYd3kwznY1S0YszF7&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=WSSW6biSLwfDhXsxpYlY&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=lVl6m2JrnjEH4iHlrKXe&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=mqpImzWSxjywdrfhwJWO&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=u2ROFIMf1rGjlyV8oe2O&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=XkWN5oJSSCoTsHDF00OM&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=DD5vUyxAR16rblA2jyk4&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=Xmvx2RkQMHffKhdKmL9W&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=H5YhLrngrHuHIgnp7oUY&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=e3uhXIJ7Ey6zOHsROJBR&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=FMsAQ7qgpQF9CwlwrTMc&tab=dashboard",
];

const login = async (page) => {
  await page.goto("https://blockinar.io/auth/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByText("Sign in with email", { exact: true }).click();
  await page.locator('input[type="email"]').fill(process.env.BLOCKINAR_EMAIL);
  await page.getByRole("button", { name: "NEXT" }).click();
  await page.locator('input[type="password"]').fill(process.env.BLOCKINAR_PASSWORD);
  await page.getByRole("button", { name: "SIGN IN" }).click();
  await page.waitForSelector("div.total-number span", { timeout: 60000 });
};

const scrapeAsset = async (page, url) => {
  await page.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".cartridge-card", { timeout: 60000 });

  return page.evaluate(() => {
    const record = {};
    const name = document.querySelector(".gateway-title")?.innerText?.trim();
    if (name) record.assetName = name;

    const location = document.querySelector(".asset-info-container .layout-route")?.innerText?.trim();
    if (location) record.cartridgeLocation = location;

    const serialSpans = Array.from(document.querySelectorAll("span"))
      .filter((s) => s.innerText?.startsWith("Serial Number:"));
    if (serialSpans.length >= 2) {
      record.serialNumber = serialSpans[1].innerText.replace("Serial Number:", "").trim().replace(/"/g, "");
    }

    const cards = Array.from(document.querySelectorAll(".cartridge-card"));
    cards.forEach((card) => {
      const title = card.querySelector(".cartridge-card-title")?.innerText?.trim();
      const value = card.querySelector(".cartridge-value")?.innerText?.trim();

      if (!title || !value) return;

      if (/EFFECTIVE TESTS|ONBOARD DAYS|ONBOARD STABILITY/.test(title) && /^\d+$/.test(value)) {
        record[title] = value;
      }

      if (title === "LAST INSERTION") {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          const dd = String(date.getDate()).padStart(2, "0");
          const mm = String(date.getMonth() + 1).padStart(2, "0");
          const yyyy = date.getFullYear();
          record["LAST INSERTION"] = `${dd}-${mm}-${yyyy}`;
        }
      }
    });

    return record;
  });
};

const scrapeGem5k = async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page);
  await page.close();

  const results = [];
  for (const url of assetUrls) {
    const assetPage = await context.newPage();
    try {
      const data = await scrapeAsset(assetPage, url);
      if (data["EFFECTIVE TESTS"]) results.push(data);
    } catch (err) {
      console.error(`Error scrapeando ${url}: ${err.message}`);
    } finally {
      await assetPage.close();
    }
  }

  await context.close();
  await browser.close();

  return results;
};

module.exports = { scrapeGem5k };

