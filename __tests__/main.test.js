/**
 * Unit tests for the action's main functionality, src/main.js
 */

// set mocked file
process.env['GITHUB_STEP_SUMMARY'] = 'data/github-step-summary.md'

const core = require('@actions/core')
const main = require('../src/main')
const mockfs = require('mock-fs')

// Mock the GitHub Actions core library
const debugMock = jest.spyOn(core, 'debug').mockImplementation()
const infoMock = jest.spyOn(core, 'info').mockImplementation()
const getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
const setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
const startGroupMock = jest.spyOn(core, 'startGroup').mockImplementation()
const endGroupMock = jest.spyOn(core, 'endGroup').mockImplementation()
const summaryTableMock = jest
  .spyOn(core.summary, 'addTable')
  .mockImplementation()
const failedMock = jest.spyOn(core, 'setFailed').mockImplementation()
// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockfs({
      'compiled/921100': 'DATA', // safe
      'compiled/934500': '^(a|a)*$', // vulnerable
      'data/github-step-summary.md': ''
    })
  })

  afterEach(() => {
    mockfs.restore()
  })

  it('sets the files output', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'files':
          return 'compiled/*'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(debugMock).toHaveBeenNthCalledWith(
      1,
      'Received files glob pattern: compiled/*'
    )
    const path = process.cwd()
    expect(startGroupMock).toHaveBeenNthCalledWith(1, `921100`)
    // expect(summaryTableMock).toHaveBeenNthCalledWith(1, [
    //   [
    //     [
    //       { data: 'File', header: true },
    //       { data: 'Diagnostic', header: true },
    //       { data: 'Comments', header: true }
    //     ]
    //   ],
    //   [
    //     '934500',
    //     ":bomb: Vulnerable regular expression. Complexity: exponential. Attack pattern: **'a'.repeat(31) + '\\x00'**",
    //     'Hotspots detected: "^(**a**|**a**)*$"'
    //   ]
    // ])
    expect(infoMock).toHaveBeenCalledWith('Regex is safe.')
    expect(endGroupMock).toHaveBeenNthCalledWith(1)
    expect(failedMock).not.toHaveBeenCalled()
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
