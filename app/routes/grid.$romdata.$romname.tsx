import { useParams } from '@remix-run/react'

import Split from 'react-split'

export async function loader({ params }) {
  console.log('grid romdata romname loader')
  return {}
}

export default function gameFile() {
  const params = useParams()
  const romname = decodeURI(params.romname)
  console.log(`/mypath/${romname}`)
  return <div>hello world </div>
}
