import mediaPanelConfig from '~/../dats/mediaPanelConfig.json'

export async function loadTabData(system: string) {
  console.log('load screenshosts server passed ' + system)
  const thisSystemsTabs = mediaPanelConfig?.[system]?.tabs
  console.log(thisSystemsTabs)
  return thisSystemsTabs
}
