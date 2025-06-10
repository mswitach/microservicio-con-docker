// nublog-scraper.js
const { chromium } = require('playwright');

async function scrapeNuBlog() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://blog.nu.com.mx/', { waitUntil: 'networkidle', timeout: 0 });
  await page.waitForSelector('h3.latest-post-title', { timeout: 60000 });

  const previews = await page.$$eval('h3.latest-post-title', nodes =>
    nodes.slice(0, 4).map(h3 => {
      const anchor = h3.closest('a.latest-post-link');
      return {
        title: h3.innerText.trim(),
        url: anchor ? anchor.href : null
      };
    })
  );

  const posts = [];
  for (const { title, url } of previews) {
    if (!url) continue;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });
    await page.waitForSelector('section.article-content', { timeout: 60000 });

    const content = await page.$$eval('section.article-content p', ps =>
      ps.map(p => p.innerText.trim()).join("\n\n")
    );

    posts.push({ title, url, content });
    await page.waitForTimeout(500);
  }

  await browser.close();
  return posts;
}

module.exports = { scrapeNuBlog };

