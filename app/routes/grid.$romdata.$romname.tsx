import { useParams } from '@remix-run/react'
import { runGame } from './runGame'
import Split from 'react-split'

// export async function loader({ params }) {
//   console.log('grid romdata romname loader')
//   const romname = params.romname
//   console.log(romname)
//   return { romname }
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
  return <div>{romname}</div>
}
