const { check } = require('recheck')

/**
 * Check if regular expression has ReDOS.
 *
 * TODO: See what else from diagnostics can work (Resolves with https://makenowjust-labs.github.io/recheck/docs/usage/diagnostics/)
 *
 * @param {string} regex The regular expression.
 * @param {string} flags The regular expression flags (TODO).
 * @returns {Promise<String>} status: "vulnerable", "safe" or "undefined"
 */
async function redos(regex, flags) {
  const response = await check(regex, flags)
  return response.status
}

module.exports = { redos }
