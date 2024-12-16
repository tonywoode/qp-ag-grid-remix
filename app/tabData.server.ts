import mediaPanelConfig from '~/../dats/mediaPanelConfig.json'
import { logger } from '~/root'

export async function loadTabData(system: string) {
  logger.log('tabContent', 'loadTabData.server passed ' + system)
  const thisSystemsTabs = mediaPanelConfig?.[system]?.tabs
  logger.log('tabContent', 'loadTabData.server passed this systems tabs:', thisSystemsTabs)
  return thisSystemsTabs
}
