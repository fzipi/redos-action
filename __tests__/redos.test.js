/**
 * Unit tests for src/redos.js
 */
const { redos } = require('../src/redos')
const { expect } = require('@jest/globals')

describe('redos.js', () => {
  it('checks a safe regular expression', async () => {
    const input = '^(pineapple|pizza)$'
    const result = await redos(input, '')
    // check that result.status is 'safe'
    expect(result.status).toEqual('safe')
  })
  it('checks a vulnerable regular expression', async () => {
    const input = '^(a|a)*$'
    const result = await redos(input, '')
    // check that result.status is 'safe'
    expect(result.status).toEqual('vulnerable')
    expect(result.complexity.type).toEqual('exponential')
    expect(result.attack.pattern).toEqual("'a'.repeat(31) + '\\x00'")
  })
})
