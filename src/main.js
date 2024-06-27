const core = require('@actions/core')
const glob = require('@actions/glob')
const fs = require('fs')
const { redos } = require('./redos')

async function getHotspots(diagnostics) {
  let index = 0
  const spots = []
  for (const { start, end, temperature } of diagnostics.hotspot) {
    if (index < start) {
      spots.push(`${diagnostics.source.substring(index, start)}`)
    }
    let openStyle = ''
    let closeStyle = ''
    if (temperature === 'heat') {
      openStyle = `**`
      closeStyle = `**`
    }
    spots.push(
      `${openStyle}${diagnostics.source.substring(start, end)}${closeStyle}`
    )
    index = end
  }
  if (index < diagnostics.source.length) {
    spots.push(`${diagnostics.source.substring(index)}`)
  }
  return `Hotspots detected: "${spots.join('')}"`
}

async function parseDiagnostics(filename, diagnostics) {
  let text = ''
  let comments = ''
  switch (diagnostics.status) {
    case 'vulnerable':
      text = `:bomb: Vulnerable regular expression. Complexity: ${diagnostics.complexity.type}. Attack pattern: **${diagnostics.attack.pattern}**`
      comments = await getHotspots(diagnostics)
      break
    default:
      text = `:question: Unknown regular expression status: ${diagnostics.status}`
      comments = `Error Message: ${diagnostics.error.kind}`
      break
  }
  return [`${filename}`, `${text}`, `${comments}`]
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const files = core.getInput('files')
    core.debug(`Received files glob pattern: ${files}`)
    const globber = glob.create(files)
    const tableData = Array()
    const tableHeader = [
      { data: 'File', header: true },
      { data: 'Diagnostic', header: true },
      { data: 'Comments', header: true }
    ]
    tableData.push([tableHeader])
    for await (const file of (await globber).globGenerator()) {
      const rx = await fs.promises.readFile(file, 'utf8')
      // get flags from file. regular expression to get them: /'^\(\?([dgimsuvy]+)\)'/
      const flags = rx.match(/^\(\?([dgimsuvy]+)\)/)?.[1] || ''
      const diagnostics = await redos(rx.toString(), flags)
      const filename = file.split('/').pop()
      core.startGroup(filename)
      if (diagnostics === undefined) {
        const tableRow = [
          `${filename}`,
          `:question: Error while checking regular expression`,
          ``
        ]
        tableData.push(tableRow)
        core.info('Error while checking for ReDOS.')
        core.endGroup()
        continue
      }
      if (diagnostics.status === 'safe') {
        core.info('Regex is safe.')
        core.endGroup()
        continue
      }
      // now regex is vulnerable or unknown
      const row = await parseDiagnostics(filename, diagnostics)
      tableData.push(row)
      core.endGroup()
    }
    await core.summary.addHeading('ReDOS Test Results')
    for (const row of tableData) {
      await core.summary.addDetails(`${row[0]}`, `$row[1]`)
    }
    await core.summary.write()
  } catch (error) {
    // Fail the workflow run if an error occurs
    core.setFailed(error.message)
  }
}

module.exports = {
  run
}
