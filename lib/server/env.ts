import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

let loaded = false

function stripInlineComment(value: string): string {
  let quote: '"' | "'" | null = null
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    if ((char === '"' || char === "'") && value[i - 1] !== '\\') {
      quote = quote === char ? null : quote ?? char
    }
    if (char === '#' && quote === null) {
      return value.slice(0, i).trimEnd()
    }
  }
  return value
}

function unquote(value: string): string {
  const trimmed = stripInlineComment(value).trim()
  const first = trimmed[0]
  const last = trimmed[trimmed.length - 1]
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

const ENV_FILE_PATHS = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '.env.local'),
]

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return

  const contents = readFileSync(filePath, 'utf8')
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const normalized = line.startsWith('export ') ? line.slice('export '.length).trimStart() : line
    const separator = normalized.indexOf('=')
    if (separator <= 0) continue

    const key = normalized.slice(0, separator).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue

    process.env[key] = unquote(normalized.slice(separator + 1))
  }
}

export function loadEnvFiles(): void {
  if (loaded) return
  loaded = true
  for (const filePath of ENV_FILE_PATHS) {
    loadEnvFile(filePath)
  }
}
