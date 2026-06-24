#!/usr/bin/env node
import { randomBytes, randomUUID, createHmac, scryptSync } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import pg from 'pg'

import { loadEnvFiles } from './load-env.mjs'

const { Pool } = pg

const DEFAULT_DATABASE_URL = 'postgres://localhost:5432/ap_euro'
const ACCESS_CODE_SCRYPT_N = 16_384
const ACCESS_CODE_SCRYPT_R = 8
const ACCESS_CODE_SCRYPT_P = 1
const ACCESS_CODE_KEYLEN = 32
const LEGACY_DEV_SECRET = ['dev', 'ap', 'euro', 'session', 'secret'].join('-')
const INSECURE_SECRET_VALUES = new Set([
  LEGACY_DEV_SECRET,
  'replace-with-random-session-secret',
])

loadEnvFiles()

function parseArgs(argv) {
  const result = { name: null, code: null, prefix: 'EURO' }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--name') result.name = argv[++i] ?? null
    else if (arg === '--code') result.code = argv[++i] ?? null
    else if (arg === '--prefix') result.prefix = argv[++i] ?? 'EURO'
  }
  return result
}

function normalizeAccessCode(code) {
  return code.normalize('NFKC').trim()
}

function allowsDevSecretFallback() {
  return process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production'
}

function secret() {
  const value = process.env.SESSION_SECRET?.trim()
  if (value && (allowsDevSecretFallback() || !INSECURE_SECRET_VALUES.has(value))) {
    return value
  }
  if (allowsDevSecretFallback()) {
    return LEGACY_DEV_SECRET
  }
  throw new Error('SESSION_SECRET is required outside development.')
}

function lookupSecret() {
  return process.env.ACCESS_CODE_LOOKUP_SECRET ?? secret()
}

function accessCodeLookup(code) {
  return createHmac('sha256', lookupSecret())
    .update(`ap-euro-access-code:v1:${normalizeAccessCode(code)}`)
    .digest('hex')
}

function hashAccessCode(code) {
  const salt = randomBytes(16).toString('base64url')
  const key = scryptSync(normalizeAccessCode(code), salt, ACCESS_CODE_KEYLEN, {
    N: ACCESS_CODE_SCRYPT_N,
    r: ACCESS_CODE_SCRYPT_R,
    p: ACCESS_CODE_SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  })
  return `scrypt:v1:${ACCESS_CODE_SCRYPT_N}:${ACCESS_CODE_SCRYPT_R}:${ACCESS_CODE_SCRYPT_P}:${salt}:${key.toString('base64url')}`
}

function generateAccessCode(prefix) {
  const body = randomBytes(8).toString('base64url').replace(/[-_]/g, '').slice(0, 10).toUpperCase()
  return `${prefix}-${body.slice(0, 5)}-${body.slice(5)}`
}

const args = parseArgs(process.argv.slice(2))
const accessCode = args.code ?? generateAccessCode(args.prefix)
const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? DEFAULT_DATABASE_URL })

try {
  const schema = await readFile(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8')
  await pool.query(schema)
  const id = randomUUID()
  await pool.query(
    `INSERT INTO students (id, access_code_lookup, access_code_hash, display_name)
     VALUES ($1, $2, $3, $4)`,
    [id, accessCodeLookup(accessCode), hashAccessCode(accessCode), args.name],
  )
  console.log(`student_id=${id}`)
  console.log(`display_name=${args.name ?? ''}`)
  console.log(`access_code=${accessCode}`)
} finally {
  await pool.end()
}
