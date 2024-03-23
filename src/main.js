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
      { data: 'Diagnostic', header: true },
      { data: 'Comments', header: true }
    ]
    tableData.push([tableHeader])
    for await (const file of (await globber).globGenerator()) {
      core.startGroup(file)
      const rx = await fs.promises.readFile(file, 'utf8')
      // get flags from file. regular expression to get them: /'^\(\?([dgimsuvy]+)\)'/
      const flags = rx.match(/^\(\?([dgimsuvy]+)\)/)?.[1] || ''
      const diagnostics = await redos(rx.toString(), flags)
      const filename = file.split('/').pop()
      let text = ''
      let comments = ''
      let index = 0
      const spots = []
      if (diagnostics === undefined) {
        text = `:question: Error while checking regular expression`
        comments = ``
        const tableRow = [`${filename}`, `${text}`, `${comments}`]
        tableData.push(tableRow)
        core.endGroup()
        continue
      }
      switch (diagnostics.status) {
        case 'vulnerable':
          text = `:bomb: Vulnerable regular expression. Complexity: ${diagnostics.complexity.type}. Attack pattern: \`${diagnostics.attack.pattern}\``
          for (const { start, end, temperature } of diagnostics.hotspot) {
            if (index < start) {
              spots.push(`${diagnostics.source.substring(index, start)}`)
            }
            let openStyle = ''
            let closeStyle = ''
            if (temperature === 'heat') {
              openStyle = `\u001B[41m`
              closeStyle = `\u001B[49m`
            }
            spots.push(
              `${openStyle}${diagnostics.source.substring(start, end)}${closeStyle}`
            )
            index = end
          }
          if (index < diagnostics.source.length) {
            spots.push(`${diagnostics.source.substring(index)}`)
          }
          comments = `Hotspots detected: "${spots.join('')}"`
          break
        case 'safe':
          text = `:white_check_mark: Safe regular expression. Complexity: ${diagnostics.complexity.type}`
          break
        default:
          text = `:question: Unknown regular expression status: ${diagnostics.status}`
          comments = `Error Message: ${diagnostics.error.kind}`
          break
      }
      const tableRow = [`${filename}`, `${text}`, `${comments}`]
      tableData.push(tableRow)
      core.endGroup()
    }
    await core.summary
      .addHeading('ReDOS Test Results')
      .addTable(tableData)
      .write()
    // core.setOutput('outputKey', 'outputVal');
  } catch (error) {
    // Fail the workflow run if an error occurs
    core.setFailed(error.message)
  }
}

module.exports = {
  run
}
