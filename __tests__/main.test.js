/**
 * Unit tests for the action's main functionality, src/main.js
 */
const core = require('@actions/core')
const main = require('../src/main')
const mockfs = require('mock-fs')

// Mock the GitHub Actions core library
const debugMock = jest.spyOn(core, 'debug').mockImplementation()
const getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
const setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
const startGroupMock = jest.spyOn(core, 'startGroup').mockImplementation()
const summaryTableMock = jest
  .spyOn(core.summary, 'addTable')
  .mockImplementation()

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockfs({
      'compiled/921100': 'DATA', // safe
      'compiled/934500': '^(a|a)*$' // vulnerable
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
    expect(startGroupMock).toHaveBeenNthCalledWith(1, `${path}/compiled/921100`)
    expect(summaryTableMock).toHaveBeenNthCalledWith(1, [
      [
        [
          { data: 'File', header: true },
          { data: 'Diagnostic', header: true }
        ]
      ],
      [
        '921100',
        ':white_check_mark: Safe regular expression. Complexity: safe'
      ],
      [
        '934500',
        ":bomb: Vulnerable regular expression. Complexity: exponential. Attack pattern: 'a'.repeat(31) + '\\x00'"
      ]
    ])
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
