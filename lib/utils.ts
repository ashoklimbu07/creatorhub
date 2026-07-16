import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number | bigint): string {
  const value = Number(bytes)
  if (value <= 0) return "0 B"

  const units = ["B", "KB", "MB", "GB"]
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  )
  const size = value / 1024 ** exponent

  return `${exponent === 0 ? size : size.toFixed(1)} ${units[exponent]}`
}
