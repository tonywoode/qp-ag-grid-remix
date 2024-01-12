import { useParams } from '@remix-run/react'
import { runGame } from './runGame'
import Split from 'react-split'

// export async function loader({ params }) {
//   console.log('grid romdata romname loader')
//   return {}
// }

// export const action = params => {
//   console.log('grid romdata romname action')
//   console.log(params)
//   return { that: 'is a test' }
// }
export default function gameFile() {
  const params = useParams()
  const romname = decodeURI(params.romname)
  console.log(`/mypath/${romname}`)
  return <div>hello world </div>
}
