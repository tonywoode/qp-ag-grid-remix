import { useLoaderData, useParams } from '@remix-run/react'
import { runGame } from './runGame'
import Split from 'react-split'

export const getScreenshots = screenshots => {
  return fetch('/getScreenshots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(screenshots)
  })
}

export async function loader({ params }) {
  console.log('grid romdata romname loader')
  const romname = params.romname
  console.log(params)
  console.log('in the loader romname is ' + romname)
  const romnameNoParens = romname.replace(/\(.*\)/g, '').trim()
  return { romnameNoParens }
  // const response = await getScreenshots(romnameNoParens)
  // const data = await response.json()
  return { data }
}

// export const action = params => {
//   console.log('grid romdata romname action')
//   console.log(params)
//   return { that: 'is a test' }
// }

// MediaPanel.tsx
import { Outlet } from '@remix-run/react'
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs'
import { ScreenshotsTab } from '~/components/ScreenshotsTab'
import { useEffect, useState } from 'react'

export default function MediaPanel() {
  const data = useLoaderData()
  const [screenshots, setScreenshots] = useState([])

  useEffect(() => {
    async function fetchScreenshots() {
      const response = await getScreenshots(data.romnameNoParens)
      const gottenScreenshots = await response.json()
      console.log('gottenScreenshots:')
      console.table(gottenScreenshots)
      setScreenshots(gottenScreenshots.screenshots || [])
    }

    fetchScreenshots()
  }, [data])
  return (
    <Tabs>
      <TabList>
        <Tab>Screenshots</Tab>
        <Tab>Game Info</Tab>
      </TabList>

      <TabPanel>
        <ScreenshotsTab screenshots={screenshots} />
      </TabPanel>
      <TabPanel>
        <h2>Good Game, son</h2>
      </TabPanel>
    </Tabs>
  )
}

// export default function gameFile() {
// const params = useParams()
// const romname = decodeURI(params.romname)
// console.log(`/mypath/${romname}`)
// return <div>{romname}</div>
// }
