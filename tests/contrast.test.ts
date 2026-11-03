import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const css = readFileSync(path.resolve("app/globals.css"), "utf8")
const rgb = (hex: string) =>
  hex
    .replace("#", "")
    .match(/../g)!
    .map((value) => parseInt(value, 16) / 255)
const luminance = (values: number[]) =>
  values
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0)
const contrast = (a: number[], b: number[]) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
const blend = (a: number[], b: number[], opacity: number) =>
  a.map((value, index) => opacity * value + (1 - opacity) * b[index])

describe("Atlántico readable financial tokens", () => {
  for (const theme of ["light", "dark"]) {
    it(`${theme}: financial text and filled controls preserve AA contrast, including tinted and hover backgrounds`, () => {
      const block =
        theme === "light" ? css.split(".dark {")[0] : css.split(".dark {")[1].split("@theme")[0]
      const tokens = Object.fromEntries(
        [...block.matchAll(/--([a-z-]+): (#[0-9a-f]{6});/g)].map((match) => [
          match[1],
          rgb(match[2]),
        ]),
      )
      for (const surface of ["card", "background", "popover"]) {
        for (const color of ["success", "warning", "error"]) {
          for (const tint of [0, 0.1, 0.2]) {
            expect(
              contrast(tokens[color], blend(tokens[color], tokens[surface], tint)),
              `${color} on ${surface}, tint ${tint}`,
            ).toBeGreaterThanOrEqual(4.5)
          }
        }
        for (const color of ["primary", "destructive"]) {
          for (const opacity of [1, 0.9])
            expect(
              contrast(
                tokens[color + "-foreground"],
                blend(tokens[color], tokens[surface], opacity),
              ),
              `${color} filled/hover`,
            ).toBeGreaterThanOrEqual(4.5)
        }
      }
      // A blended gradient stays inside its stop colors; verify caption contrast against all stops.
      for (const stop of ["#102b57", "#1c49b1", "#245bdb", "#0d657d"])
        expect(contrast(rgb("#e3edff"), rgb(stop))).toBeGreaterThanOrEqual(4.5)
    })
  }
})
