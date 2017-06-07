#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const mkdirp = require('mkdirp')
const moment = require('moment')
const minimist = require('minimist')

const DATA_DIR = path.join(__dirname, 'data/raw')
mkdirp.sync(DATA_DIR)

const DATE_FORMAT = 'YYYYMMDD'
const TIME_FORMAT = 'HH:mm:ss'
const IN = 'IN'
const OUT = 'OUT'


const argvCaseSensitive = minimist(process.argv.slice(2))

const argv = Object.keys(argvCaseSensitive).reduce((acc, k) => {
  acc[k.toUpperCase()] = argvCaseSensitive[k]
  return acc
}, {})

const punchMode = argv[IN]
  ? IN
  : argv[OUT]
    ? OUT
    : null;

if (!punchMode) {
  console.error('Provide either --IN or --OUT as an commandline argument')
  process.exit(1)
}


const now = moment()

const basePayPeriodStart = moment('20170107')

const weeksDiff = now.diff(basePayPeriodStart, 'weeks')

const curPayPeriodStart = moment().startOf('week')

if (weeksDiff % 2) {
  curPayPeriodStart.subtract(1, 'week')  
}

const curPayPeriodEnd = moment(curPayPeriodStart).endOf('week').add(1, 'weeks')

const timesheetName =
        `${curPayPeriodStart.format(DATE_FORMAT)}-${curPayPeriodEnd.format(DATE_FORMAT)}`

const timesheetFilePath = path.join(DATA_DIR, `${timesheetName}.json`)


const curDate = now.format(DATE_FORMAT)
const curTime = now.format(TIME_FORMAT)

const weeklyTimesheet = fs.existsSync(timesheetFilePath)
                          ? JSON.parse(fs.readFileSync(timesheetFilePath))
                          : {}

const dayInfo = (weeklyTimesheet[curDate] || (weeklyTimesheet[curDate] = {}));

dayInfo[curTime] = punchMode

fs.writeFileSync(timesheetFilePath, JSON.stringify(weeklyTimesheet, null, 4) + '\n')
