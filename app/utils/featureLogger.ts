/**
 * This utility function is used to create a logger that can be used to log
 * messages to the console. The logger can be configured to enable or disable
 * logging for specific features.
 *
 * @param {Array<{ feature: string, enabled: boolean }>} config
 * @returns {{ log: (feature: string, message: string, ...args: any[]) => void }}
 *
 * Usage
 * const loggerConfig = [
 *   { feature: 'romChoosing', enabled: true },
 *   { feature: 'fileRunning', enabled: false },
 *   { feature: 'fileAnalysis', enabled: true }
 *   // Add more features as needed
 * ]
 * const logger = createFeatureLogger(loggerConfig)
 * logger.log('romChoosing', 'Entering romChoosing logic')
 */

const colorOptions = [
  '\x1b[38;2;0;0;255m', // Blue
  '\x1b[38;2;255;255;0m', // Yellow
  '\x1b[38;2;255;20;147m', // Deep Pink
  '\x1b[38;2;0;255;255m', // Cyan
  '\x1b[38;2;255;165;0m', // Orange
  '\x1b[38;2;128;0;128m', // Purple
  '\x1b[38;2;255;182;193m', // Light Pink
  '\x1b[38;2;255;222;173m', // Navajo White
  '\x1b[38;2;143;188;143m', // Dark Sea Green
  '\x1b[38;2;173;216;230m', // Light Blue
  '\x1b[38;2;255;69;0m', // Red-Orange
  '\x1b[38;2;0;255;0m' // Green
]

const cssColorOptions = [
  'darkblue',
  'goldenrod',
  'darkmagenta',
  'darkcyan',
  'darkorange',
  'indigo',
  'hotpink',
  'saddlebrown',
  'seagreen',
  'steelblue',
  'firebrick',
  'forestgreen'
]

export function createFeatureLogger(config) {
  const enabledFeatures = config.reduce((acc, { feature, enabled }, index) => {
    acc[feature] = {
      enabled,
      color: colorOptions[index % colorOptions.length],
      cssColor: cssColorOptions[index % cssColorOptions.length]
    }
    return acc
  }, {})

  const isBrowser = typeof window !== 'undefined'
  let util
  if (!isBrowser) import('node:util').then(module => (util = module))

  return {
    log: (feature, ...args) => {
      if (enabledFeatures[feature]?.enabled) {
        const color = enabledFeatures[feature].color
        const cssColor = enabledFeatures[feature].cssColor
        const resetColor = '\x1b[0m'
        const featureLabel = `[${feature}]`
        if (isBrowser) console.log(`%c${featureLabel}`, `color: ${cssColor}; font-weight: bold;`, ...args)
        else {
          // Node.js environment
          const formattedArgs = args.map(arg => {
            if (typeof arg === 'object' && arg !== null) return util.inspect(arg, { colors: true, depth: null })
            else return `${color}${arg}${resetColor}`
          })
          console.log(`${color}${featureLabel}${resetColor}`, ...formattedArgs)
        }
      }
    }
  }
}
