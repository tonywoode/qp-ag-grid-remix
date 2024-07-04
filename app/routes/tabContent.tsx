import type { ActionFunctionArgs } from '@remix-run/node'
import { getTabContent } from '~/getTabContent.server'

export async function action({ request }: ActionFunctionArgs) {
  const { tabType, romname, selectedTab, system } = await request.json()
  console.log('in the tabData action function')
  console.log(tabType, romname, selectedTab, system)
  if (tabType === 'screenshot') {
    const { screenshots } = await getTabContent(tabType, romname, selectedTab, system)
    console.log('screenshots')
    console.log(screenshots)
    return { screenshots }
  } else if (tabType === 'history') {
    const { history } = await getTabContent(tabType, romname, selectedTab, system)
    console.log('history')
    console.log(history)
    return { history }
  } else {
    return {}
  }
}
