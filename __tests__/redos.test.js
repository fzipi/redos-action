/**
 * Unit tests for src/redos.js
 */
const { redos } = require('../src/redos')
const { expect } = require('@jest/globals')

describe('redos.js', () => {
  it('checks a safe regular expression', async () => {
    const input = '^(pineapple|pizza)$'
    await expect(redos(input, '')).resolves.toEqual('safe')
  })
  it('checks a vulnerable regular expression', async () => {
    const input = '^(a|a)*$'
    await expect(redos(input, '')).resolves.toEqual('vulnerable')
  })
})
