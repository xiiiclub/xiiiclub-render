import express from "express";
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const app = express();
const PORT = process.env.PORT || 3000;

// Load font as base64 so we can embed it in HTML (no external hosting needed)
const fontPath = path.join(process.cwd(), "fonts", "Picaflor-48pt.otf");
const fontBase64 = fs.readFileSync(fontPath).toString("base64");

function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Render transparent PNG 1080x1920 with centered text
app.get("/render", async (req, res) => {
  try {
    const textRaw = (req.query.text || "").toString();
    if (!textRaw.trim()) {
      return res.status(400).send("Missing ?text=");
    }

    // Keep it simple: uppercase on server side
    const text = escapeHtml(textRaw.toUpperCase());

    // Tweak these to taste
    const fontSize = 60;      // base size
    const maxWidth = 900;      // wrap width
    const lineHeight = 1.05;   // tighter luxury vibe

    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: "Picaflor";
    src: url(data:font/otf;base64,${fontBase64}) format("opentype");
    font-display: swap;
  }
  html, body {
    margin: 0;
    padding: 0;
    width: 1080px;
    height: 1920px;
    background: transparent;
  }
  .wrap {
    width: 1080px;
    height: 1920px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .text {
    font-family: "Picaflor", Arial, sans-serif;
    font-size: ${fontSize}px;
    line-height: ${lineHeight};
    color: #ffffff;
    text-align: center;
    width: ${maxWidth}px;
    word-wrap: break-word;
    white-space: pre-wrap;
    text-transform: uppercase;
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="text">${text}</div>
  </div>
</body>
</html>`;

    const browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 2
    });

    await page.setContent(html, { waitUntil: "networkidle" });

    // Screenshot full page with transparent background
    const png = await page.screenshot({ type: "png", fullPage: true, omitBackground: true });

    await browser.close();

    res.setHeader("Content-Type", "image/png");
    res.send(png);
  } catch (e) {
    console.error(e);
    res.status(500).send("Render failed");
  }
});

app.get("/", (_, res) => res.send("OK - use /render?text=..."));

app.listen(PORT, () => console.log(`Render server running on :${PORT}`));
