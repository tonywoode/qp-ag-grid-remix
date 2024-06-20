import { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { useActionData, useLoaderData } from '@remix-run/react'
import { getTabImages } from '~/getTabImages.server'
import { loader } from './grid.$romdata.$system.$romname'

export async function action({ request }: ActionFunctionArgs) {
  const { romname, thisSystemsTabs, system } = await request.json()
  console.log(romname, thisSystemsTabs, system)
  console.log('we got her')
  const { screenshots } = await getTabImages(romname, thisSystemsTabs, system)

  console.log('screenshots')
  console.log(screenshots)
  return { screenshots }
}

export async function ScreenshotsTab({ romname, thisSystemsTabs, system }) {
  const { screenshots } = useActionData<typeof action>()

  console.log('screenshots')
  console.log(screenshots)
  if (!screenshots || screenshots.length === 0 || screenshots[0] === null) {
    console.log('no screenshots')
    return <div>Image not found</div>
  }

  return (
    <div>
      {screenshots.map((screenshot, index) => (
        <img key={index} src={screenshot} alt={`Screenshot ${index}`} style={{ width: '100%', height: 'auto' }} />
      ))}
    </div>
  )
}
