import type { ActionFunctionArgs } from '@remix-run/node'
import { getTabImages } from '~/getMameHistory.server'

export async function action({ request }: ActionFunctionArgs) {
  const { romname, selectedTab, system } = await request.json()
  console.log('in the screenshots location action function')
  console.log(romname, selectedTab, system)
  const { history } = await getTabImages(romname, selectedTab, system)

  console.log('history')
  console.log(history)
  return { history }
}
