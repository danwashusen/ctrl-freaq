#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import path from 'node:path'

const distDir = path.resolve(process.cwd(), 'dist', 'assets')
const budgets = {
  maxEntryKB: 250, // total for entry chunk
  maxChunkKB: 200, // per-chunk
}

function toKB(bytes) {
  return Math.round((bytes / 1024) * 10) / 10
}

async function main() {
  try {
    const files = await fs.readdir(distDir)
    const jsFiles = files.filter(f => f.endsWith('.js'))
    if (jsFiles.length === 0) {
      console.error(`No JS assets found in ${distDir}. Build first.`)
      process.exit(2)
    }

    let totalEntry = 0
    let failures = []

    for (const file of jsFiles) {
      const stat = await fs.stat(path.join(distDir, file))
      const sizeKB = toKB(stat.size)
      const isEntry = /entry|main|app/i.test(file)
      if (isEntry) totalEntry += stat.size
      if (sizeKB > budgets.maxChunkKB) {
        failures.push(`${file} exceeds per-chunk budget: ${sizeKB}KB > ${budgets.maxChunkKB}KB`)
      }
    }

    const totalEntryKB = toKB(totalEntry)
    if (totalEntryKB > budgets.maxEntryKB) {
      failures.push(`Entry total exceeds budget: ${totalEntryKB}KB > ${budgets.maxEntryKB}KB`)
    }

    if (failures.length > 0) {
      console.error('Bundle budget check failed:')
      failures.forEach(f => console.error(' -', f))
      process.exit(1)
    }

    console.log('Bundle budgets OK')
  } catch (err) {
    console.error('Bundle check error:', err?.message || err)
    process.exit(2)
  }
}

main()

