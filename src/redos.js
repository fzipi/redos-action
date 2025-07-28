const { check } = require('recheck')

/**
 * Check if regular expression has ReDOS with enhanced error handling and diagnostics.
 *
 * @param {string} regex The regular expression.
 * @param {string} flags The regular expression flags.
 * @param {Object} options Optional configuration for timeout and diagnostics.
 */
async function redos(regex, flags, options = {}) {
  const {
    timeout = 10000, // Default 10 second timeout
    enableDiagnostics = true
  } = options

  let timeoutId
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Analysis timed out after ${timeout}ms. This may indicate:
• Complex regex pattern with potential exponential backtracking
• Nested quantifiers (e.g., (a+)*, (a*)+, (a{1,10}){1,10})
• Alternation with overlapping patterns (e.g., (a|a)*, (ab|a)*)
• Large repetition counts that create excessive search space
• Consider simplifying the regex or using atomic groups where possible`))
      }, timeout)
    })

    // Race between the recheck analysis and timeout
    const result = await Promise.race([
      check(regex, flags),
      timeoutPromise
    ])

    // Clear timeout if analysis completes
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // Add diagnostics if enabled, regardless of result status
    if (enableDiagnostics) {
      return {
        ...result,
        diagnostics: analyzeRegexComplexity(regex)
      }
    }

    return result
  } catch (error) {
    // Clear timeout on error
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    // Enhanced error information based on error type and regex characteristics
    const enhancedError = enhanceErrorDetails(error, regex, flags)
    
    if (enableDiagnostics) {
      return {
        status: 'error',
        error: {
          kind: enhancedError.type,
          message: enhancedError.message,
          details: enhancedError.details,
          suggestions: enhancedError.suggestions
        },
        diagnostics: analyzeRegexComplexity(regex)
      }
    }
    
    // Return undefined for backwards compatibility when diagnostics disabled
    return undefined
  }
}

/**
 * Enhance error details with specific diagnostics and suggestions.
 */
function enhanceErrorDetails(error, regex, flags) {
  const errorMessage = error.message || error.toString()
  const regexLength = regex.length
  const diagnostics = analyzeRegexComplexity(regex)
  
  // Timeout-specific handling
  if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
    return {
      type: 'timeout',
      message: `Regex analysis timed out (${regexLength} chars)`,
      details: `The regular expression analysis exceeded the timeout limit. This typically occurs with complex patterns that create exponential search spaces.`,
      suggestions: [
        'Simplify nested quantifiers (avoid patterns like (a+)* or (a*)+ )',
        'Reduce overlapping alternations (check for patterns like (a|a)* )',
        'Consider using atomic groups (?>) to prevent backtracking',
        'Break complex regex into simpler components',
        'Use more specific character classes instead of broad ones',
        `Pattern complexity: ${diagnostics.complexityIndicators.join(', ')}`
      ]
    }
  }
  
  // Memory-related errors
  if (errorMessage.includes('memory') || errorMessage.includes('heap') || errorMessage.includes('exceeded')) {
    return {
      type: 'memory_exceeded',
      message: 'Memory limit exceeded during analysis',
      details: 'The regex pattern requires too much memory to analyze, often due to exponential state space explosion.',
      suggestions: [
        'Reduce quantifier ranges (e.g., {1,1000} → {1,50})',
        'Eliminate redundant patterns',
        'Use more restrictive anchors (^ and $)',
        `Pattern has ${diagnostics.complexityScore} complexity indicators`
      ]
    }
  }
  
  // Parse errors
  if (errorMessage.includes('parse') || errorMessage.includes('syntax')) {
    return {
      type: 'parse_error',
      message: 'Invalid regular expression syntax',
      details: errorMessage,
      suggestions: [
        'Check for unmatched parentheses or brackets',
        'Verify escape sequences are valid',
        'Ensure quantifiers are properly formed',
        'Validate character class syntax'
      ]
    }
  }
  
  // Generic error fallback
  return {
    type: 'analysis_error',
    message: errorMessage,
    details: 'An unexpected error occurred during regex analysis',
    suggestions: [
      'Verify the regex pattern is valid',
      'Try simplifying the pattern',
      'Check for unusual unicode characters',
      `Pattern length: ${regexLength} characters`
    ]
  }
}

/**
 * Analyze regex complexity to provide insights into potential issues.
 */
function analyzeRegexComplexity(regex) {
  const indicators = []
  let complexityScore = 0
  
  // Check for nested quantifiers - major ReDoS risk
  // Look for patterns like (a+)*, (a*)*, (a{1,5})+, etc.
  if (/\([^)]*[\+\*]\)[*+]/.test(regex) || /\([^)]*\{[^}]+\}\)[*+]/.test(regex) || /[\+\*]\s*[\+\*]/.test(regex)) {
    indicators.push('nested quantifiers')
    complexityScore += 3
  }
  
  // Check for alternation with overlap potential
  if (/\([^)]*\|[^)]*\)[\+\*]/.test(regex)) {
    indicators.push('quantified alternation')
    complexityScore += 2
  }
  
  // Check for large repetition counts
  const largeCounts = regex.match(/\{(\d+),(\d+)?\}/g)
  if (largeCounts) {
    largeCounts.forEach(match => {
      const [, min, max] = match.match(/\{(\d+),(\d+)?\}/)
      const minNum = parseInt(min, 10)
      const maxNum = max ? parseInt(max, 10) : minNum
      if (minNum > 50 || maxNum > 100) {
        indicators.push(`large repetition {${min},${max || ''}}`)
        complexityScore += 2
      }
    })
  }
  
  // Check for broad character classes
  if (/\[\^[^\]]{1,3}\]/.test(regex)) {
    indicators.push('broad negated character classes')
    complexityScore += 1
  }
  
  // Check for multiple .* or .+ patterns
  const greedyPatterns = (regex.match(/\.\+|\.\*/g) || []).length
  if (greedyPatterns > 2) {
    indicators.push(`multiple greedy patterns (${greedyPatterns})`)
    complexityScore += 1
  }
  
  // Check overall length
  if (regex.length > 200) {
    indicators.push('very long pattern')
    complexityScore += 1
  }
  
  return {
    complexityScore,
    complexityIndicators: indicators.length > 0 ? indicators : ['low complexity'],
    patternLength: regex.length,
    estimatedRisk: complexityScore >= 3 ? 'high' : complexityScore >= 2 ? 'medium' : 'low'
  }
}

module.exports = { redos }
