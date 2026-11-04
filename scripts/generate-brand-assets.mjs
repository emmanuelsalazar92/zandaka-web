/* Run explicitly after editing public/brand/zandaka-mark.svg. No build-time work. */
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { chromium } from "@playwright/test"

async function generate() {
  const root = fileURLToPath(new URL("../", import.meta.url))
  const svg = await fs.readFile(path.join(root, "public/brand/zandaka-mark.svg"), "utf8")
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ deviceScaleFactor: 1 })
    await context.route("**/*", (route) => route.abort())
    const page = await context.newPage()
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`,
    )
    const raster = async (size) => {
      await page.setViewportSize({ width: size, height: size })
      return page.screenshot({ omitBackground: true })
    }
    const symbol = await page.locator("svg").evaluate((source) => {
      const copy = source.cloneNode(true)
      copy.querySelector("rect").remove()
      copy.setAttribute("fill", "currentColor")
      for (const plane of copy.querySelectorAll("path")) plane.removeAttribute("fill")
      return copy.outerHTML
        .split("\n")
        .filter((line) => line.trim())
        .join("\n")
    })
    await fs.writeFile(path.join(root, "public/brand/zandaka-symbol.svg"), symbol + "\n")
    const sizes = [16, 32, 48, 64]
    const images = []
    for (const size of sizes) images.push(await raster(size))
    const directory = Buffer.alloc(6 + sizes.length * 16)
    directory.writeUInt16LE(1, 2)
    directory.writeUInt16LE(sizes.length, 4)
    let offset = directory.length
    images.forEach((image, index) => {
      const start = 6 + index * 16
      directory[start] = directory[start + 1] = sizes[index]
      directory.writeUInt16LE(1, start + 4)
      directory.writeUInt16LE(32, start + 6)
      directory.writeUInt32LE(image.length, start + 8)
      directory.writeUInt32LE(offset, start + 12)
      offset += image.length
    })
    await fs.writeFile(path.join(root, "app/favicon.ico"), Buffer.concat([directory, ...images]))
    // iOS touch icons require an opaque background and no pre-rounded corners.
    await page.setContent(
      `<style>html,body{margin:0;background:#245bdb}svg{display:block;width:100%;height:100%}rect{rx:0}</style>${svg}`,
    )
    await fs.writeFile(path.join(root, "app/apple-icon.png"), await raster(180))
    await fs.writeFile(path.join(root, "app/icon.svg"), svg)
    console.log("Updated symbol.svg, favicon.ico (16/32/48/64), icon.svg and apple-icon.png (180).")
  } finally {
    await browser.close()
  }
}

generate().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
