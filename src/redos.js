const { check } = require('recheck')

/**
 * Check if regular expression has ReDOS.
 *
 * TODO: See what else from diagnostics can work (Resolves with https://makenowjust-labs.github.io/recheck/docs/usage/diagnostics/)
 *
 * @param {string} regex The regular expression.
 * @param {string} flags The regular expression flags (TODO).
 */
async function redos(regex, flags) {
  return await check(regex, flags)
}

module.exports = { redos }
