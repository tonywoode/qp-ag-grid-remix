import type { ActionFunctionArgs } from '@remix-run/node'
import { getTabImages } from '~/getTabImages.server'

export async function action({ request }: ActionFunctionArgs) {
  const { romname, selectedTab, system } = await request.json()
  console.log('heres that data you ordereed')
  console.log(romname, selectedTab, system)
  const { screenshots } = await getTabImages(romname, selectedTab, system)

  console.log('screenshots')
  console.log(screenshots)
  return { screenshots }
}
