import { ASPECT_RATIOS, type AspectRatio } from "@/lib/validations/platform-settings"

const RATIO_VALUES: Record<AspectRatio, number> = {
  "9:16": 9 / 16,
  "1:1": 1,
  "4:5": 4 / 5,
  "16:9": 16 / 9,
}

// Real-world exports are rarely exact pixel ratios (e.g. 1080x1919), so match
// within a small tolerance. We don't crop/convert video, so a source that
// doesn't cleanly match any known label is left unmatched (null) rather than
// guessed at — the UI then flags every option as unsupported for it.
const TOLERANCE = 0.03

export function matchAspectRatio(width: number, height: number): AspectRatio | null {
  if (!width || !height) return null
  const value = width / height

  for (const ratio of ASPECT_RATIOS) {
    if (Math.abs(value - RATIO_VALUES[ratio]) / RATIO_VALUES[ratio] <= TOLERANCE) {
      return ratio
    }
  }

  return null
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

export function formatRawRatio(width: number, height: number): string {
  const divisor = gcd(width, height) || 1
  return `${width / divisor}:${height / divisor}`
}
