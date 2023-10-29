import fs from 'node:fs/promises'
import dotenv from 'dotenv'

dotenv.config()

const common = {
  MONGODUMP_PATH: process.env.MONGODUMP_PATH || '/usr/bin/mongodump',
  ARCHIVER_PATH: process.env.ARCHIVER_PATH || '/usr/bin/7z', // 7z
  COMPRESSION_LEVEL: process.env.COMPRESSION_LEVEL || 3, // 0-copy, 1 fastest, 5 normal, 9 max
  COMPRESSION_THREADS: process.env.COMPRESSION_THREADS || 1
}

const configFiles = await fs.readdir('./projects')

const projectConfigs = {}

const requiredFields = ['STATUS', 'CRON', 'DB_URI', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY']

for (const file of configFiles) {
  if (file === 'example.js') continue

  const project = file.split('.')[0]

  const module = await import(`../projects/${file}`)
  if (!module.default) {
    console.log(`\x1b[31m[WARNING] ${file} has no default export\x1b[0m`)
    continue
  }

  const config = module.default

  let hasMissingField = false
  for (const field of requiredFields) {
    if (!config[field]) {
      hasMissingField = true
      console.log(`\x1b[31m[WARNING] ${file} is missing ${field}\x1b[0m`)
    }
  }

  if (hasMissingField) continue

  config.NAME = project
  projectConfigs[project] = config
}

const settings = {
  common,
  projectConfigs
}

export default settings
