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

import util from 'util'

const colorOptions = [
  '\x1b[38;2;255;165;0m', // Orange
  '\x1b[38;2;255;255;0m', // Yellow
  '\x1b[38;2;0;255;0m', // Green
  '\x1b[38;2;0;255;255m', // Cyan
  '\x1b[38;2;0;0;255m', // Blue
  '\x1b[38;2;128;0;128m', // Purple
  '\x1b[38;2;255;20;147m', // Deep Pink
  '\x1b[38;2;255;182;193m', // Light Pink
  '\x1b[38;2;255;222;173m', // Navajo White
  '\x1b[38;2;143;188;143m', // Dark Sea Green
  '\x1b[38;2;173;216;230m', // Light Blue
  '\x1b[38;2;255;69;0m' // Red-Orange
]

export function createFeatureLogger(config) {
  const enabledFeatures = config.reduce((acc, { feature, enabled }, index) => {
    acc[feature] = {
      enabled,
      color: colorOptions[index % colorOptions.length]
    }
    return acc
  }, {})

  return {
    log: (feature, message, ...args) => {
      if (enabledFeatures[feature].enabled) {
        const color = enabledFeatures[feature].color
        const resetColor = '\x1b[0m'

        const formattedArgs = args.map(arg => {
          const serializedArg = typeof arg === 'object' ? util.inspect(arg, false, null, true) : arg
          return `${color}${serializedArg}${resetColor}`
        })

        const formattedMessage = `${color}[${feature}] ${message}${resetColor}`

        formattedMessage.split('\n').forEach(line => {
          console.log(line, ...formattedArgs)
        })
      }
    }
  }
}
