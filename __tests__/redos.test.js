/**
 * Unit tests for src/redos.js
 */
const { redos } = require('../src/redos')
const { expect } = require('@jest/globals')

// Mock the recheck library
jest.mock('recheck')
const { check } = require('recheck')

describe('redos.js', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Clear any remaining timers
    jest.clearAllTimers()
  })

  it('checks a safe regular expression', async () => {
    const input = '^(pineapple|pizza)$'
    check.mockResolvedValue({
      status: 'safe',
      complexity: { type: 'safe' }
    })
    
    const result = await redos(input, '')
    // check that result.status is 'safe'
    expect(result.status).toEqual('safe')
  })

  it('checks a vulnerable regular expression', async () => {
    const input = '^(a|a)*$'
    check.mockResolvedValue({
      status: 'vulnerable',
      complexity: { type: 'exponential' },
      attack: { pattern: "'a'.repeat(31) + '\\x00'" },
      hotspot: [],
      source: input
    })
    
    const result = await redos(input, '')
    // check that result.status is 'vulnerable'
    expect(result.status).toEqual('vulnerable')
    expect(result.complexity.type).toEqual('exponential')
    expect(result.attack.pattern).toEqual("'a'.repeat(31) + '\\x00'")
  })

  it('handles timeout with enhanced error diagnostics', async () => {
    jest.useFakeTimers()
    const input = '(a+)*b'
    
    // Mock check to simulate a long-running operation
    check.mockImplementation(() => new Promise(resolve => {
      // Never resolve to simulate timeout
    }))
    
    const resultPromise = redos(input, '', { timeout: 100 })
    
    // Fast-forward time to trigger timeout
    jest.advanceTimersByTime(100)
    
    const result = await resultPromise
    
    expect(result.status).toEqual('error')
    expect(result.error.kind).toEqual('timeout')
    expect(result.error.message).toContain('timed out')
    expect(result.error.suggestions).toContain('Simplify nested quantifiers (avoid patterns like (a+)* or (a*)+ )')
    expect(result.diagnostics.complexityIndicators).toContain('nested quantifiers')
    expect(result.diagnostics.estimatedRisk).toEqual('high')
    
    jest.useRealTimers()
  })

  it('analyzes regex complexity correctly', async () => {
    const complexInput = '(a+)*(b{1,1000})+[^abc]'
    
    check.mockRejectedValue(new Error('timeout'))
    
    const result = await redos(complexInput, '')
    
    expect(result.diagnostics.complexityIndicators).toEqual(
      expect.arrayContaining(['nested quantifiers', 'large repetition {1,1000}', 'broad negated character classes'])
    )
    expect(result.diagnostics.complexityScore).toBeGreaterThan(3)
    expect(result.diagnostics.estimatedRisk).toEqual('high')
  })

  it('handles memory exceeded errors', async () => {
    const input = 'a{1,10000}b{1,10000}'
    
    check.mockRejectedValue(new Error('memory exceeded'))
    
    const result = await redos(input, '')
    
    expect(result.status).toEqual('error')
    expect(result.error.kind).toEqual('memory_exceeded')
    expect(result.diagnostics.complexityIndicators).toEqual(
      expect.arrayContaining(['large repetition {1,10000}'])
    )
  })

  it('handles parse errors with suggestions', async () => {
    const input = '[invalid'
    
    check.mockRejectedValue(new Error('parse error: invalid syntax'))
    
    const result = await redos(input, '')
    
    expect(result.status).toEqual('error')
    expect(result.error.kind).toEqual('parse_error')
    expect(result.error.suggestions).toContain('Check for unmatched parentheses or brackets')
  })

  it('maintains backward compatibility when diagnostics disabled', async () => {
    const input = 'invalid[regex'
    
    check.mockRejectedValue(new Error('some error'))
    
    const result = await redos(input, '', { enableDiagnostics: false })
    
    expect(result).toBeUndefined()
  })

  it('checks a flags in regex', async () => {
    const input = '^(pineapple|pizza)$'
    const flags = 'i'
    check.mockResolvedValue({
      status: 'safe',
      complexity: { type: 'safe' }
    })
    
    const result = await redos(input, flags)
    // check that result.status is 'safe'
    expect(result.status).toEqual('safe')
    expect(check).toHaveBeenCalledWith(input, flags)
  })

  it('detects quantified alternation patterns', async () => {
    const input = '(abc|def)*test(xyz|uvw)+'
    
    check.mockRejectedValue(new Error('timeout'))
    
    const result = await redos(input, '')
    
    expect(result.diagnostics.complexityIndicators).toContain('quantified alternation')
    expect(result.diagnostics.complexityScore).toBeGreaterThanOrEqual(2)
  })

  it('detects multiple greedy patterns', async () => {
    const input = '.*start.*middle.*end.*finish.*'
    
    check.mockRejectedValue(new Error('timeout'))
    
    const result = await redos(input, '')
    
    expect(result.diagnostics.complexityIndicators).toContain('multiple greedy patterns (5)')
    expect(result.diagnostics.complexityScore).toBeGreaterThanOrEqual(1)
  })

  it('detects very long patterns', async () => {
    // Create a pattern longer than 200 characters
    const longPattern = 'a'.repeat(50) + 'b'.repeat(50) + 'c'.repeat(50) + 'd'.repeat(60)
    
    check.mockRejectedValue(new Error('timeout'))
    
    const result = await redos(longPattern, '')
    
    expect(result.diagnostics.complexityIndicators).toContain('very long pattern')
    expect(result.diagnostics.complexityScore).toBeGreaterThanOrEqual(1)
    expect(result.diagnostics.patternLength).toBeGreaterThan(200)
  })

  it('performs comprehensive complexity analysis on complex pattern', async () => {
    // Pattern with multiple complexity indicators
    const complexPattern = '(abc|def)*' + // quantified alternation
                          '.*middle.*end.*' + // multiple greedy patterns  
                          'test{1,1000}' + // large repetition
                          '[^abc]' + // broad negated character class
                          'x'.repeat(150) // make it long (total > 200 chars)
    
    check.mockRejectedValue(new Error('memory exceeded'))
    
    const result = await redos(complexPattern, '')
    
    expect(result.status).toEqual('error')
    expect(result.error.kind).toEqual('memory_exceeded')
    // Check that we have at least the key indicators, order doesn't matter
    expect(result.diagnostics.complexityIndicators).toEqual(
      expect.arrayContaining([
        'quantified alternation',
        'large repetition {1,1000}',
        'broad negated character classes'
      ])
    )
    // Should have multiple greedy patterns and very long pattern
    expect(result.diagnostics.complexityIndicators.some(indicator => 
      indicator.includes('multiple greedy patterns')
    )).toBe(true)
    expect(result.diagnostics.estimatedRisk).toEqual('high')
    expect(result.diagnostics.complexityScore).toBeGreaterThanOrEqual(5)
  })

  it('handles edge case with no complexity indicators', async () => {
    const simpleInput = 'abc'
    
    check.mockResolvedValue({
      status: 'safe',
      complexity: { type: 'safe' }
    })
    
    const result = await redos(simpleInput, '')
    
    expect(result.status).toEqual('safe')
    // When analysis succeeds, diagnostics should still be present
    expect(result.diagnostics).toBeDefined()
    expect(result.diagnostics.complexityIndicators).toEqual(['low complexity'])
    expect(result.diagnostics.estimatedRisk).toEqual('low')
    expect(result.diagnostics.complexityScore).toEqual(0)
  })

  it('properly categorizes risk levels', async () => {
    // Test medium risk (score 2)
    const mediumRiskInput = '(abc|def)*test'
    
    check.mockRejectedValue(new Error('timeout'))
    
    const result = await redos(mediumRiskInput, '')
    
    expect(result.diagnostics.complexityScore).toEqual(2)
    expect(result.diagnostics.estimatedRisk).toEqual('medium')
  })

  it('handles diagnostics disabled option', async () => {
    const input = '(a+)*b'
    
    check.mockRejectedValue(new Error('timeout'))
    
    const result = await redos(input, '', { enableDiagnostics: false })
    
    // When diagnostics are disabled and there's an error, result should be undefined
    expect(result).toBeUndefined()
  })

  it('handles different timeout values', async () => {
    jest.useFakeTimers()
    const input = '(a+)*b'
    
    check.mockImplementation(() => new Promise(() => {})) // Never resolves
    
    const resultPromise = redos(input, '', { timeout: 500 })
    
    jest.advanceTimersByTime(500)
    
    const result = await resultPromise
    
    expect(result.status).toEqual('error')
    expect(result.error.kind).toEqual('timeout')
    // The actual message format from our implementation includes regex length
    expect(result.error.message).toContain('Regex analysis timed out')
    expect(result.error.message).toContain('chars')
    
    jest.useRealTimers()
  })

  it('handles successful analysis without errors', async () => {
    const input = '^test$'
    
    check.mockResolvedValue({
      status: 'safe',
      complexity: { type: 'safe' },
      source: input
    })
    
    const result = await redos(input, 'i')
    
    expect(result.status).toEqual('safe')
    expect(result.complexity.type).toEqual('safe')
    expect(result.source).toEqual(input)
    // When enableDiagnostics is true (default), diagnostics should be present
    expect(result.diagnostics).toBeDefined()
    expect(result.diagnostics.complexityIndicators).toEqual(['low complexity'])
  })
})
