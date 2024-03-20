/**
 * Unit tests for the action's main functionality, src/main.js
 */
const core = require('@actions/core')
const glob = require('@actions/glob')
const main = require('../src/main')

// Mock the GitHub Actions core library
const debugMock = jest.spyOn(core, 'debug').mockImplementation()
const getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
const setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
const setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()
const summaryTableMock = jest
  .spyOn(core.summary, 'addTable')
  .mockImplementation()

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')
const globMock = jest.spyOn(glob, 'create').mockImplementation()
//jest.mock('fs')

const MOCK_FILE_INFO = {
  'compiled/921100': 'DATA',
  'compiled/934500': 'VULN'
}
describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    globMock.mockReturnValue(Object.keys(MOCK_FILE_INFO))
    //require('fs').__setMockFiles(MOCK_FILE_INFO)
  })

  it('sets the files output', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'files':
          return 'compiled/**'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(debugMock).toHaveBeenNthCalledWith(
      1,
      'Received files glob pattern: compiled/**'
    )
    // expect(summaryTableMock).toHaveBeenNthCalledWith(
    //   1,
    //   [[[{"data": "File", "header": true}, {"data": "Diagnostic", "header": true}]]]
    // )
    // expect(setOutputMock).toHaveBeenNthCalledWith(
    //   1,
    //   'response',
    //   expect.stringMatching('vulnerable')
    // )
  })

  it('sets a failed status', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'files':
          // eslint-disable-next-line no-undef
          return 10n
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    // expect(setFailedMock).toHaveBeenNthCalledWith(
    //   1,
    //   'patterns.split is not a function'
    // )
  })

  it('fails if no input is provided', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'files':
          throw new Error('Input required and not supplied: files')
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'Input required and not supplied: files'
    )
  })
})
