import { spawnSync } from 'node:child_process'
import fse from 'fs-extra'
import { S3 } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import nodeSchedule from 'node-schedule'

import settings from './config/settings.js'

console.log('[mongodb-backups] process started...')

if (!Object.keys(settings.projectConfigs).length) {
  console.log('\x1b[31m[mongodb-backups] no projects for backup found!\x1b[0m')
  process.exit(0)
}

for (const [project, config] of Object.entries(settings.projectConfigs)) {
  if (config.STATUS === 'enabled') {
    nodeSchedule.scheduleJob(project, config.CRON, async () => {
      console.log(`\x1b[32m[mongodb-backups] starting the backup process for ${config.NAME}...\x1b[0m`)

      await backup({
        common: settings.common,
        projectConfig: config
      })
        .then(() => {
          console.log(`\x1b[32m[mongodb-backups] ${config.NAME} backup completed successfully!\x1b[0m`)
          printSchedule()
        })
        .catch((error) => {
          console.log(`\x1b[32m[mongodb-backups] ${config.NAME} backup error: \x1b[0m`)
          console.error(error.message)
        })
    })
  }
}

printSchedule()

async function backup(settings) {
  const projectName = settings.projectConfig.NAME

  const mongoDumpCommand = `${settings.common.MONGODUMP_PATH} --uri="${settings.projectConfig.DB_URI}" --out="mongoDumpFolder"`
  execute(mongoDumpCommand, `[mongodb-backups] [${projectName}] dumping`)
  const fileName = `${settings.projectConfig.NAME}-${getCurrentTime()}.7z`
  const localFilePath = `./backups/${fileName}`
  const archiveCommand = `${settings.common.ARCHIVER_PATH} a -t7z -mx=${settings.common.COMPRESSION_LEVEL} -mmt=${settings.common.COMPRESSION_THREADS} ${localFilePath} mongoDumpFolder`
  execute(archiveCommand, `[mongodb-backups] [${projectName}] compressing`)

  console.log(`[mongodb-backups] [${projectName}] removing dump dir...`)
  await fse.remove('./mongoDumpFolder')
  console.log(`[mongodb-backups] [${projectName}] reading file...`)

  console.log(`[mongodb-backups] [${projectName}] uploading...`)
  const buffer = await fse.readFile(localFilePath)
  const location = await upload(buffer, `databaseBackups/${fileName}`, settings)
  console.log(`[mongodb-backups] [${projectName}] uploaded completed! ${location}`)

  if (settings.projectConfig.DELETE_LOCAL_COPY) {
    console.log(`[mongodb-backups] [${projectName}] removing local copy...`)
    await fse.remove(localFilePath)
    console.log(`[mongodb-backups] [${projectName}] local copy removed!`)
  }
}

async function upload(buffer, savePath, settings) {
  const s3 = new S3({
    region: settings.projectConfig.S3_REGION,
    credentials: {
      accessKeyId: settings.projectConfig.S3_ACCESS_KEY,
      secretAccessKey: settings.projectConfig.S3_SECRET_KEY
    }
  })

  const params = {
    Bucket: settings.projectConfig.S3_BUCKET,
    Key: savePath,
    Body: buffer,
    ContentType: 'application/x-7z-compressed',
    ACL: 'private'
  }

  const uploadedFile = await new Upload({
    client: s3,
    params
  }).done()

  return uploadedFile.Location
}

async function execute(command, description) {
  console.log(`${description} started...`)
  const commandExecute = spawnSync(command, [], { shell: true })
  const commandOutput = commandExecute.output.toString('utf8')
  if (commandExecute.status === 0) {
    // console.log(commandOutput)
    console.log(description, 'ended')
    return
  }

  console.log(commandOutput) // show output only in case of error
  console.error(description, 'failed')
  throw new Error(commandOutput)
}

function printSchedule() {
  console.log(`[mongodb-backups] Schedule:`)
  for (const job of Object.values(nodeSchedule.scheduledJobs)) {
    console.log(`\x1b[34m[mongodb-backups] ${job.name} backup is scheduled for ${job.nextInvocation()}\x1b[0m`)
  }
}

function getCurrentTime() {
  const date = new Date()
  const day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate()
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = date.getSeconds()

  return `${day}-${month}-${year}_${hours}-${minutes}-${seconds}Z`
}
