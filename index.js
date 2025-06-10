const express = require("express");
const { chromium } = require("playwright");
const { scrapeNuBlog } = require("./nublog-scraper");
const { scrapeGem5k } = require("./gem5k-scraper");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/scrape", async (req, res) => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto("https://jsonplaceholder.typicode.com/todos/1", { waitUntil: "load", timeout: 15000 });
    const jsonText = await page.locator("pre").innerText();
    const data = JSON.parse(jsonText);
    await browser.close();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/scrape-nublog", async (req, res) => {
  try {
    const posts = await scrapeNuBlog();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/scrape-gem5k", async (req, res) => {
  try {
    const data = await scrapeGem5k();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

