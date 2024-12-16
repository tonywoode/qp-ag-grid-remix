import type { ActionFunctionArgs } from '@remix-run/node'
import { getTabContent } from '~/getTabContent.server'
import { logger } from '~/root'
export async function action({ request }: ActionFunctionArgs) {
  const { tabClass, searchType, romname, selectedTab, system, mameNames, mameUseParentForSrch } = await request.json()
  console.log('in the tabData action function')
  logger.log('tabContent', tabClass, romname, selectedTab, system)
  const tabContent = await getTabContent(
    tabClass,
    searchType,
    romname,
    selectedTab,
    system,
    mameNames,
    mameUseParentForSrch
  )
  return tabContent ? tabContent : {}
}