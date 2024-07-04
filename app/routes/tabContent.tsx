import type { ActionFunctionArgs } from '@remix-run/node'
import { getTabContent } from '~/getTabContent.server'

export async function action({ request }: ActionFunctionArgs) {
  const { tabtype, romname, selectedTab, system } = await request.json()
  console.log('in the tabData action function')
  console.log(tabtype, romname, selectedTab, system)
  if (tabtype === 'screenshot') {
    const { screenshots } = await getTabContent(tabtype, romname, selectedTab, system)
    console.log('screenshots')
    console.log(screenshots)
    return { screenshots }
  } else if (tabtype === 'history') {
    const { history } = await getTabContent(tabtype, romname, selectedTab, system)
    console.log('history')
    console.log(history)
    return { history }
  } else {
    return {}
  }
}
