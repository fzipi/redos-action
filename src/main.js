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
    tableData.push([tableHeader])
    for await (const file of (await globber).globGenerator()) {
      core.startGroup(file)
      const rx = await fs.promises.readFile(file, 'utf8')
      const response = await redos(rx.toString(), '')
      const filename = file.split('/').pop()
      let text = ''
      switch (response.status) {
        case 'vulnerable':
          text = `:bomb: Vulnerable regular expression. Complexity: ${response.complexity.type}. Attack pattern: ${response.attack.pattern}`
          break
        case 'safe':
          text = `:white_check_mark: Safe regular expression. Complexity: ${response.complexity.type}`
          break
        default:
          text = `:question: Unknown regular expression status: ${response.status}`
          break
      }
      const tableRow = [`${filename}`, `${text}`]
      tableData.push(tableRow)
      core.endGroup()
    }
    core.info(tableData.toString())
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
