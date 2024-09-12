const core = require('@actions/core')
const glob = require('@actions/glob')
const fs = require('fs')
const { redos } = require('./redos')

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
      { data: 'Diagnostic', header: true }
    ]
    const details = Array()
    tableData.push([tableHeader])
    for await (const file of (await globber).globGenerator()) {
      core.startGroup(file)
      const rx = await fs.promises.readFile(file, 'utf8')
      // get flags from file. regular expression to get them: /'^\(\?([dgimsuvy]+)\)'/
      const flags = rx.match(/^\(\?([dgimsuvy]+)\)/)?.[1] || ''
      const diagnostics = await redos(rx.toString(), flags)
      const filename = file.split('/').pop()
      let text = ''
      let index = 0
      const spots = []
      if (diagnostics === undefined) {
        text = `:question: Error while checking regular expression`
        const tableRow = [`${filename}`, `${text}`]
        tableData.push(tableRow)
        core.endGroup()
        continue
      }
      switch (diagnostics.status) {
        case 'vulnerable':
          text = `:bomb: Vulnerable regular expression. Complexity: ${diagnostics.complexity.type}. See below for more information.`
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
          details.push([
            `${filename}`,
            `Attack pattern: ${diagnostics.attack.pattern}`,
            `Hotspots detected: "${spots.join('')}"`
          ])
          break
        default:
          text = `:question: Unknown regular expression status: ${diagnostics.status}: error ${diagnostics.error.kind}`
          break
      }
      const tableRow = [filename, text]
      tableData.push(tableRow)
      core.endGroup()
    }
    await core.summary
      .addHeading(`ReDOS Test Results`)
      .addTable(tableData)
      .addBreak()
    for (const row of details) {
      await core.summary.addHeading(`${row[0]}`)
      await core.summary.addDetails(`${row[1]}`, `${row[2]}`)
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
