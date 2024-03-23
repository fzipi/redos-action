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
  it('checks a flags in regex', async () => {
    const input = `^(?:get /[^#\\?]*(?:\\?[^\\s\x0b#]*)?(?:#[^\\s\x0b]*)?|(?:connect (?:(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\.?(?::[0-9]+)?|[\\--9A-Z_a-z]+:[0-9]+)|options \\*|[a-z]{3,10}[\\s\x0b]+(?:[0-9A-Z_a-z]{3,7}?://[\\--9A-Z_a-z]*(?::[0-9]+)?)?/[^#\\?]*(?:\\?[^\\s\x0b#]*)?(?:#[^\\s\x0b]*)?)[\\s\x0b]+[\\.-9A-Z_a-z]+)$`
    const flags = 'i'
    const result = await redos(input, flags)
    // check that result.status is 'safe'
    expect(result.status).toEqual('vulnerable')
    expect(result.complexity.type).toEqual('polynomial')
    expect(result.hotspot).toEqual([
      { end: 49, start: 48, temperature: 'normal' },
      { end: 143, start: 138, temperature: 'normal' },
      { end: 154, start: 149, temperature: 'normal' },
      { end: 214, start: 207, temperature: 'normal' },
      { end: 249, start: 244, temperature: 'heat' }
    ])
  }, 10000)
})
