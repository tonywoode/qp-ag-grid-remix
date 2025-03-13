import { loadMediaPanelConfig, logger } from '~/dataLocations.server' // Import loadMediaPanelConfig from dataLocations.server

export async function loadTabData(system: string) {
  logger.log('tabContent', 'loadTabData.server passed ' + system)
  const mediaPanelConfig = loadMediaPanelConfig()
  //if mediaPanel config is an empty object, return a string as thisSystemsTabs 'no media panel config'
  let thisSystemsTabs = mediaPanelConfig?.[system]?.tabs
  if (Object.keys(mediaPanelConfig).length === 0) {
    logger.log('tabContent', 'loadTabData.server mediaPanelConfig is empty')
    thisSystemsTabs = { error: 'no media panel config - set up the media panel!' }
    return thisSystemsTabs
  }

  logger.log('tabContent', 'loadTabData.server passed this systems tabs:', thisSystemsTabs)
  return thisSystemsTabs
}
