const { chromium } = require("playwright");
require("dotenv").config();

const assetUrls = [
  "https://blockinar.io/things/asset-info?core_id=Qqkw4QTHKXA03PhfuiHI&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=LBOxYd3kwznY1S0YszF7&tab=dashboard",
  "https://blockinar.io/things/asset-info?core_id=WSSW6biSLwfDhXsxpYlY&tab=dashboard"
];

const login = async (page) => {
  console.log("🔐 Iniciando login...");
  await page.goto("https://blockinar.io/auth/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByText("Sign in with email", { exact: true }).click();
  await page.locator('input[type="email"]').fill(process.env.BLOCKINAR_EMAIL);
  await page.getByRole("button", { name: "NEXT" }).click();
  await page.locator('input[type="password"]').fill(process.env.BLOCKINAR_PASSWORD);
  await page.getByRole("button", { name: "SIGN IN" }).click();
  await page.waitForSelector("div.total-number span", { timeout: 60000 });
  console.log("✅ Login exitoso");
};

const scrapeAsset = async (page, url) => {
  console.log(`🌐 Accediendo a asset: ${url}`);
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (["image", "stylesheet", "font", "media"].includes(type)) route.abort();
    else route.continue();
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".cartridge-card", { timeout: 60000 });

  return page.evaluate(() => {
    const record = {};
    const name = document.querySelector(".gateway-title")?.innerText?.trim();
    if (name) record.assetName = name;

    const location = document.querySelector(".asset-info-container .layout-route")?.innerText?.trim();
    if (location) record.cartridgeLocation = location;

    const spans = Array.from(document.querySelectorAll("span"))
      .filter(s => s.innerText?.startsWith("Serial Number:"));
    if (spans.length >= 2) {
      record.serialNumber = spans[1].innerText.replace("Serial Number:", "").trim().replace(/"/g, "");
    }

    const cards = document.querySelectorAll(".cartridge-card");
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
  console.log("🚀 Iniciando scraping liviano (3 assets)");
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
      console.log(`✅ Scrap exitoso: ${data.assetName}`);
      if (data["EFFECTIVE TESTS"]) results.push(data);
    } catch (err) {
      console.error(`❌ Error scrapeando ${url}: ${err.message}`);
    } finally {
      await assetPage.close();
    }

    // Pequeña pausa para liberar memoria
    await new Promise(r => setTimeout(r, 1000));
  }

  await context.close();
  await browser.close();

  console.log("✅ Scraping completado, enviando respuesta JSON");
  return results;
};

module.exports = { scrapeGem5k };

