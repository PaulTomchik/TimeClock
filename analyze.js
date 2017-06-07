#!/usr/bin/env node
console.log('!!!BROKEN CODE!!! Work on it if you wish.')

const fs = require('fs')
const path = require('path')
const readline = require('readline');

const mkdirp = require('mkdirp')
const moment = require('moment')
const minimist = require('minimist')

const RAW_DATA_DIR = path.join(__dirname, 'data/raw')
const SMOOTHED_DATA_DIR = path.join(__dirname, 'data/smoothed')

mkdirp.sync(RAW_DATA_DIR)
mkdirp.sync(SMOOTHED_DATA_DIR)

const DATE_FORMAT = 'YYYYMMDD'
const TIME_FORMAT = 'HH:mm:ss'
const IN = 'IN'
const OUT = 'OUT'


const rawTimesheets = fs.readdirSync(RAW_DATA_DIR)
                        .filter(f => f.match(/.json$/))
                        .map(f => f.replace(/.json$/, ''))
                        .sort()


if (!rawTimesheets.length) {
  console.log('The raw timesheets directory is empty.')
  process.exit(0)
}


const keyWidth = Math.floor(Math.log10(rawTimesheets.length)) + 1
let padding = ''
for (let i = 1; i < keyWidth; ++i) {
  padding = ` ${padding}`
}

console.log('Select a timesheet to process\n')
for (let i = 0; i < rawTimesheets.length; ++i) {
  const k = `${padding}${i+1}`.slice(-1 * keyWidth)
  console.log(`  ${k}: ${rawTimesheets[i]}`)
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


rl.question(`[default: ${rawTimesheets.length}]: ` , (tsIdx) => {

  tsIdx = tsIdx ? tsIdx.trim() : rawTimesheets.length

  let selectedTimesheet = rawTimesheets[tsIdx - 1]

  if (!selectedTimesheet) {
    console.error(`Invalid input: ${tsIdx}`)
    process.exit(1)
  }

  rl.close();
  console.log('selectedTimesheet: ', selectedTimesheet)
  _analyzeTimesheet(selectedTimesheet)
});


function _analyzeTimesheet (selectedTimesheet) {
  const tsPath = path.join(RAW_DATA_DIR, `${selectedTimesheet}.json`)
  const timesheet = JSON.parse(fs.readFileSync(tsPath))

  const startDate = selectedTimesheet.split('-')[0]
  const partitionDate = moment(startDate).endOf('week')

  let dates = Object.keys(timesheet).sort()

  let d = [{
    total_hours: 0
  }]

  let accumulatedFlex = 0
  let totalHoursWorked = 0

  let curWeek = d[0]

  for (let i = 0; i < dates.length; ++i) {
    const date = dates[i]
    const curDay = moment(date)

    if (curDay.isAfter(partitionDate)) {
      curWeek = d[1] = (d[1] || { total_hours: 0 })
    }

    try {
      const { roundedTimeSheet, flex, hoursWorked } = _analyzeDay(date, timesheet[date], accumulatedFlex)
      accumulatedFlex = flex
      curWeek[date] = roundedTimeSheet
      curWeek.total_hours += hoursWorked
    } catch (err) {
      console.error(err.message)
      process.exit(1)
    }
  }

  console.log(JSON.stringify(d, null, 4))
  console.log('accumulatedFlex:', accumulatedFlex)
  console.log('totalHoursWorked:', totalHoursWorked)
}

function _analyzeDay (date, timesheetForDay, flex) {
  const times = Object.keys(timesheetForDay).sort()

  const order = [IN, OUT]

  const roundedTimeSheet = {}

  let hoursWorked = 0

  let inTime = null

  for (let i = 0; i < times.length; ++i) {
    const t = times[i]
    const exactTime = moment(`${date}:${t}`, 'YYYYMMDD:HH:mm:ss')

    const punchMode = timesheetForDay[t]
    if (punchMode !== order[i%2]) {
      throw new Error(
        `Error processing date: ${date}\n\tIN/OUT punch invariant broken for time: ${t}`
      )
    }

    const min = Math.floor(exactTime.minutes() / 15) * 15

    let roundedTime = moment(exactTime).minutes(min).seconds(0)

    if (roundedTime.isSameOrBefore(inTime)) {
      roundedTime = inTime
    }

    const diff = exactTime.diff(roundedTime, 'minutes', true)

    if (diff <= flex) {
      flex -= diff
      roundedTime.add(15, 'minutes') 
    } else {
      flex += diff
    }

    if (punchMode === OUT) {
      hoursWorked += roundedTime.diff(inTime, 'hours', true)
      console.log('hoursWorked:', hoursWorked)
    } else {
      inTime = roundedTime
    }

    roundedTimeSheet[roundedTime.format(TIME_FORMAT)] = punchMode
  }

  roundedTimeSheet.accumulatedFlex = flex
  roundedTimeSheet.hoursWorked = hoursWorked

  return { roundedTimeSheet, flex, hoursWorked }
}

