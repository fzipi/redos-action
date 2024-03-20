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
    const tableData = []
    const tableHeader = [
      { data: 'File', header: true },
      { data: 'Diagnostic', header: true }
    ]
    tableData.push([tableHeader])
    for await (const file of (await globber).globGenerator()) {
      core.startGroup(file)
      const rx = await fs.promises.readFile(file, 'utf8')
      core.info(rx.toString())
      const status = await redos(rx.toString(), '')
      core.info(status)
      const tableRow = [{ data: file }, { data: status }]
      tableData.push([tableRow])
      core.endGroup()
    }
    core.summary.addTable(tableData)
    // core.setOutput('outputKey', 'outputVal');
  } catch (error) {
    // Fail the workflow run if an error occurs
    core.setFailed(error.message)
  }
}

module.exports = {
  run
}
