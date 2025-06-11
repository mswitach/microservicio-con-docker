const { chromium } = require('playwright');
require('dotenv').config();

const email = process.env.BLOCKINAR_EMAIL;
const password = process.env.BLOCKINAR_PASSWORD;

if (!email || !password) {
  console.error('❌ Faltan BLOCKINAR_EMAIL o BLOCKINAR_PASSWORD en el entorno');
  process.exit(1);
}

const scrapeAssets = async (assetUrls, jobId, jobs) => {
  console.log(`🔄 Iniciando scraping con jobId: ${jobId}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  try {
    console.log('🔐 Navegando al login...');
    await page.goto('https://blockinar.io/sign-in', { waitUntil: 'load', timeout: 60000 });

    await page.click('text="Sign in with email"');
    await page.fill('input[type="email"]', email);
    console.log('📧 Escribiendo email...');
    await page.click('text="NEXT"');
    await page.waitForTimeout(800);

    await page.fill('input[type="password"]', password);
    console.log('🔒 Escribiendo password...');
    await page.click('text="SIGN IN"');

    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 });
    console.log('✅ Login completado correctamente');

    for (const url of assetUrls) {
      console.log(`🌐 Accediendo a asset: ${url}`);
      const assetPage = await browser.newPage();

      try {
        await assetPage.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await assetPage.waitForTimeout(3000); // espera para garantizar carga completa

        const isLoggedIn = await assetPage.$('.gateway-title');
        if (!isLoggedIn) {
          throw new Error('⚠️ Parece que la sesión expiró o no hay login válido');
        }

        const value = await assetPage.$eval('.cartridge-card span.value', el => el.textContent.trim());
        results.push({ url, value });

        await assetPage.close();
      } catch (err) {
        console.error(`❌ Error en ${url}: ${err.message}`);
        results.push({ url, error: err.message });
        await assetPage.close();
      }
    }

    jobs[jobId] = { status: 'complete', data: results };
  } catch (err) {
    console.error(`❌ Error general en el scraping: ${err.message}`);
    jobs[jobId] = { status: 'error', error: err.message };
  } finally {
    await browser.close();
  }
};

module.exports = { scrapeAssets };

