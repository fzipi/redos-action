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
const endGroupMock = jest.spyOn(core, 'endGroup').mockImplementation()
const summaryTableMock = jest
  .spyOn(core.summary, 'addTable')
  .mockImplementation(() => core.summary)

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// Add summary mocks for chaining
const summaryAddHeadingMock = jest
  .spyOn(core.summary, 'addHeading')
  .mockImplementation(() => core.summary)
const summaryWriteMock = jest
  .spyOn(core.summary, 'write')
  .mockImplementation()

// Mock the redos module
jest.mock('../src/redos')
const { redos } = require('../src/redos')

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockfs({
      'compiled/921100': 'DATA', // safe
      'compiled/934500': '^(a|a)*$' // vulnerable
    })
    
    // Default mock implementation for redos
    redos.mockImplementation(async (regex, flags) => {
      if (regex === 'DATA') {
        return {
          status: 'safe',
          complexity: { type: 'safe' }
        }
      } else if (regex === '^(a|a)*$') {
        return {
          status: 'vulnerable',
          complexity: { type: 'exponential' },
          attack: { pattern: "'a'.repeat(31) + '\\x00'" },
          hotspot: [
            { start: 2, end: 3, temperature: 'heat' },
            { start: 4, end: 5, temperature: 'heat' }
          ],
          source: '^(a|a)*$'
        }
      }
      return { status: 'safe', complexity: { type: 'safe' } }
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
          { data: 'Diagnostic', header: true },
          { data: 'Comments', header: true }
        ]
      ],
      [
        '921100',
        ':white_check_mark: **Safe** regular expression. Complexity: `safe`',
        ''
      ],
      [
        '934500',
        ":bomb: **Vulnerable** regular expression. Complexity: `exponential`. Attack pattern: `'a'.repeat(31) + '\\x00'`",
        '🎯 **Hotspots detected:** `^(🔥**a**🔥|🔥**a**🔥)*$`'
      ]
    ])
    expect(endGroupMock).toHaveBeenNthCalledWith(1)
  })

  it('handles undefined diagnostics from redos function', async () => {
    mockfs({
      'compiled/error-regex': 'invalid[regex'
    })

    // Mock redos to return undefined for error case
    redos.mockImplementation(async () => undefined)

    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'files':
          return 'compiled/error-regex'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    expect(summaryTableMock).toHaveBeenCalledWith([
      [
        [
          { data: 'File', header: true },
          { data: 'Diagnostic', header: true },
          { data: 'Comments', header: true }
        ]
      ],
      [
        'error-regex',
        ':question: **Error while checking regular expression**',
        ''
      ]
    ])
  })

  it('handles enhanced timeout error with diagnostics', async () => {
    mockfs({
      'compiled/timeout-regex': '(a+)*b'
    })

    // Mock redos to return enhanced timeout error
    redos.mockImplementation(async () => ({
      status: 'error',
      error: {
        kind: 'timeout',
        message: 'Regex analysis timed out (7 chars)',
        details: 'The regular expression analysis exceeded the timeout limit. This typically occurs with complex patterns that create exponential search spaces.',
        suggestions: [
          'Simplify nested quantifiers (avoid patterns like (a+)* or (a*)+ )',
          'Reduce overlapping alternations (check for patterns like (a|a)* )',
          'Consider using atomic groups (?>) to prevent backtracking'
        ]
      },
      diagnostics: {
        complexityScore: 3,
        complexityIndicators: ['nested quantifiers'],
        patternLength: 7,
        estimatedRisk: 'high'
      }
    }))

    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'files':
          return 'compiled/timeout-regex'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    expect(summaryTableMock).toHaveBeenCalledWith([
      [
        [
          { data: 'File', header: true },
          { data: 'Diagnostic', header: true },
          { data: 'Comments', header: true }
        ]
      ],
      [
        'timeout-regex',
        ':alarm_clock: **Analysis Timeout** - Pattern too complex to analyze safely',
        '⚠️ **Timeout Details:** The regular expression analysis exceeded the timeout limit. This typically occurs with complex patterns that create exponential search spaces. **Suggestions:** Simplify nested quantifiers (avoid patterns like (a+)* or (a*)+ ) • Reduce overlapping alternations (check for patterns like (a|a)* ) • Consider using atomic groups (?>) to prevent backtracking **Risk: `high`, Indicators: `nested quantifiers`**'
      ]
    ])
  })

  it('handles memory exceeded error', async () => {
    mockfs({
      'compiled/memory-issue': 'a{1,10000}b{1,10000}'
    })

    // Mock redos to return memory exceeded error
    redos.mockImplementation(async () => ({
      status: 'error',
      error: {
        kind: 'memory_exceeded',
        message: 'Memory limit exceeded during analysis',
        details: 'The regex pattern requires too much memory to analyze, often due to exponential state space explosion.',
        suggestions: [
          'Reduce quantifier ranges (e.g., {1,1000} → {1,50})',
          'Eliminate redundant patterns',
          'Use more restrictive anchors (^ and $)',
          'Pattern has 5 complexity indicators'
        ]
      },
      diagnostics: {
        complexityScore: 5,
        complexityIndicators: ['large repetition {1,10000}', 'large repetition {1,10000}'],
        estimatedRisk: 'high'
      }
    }))

    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'files':
          return 'compiled/memory-issue'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    expect(summaryTableMock).toHaveBeenCalledWith([
      [
        [
          { data: 'File', header: true },
          { data: 'Diagnostic', header: true },
          { data: 'Comments', header: true }
        ]
      ],
      [
        'memory-issue',
        ':bangbang: **Memory Exceeded** - Pattern requires too much memory to analyze',
        '💾 **Memory Issue:** The regex pattern requires too much memory to analyze, often due to exponential state space explosion. **Suggestions:** Reduce quantifier ranges (e.g., {1,1000} → {1,50}) • Eliminate redundant patterns'
      ]
    ])
  })

  it('handles parse error with detailed suggestions', async () => {
    mockfs({
      'compiled/parse-error': 'invalid[regex('
    })

    // Mock redos to return parse error
    redos.mockImplementation(async () => ({
      status: 'error',
      error: {
        kind: 'parse_error',
        message: 'Invalid regular expression: Unterminated character class',
        details: 'The regular expression contains syntax errors that prevent proper parsing.',
        suggestions: [
          'Check for unmatched brackets [ ] or parentheses ( )',
          'Verify escape sequences are correct',
          'Ensure quantifiers are properly placed'
        ]
      },
      diagnostics: {
        complexityScore: 0,
        complexityIndicators: ['low complexity'],
        estimatedRisk: 'low'
      }
    }))

    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'files':
          return 'compiled/parse-error'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    expect(summaryTableMock).toHaveBeenCalledWith([
      [
        [
          { data: 'File', header: true },
          { data: 'Diagnostic', header: true },
          { data: 'Comments', header: true }
        ]
      ],
      [
        'parse-error',
        ':x: **Syntax Error** - Invalid regular expression',
        '🔍 **Parse Error:** The regular expression contains syntax errors that prevent proper parsing. **Suggestions:** Check for unmatched brackets [ ] or parentheses ( ) • Verify escape sequences are correct'
      ]
    ])
  })

  it('handles unknown error types with generic error handling', async () => {
    mockfs({
      'compiled/unknown-error': 'some-regex'
    })

    // Mock redos to return unknown error type
    redos.mockImplementation(async () => ({
      status: 'error',
      error: {
        kind: 'network_error',
        message: 'Connection failed',
        details: 'Unable to connect to analysis service'
      },
      diagnostics: {
        complexityScore: 1,
        complexityIndicators: ['low complexity'],
        estimatedRisk: 'low'
      }
    }))

    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'files':
          return 'compiled/unknown-error'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    expect(summaryTableMock).toHaveBeenCalledWith([
      [
        [
          { data: 'File', header: true },
          { data: 'Diagnostic', header: true },
          { data: 'Comments', header: true }
        ]
      ],
      [
        'unknown-error',
        ':warning: **Analysis Error** - `network_error`',
        '❌ **Error:** Connection failed **Details:** Unable to connect to analysis service'
      ]
    ])
  })

  it('handles unknown diagnostic status', async () => {
    mockfs({
      'compiled/unknown-status': 'some-regex'
    })

    // Mock redos to return unknown status
    redos.mockImplementation(async () => ({
      status: 'unknown-status',
      error: { kind: 'unexpected error' }
    }))

    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'files':
          return 'compiled/unknown-status'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    expect(summaryTableMock).toHaveBeenCalledWith([
      [
        [
          { data: 'File', header: true },
          { data: 'Diagnostic', header: true },
          { data: 'Comments', header: true }
        ]
      ],
      [
        'unknown-status',
        ':question: **Unknown** regular expression status: `unknown-status`',
        '❌ **Error:** `unexpected error`'
      ]
    ])
  })

  it('generates correct table format for GitHub Actions summary', async () => {
    mockfs({
      'compiled/test-file': '^(a|a)*$'
    })

    // Mock redos to return vulnerable result
    redos.mockImplementation(async () => ({
      status: 'vulnerable',
      complexity: { type: 'exponential' },
      attack: { pattern: "'a'.repeat(31) + '\\x00'" },
      hotspot: [
        { start: 2, end: 3, temperature: 'heat' },
        { start: 4, end: 5, temperature: 'normal' }
      ],
      source: '^(a|a)*$'
    }))

    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'files':
          return 'compiled/test-file'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify the table structure matches @actions/core expected format
    expect(summaryTableMock).toHaveBeenCalledWith([
      [
        // First row should be header with objects containing data and header: true
        [
          { data: 'File', header: true },
          { data: 'Diagnostic', header: true },
          { data: 'Comments', header: true }
        ]
      ],
      // Subsequent rows should be arrays of strings
      [
        'test-file',
        ":bomb: **Vulnerable** regular expression. Complexity: `exponential`. Attack pattern: `'a'.repeat(31) + '\\x00'`",
        '🎯 **Hotspots detected:** `^(🔥**a**🔥|⚠️**a**⚠️)*$`'
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
