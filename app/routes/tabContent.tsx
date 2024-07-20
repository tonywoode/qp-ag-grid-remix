import type { ActionFunctionArgs } from '@remix-run/node'
import { getTabContent } from '~/getTabContent.server'

export async function action({ request }: ActionFunctionArgs) {
  const { tabClass, searchType, romname, selectedTab, system, mameNames, mameUseParentForSrch } = await request.json()
  console.log('in the tabData action function')
  console.log(tabClass, romname, selectedTab, system)
  if (tabClass === 'screenshot') {
    const { screenshots } = await getTabContent(
      tabClass,
      searchType,
      romname,
      selectedTab,
      system,
      mameNames,
      mameUseParentForSrch
    )
    console.log('screenshots')
    console.log(screenshots)
    return { screenshots }
  } else if (tabClass === 'history') {
    const { history } = await getTabContent(
      tabClass,
      searchType,
      romname,
      selectedTab,
      system,
      mameNames,
      mameUseParentForSrch
    )
    console.log('history')
    console.log(history)
    return { history }
  } else {
    return {}
  }
}
