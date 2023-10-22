import { convertRomDataToJSON } from '~/utils/romdataToJson'

import { useLoaderData } from '@remix-run/react'
export async function loader() {
  console.log('loading romdataConverter')
  return 'Romdata Converter'
}

import { useState } from 'react'

// function FileUpload() {
//   if (typeof document !== 'undefined') window.showDirectoryPicker()
// }
// export default FileUpload
//   const [selectedFile, setSelectedFile] = useState(null)

//   const handleFileChange = event => {
//     const file = event.target.files[0]
//     setSelectedFile(file)
//   }

//   return (
//     <div>
//       <input type="file" onChange={handleFileChange} />
//       {selectedFile && <p>Selected File: {selectedFile.name}</p>}
//     </div>
//   )

//ITS at this point I realised I needed electron....really I need a directory picker,
// so here was project FUGUs. I can't live with the access prompt (and its talk of tabs and browser sessions))
function FileUpload() {
  const handleDirectoryPick = async () => {
    try {
      const directoryHandle = await window.showDirectoryPicker()
      // Use the directory handle here
    } catch (error) {
      console.error('Error picking directory:', error)
    }
  }

  return <button onClick={handleDirectoryPick}>Select Directory</button>
}

export default FileUpload
