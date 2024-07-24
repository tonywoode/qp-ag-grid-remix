import type { ActionFunctionArgs } from '@remix-run/node'
import { getTabContent } from '~/getTabContent.server'

export async function action({ request }: ActionFunctionArgs) {
  const { tabClass, searchType, romname, selectedTab, system, mameNames, mameUseParentForSrch } = await request.json()
  console.log('in the tabData action function')
  console.log(tabClass, romname, selectedTab, system)
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