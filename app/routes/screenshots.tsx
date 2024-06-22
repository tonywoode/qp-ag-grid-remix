import { ActionFunctionArgs } from '@remix-run/node'
import { getTabImages } from '~/getTabImages.server'

export async function action({ request }: ActionFunctionArgs) {
  const { romname, thisSystemsTabs, system } = await request.json()
  console.log(romname, thisSystemsTabs, system)
  console.log('we got her')
  const { screenshots } = await getTabImages(romname, thisSystemsTabs, system)

  console.log('screenshots')
  console.log(screenshots)
  return { screenshots }
}
