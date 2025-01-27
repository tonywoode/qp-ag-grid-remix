import { useState, useEffect } from 'react'
import { Form, useActionData, useNavigate, useNavigation } from '@remix-run/react'
import { json } from '@remix-run/node'
import Modal from 'react-modal'
import electron from '~/electron.server'
import { convertQuickPlayData } from '~/utils/quickPlayConverter.server'
import type { ConversionOptions } from '~/utils/quickPlayConverter.server'
import type { BackupChoice } from '~/utils/safeDirectoryOps.server'

type ModalState = {
  isOpen: boolean
  selectedPath?: string
  isConverting?: boolean
  error?: string
  result?: {
    success: boolean
    message: string
  }
}

export async function loader() {
  // Add empty romdata to match what root is looking for
  return json({ romdata: [] })
}

export const action = async ({ request }: { request: Request }) => {
  console.log('Convert route action called')
  const formData = await request.formData()
  const intent = formData.get('intent')
  console.log('Intent:', intent)
  //loop through the formdata and print it to the console
  for (let pair of formData.entries()) {
    console.log(pair[0] + ', ' + pair[1])
  }

  if (intent === 'selectDirectory') {
    console.log('Handling directory selection')
    const result = await electron.dialog.showOpenDialog({
      message: "Select original QuickPlay install folder (should contain 'Data' and 'Dats' dirs)",
      properties: ['openDirectory']
    })

    if (result.canceled || !result.filePaths.length) {
      return json({ success: false, message: 'No folder selected' })
    }

    const sourcePath = result.filePaths[0]
    console.log('Selected directory:', sourcePath)

    try {
      // Try initial conversion without backup choice to trigger existing data check
      const options = {
        convertRomdata: formData.get('convertRomdata') !== 'false',
        convertSystems: formData.get('convertSystems') !== 'false',
        convertEmulators: formData.get('convertEmulators') !== 'false',
        convertMediaPanel: formData.get('convertMediaPanel') !== 'false'
      }
      console.log('Attempting conversion with options:', options)

      const result = await convertQuickPlayData(sourcePath, options)
      console.log('Conversion attempt result:', result)

      if (result?.error?.message === 'EXISTING_DATA') {
        return json({
          success: false,
          path: sourcePath,
          message: 'EXISTING_DATA',
          existingData: true
        })
      }

      return json({
        success: true,
        path: sourcePath,
        message: `Selected: ${sourcePath}`
      })
    } catch (error) {
      console.error('Error:', error)
      return json({
        success: false,
        error: error.message
      })
    }
  }

  // Handle backup/overwrite choice
  const sourcePath = formData.get('sourcePath')?.toString()
  const backupChoice = formData.get('action')?.toString() as BackupChoice

  if (!sourcePath) {
    return json({ success: false, message: 'No path selected' })
  }

  console.log('Processing conversion with:', { sourcePath, backupChoice })

  try {
    const options = {
      convertRomdata: formData.get('convertRomdata') !== 'false',
      convertSystems: formData.get('convertSystems') !== 'false',
      convertEmulators: formData.get('convertEmulators') !== 'false',
      convertMediaPanel: formData.get('convertMediaPanel') !== 'false'
    }

    console.log('Conversion options:', options)
    const result = await convertQuickPlayData(sourcePath, options, backupChoice)
    console.log('Conversion result:', result)

    if (!result?.success) {
      return json({
        success: false,
        message: result?.error ? `${result.error.component}: ${result.error.message}` : 'Conversion failed'
      })
    }

    return json({
      success: true,
      message: `Successfully converted files`,
      complete: true
    })
  } catch (error) {
    console.error('Conversion error:', error)
    return json({ success: false, message: error.message })
  }
}

export default function Convert() {
  useEffect(() => Modal.setAppElement('#root'), []) // Set the app element for react-modal (else it complains in console about aria)
  const [modalState, setModalState] = useState<ModalState>({ isOpen: true })
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const navigate = useNavigate()

  const [conversionOptions, setConversionOptions] = useState<ConversionOptions>({
    convertRomdata: true,
    convertSystems: true,
    convertEmulators: true,
    convertMediaPanel: true
  })

  // Simple effect to handle all state changes
  useEffect(() => {
    if (navigation.state === 'submitting') {
      setModalState(prev => ({ ...prev, isConverting: true, error: undefined }))
    } else if (actionData) {
      if (actionData.complete && actionData.success) {
        //on successful completion, show message briefly then close
        setModalState(prev => ({
          ...prev,
          isConverting: false,
          result: {
            success: true,
            message: actionData.message
          }
        }))
        setTimeout(() => navigate('/'), 1500)
      } else {
        //handle all other states (directory selection, errors, etc)
        setModalState(prev => ({
          ...prev,
          isConverting: false,
          selectedPath: actionData.path,
          error: actionData.error,
          result: actionData.success
            ? {
                success: true,
                message: actionData.message
              }
            : undefined
        }))
      }
    }
  }, [navigation.state, actionData, navigate])

  return (
    <Modal
      isOpen={modalState.isOpen}
      onRequestClose={() => {
        if (!modalState.isConverting) {
          navigate('/')
        }
      }}
      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-lg"
      overlayClassName="fixed inset-0 bg-black/50"
    >
      <div className="w-[32rem]">
        <h2 className="text-xl font-bold mb-4">Converting QuickPlay Data</h2>

        {modalState.isConverting ? (
          <div className="flex items-center mb-4">
            <div className="animate-spin mr-3 h-5 w-5 border-2 border-gray-500 border-t-transparent rounded-full"></div>
            <p>{modalState.selectedPath ? 'Converting files...' : 'Selecting folder...'}</p>
          </div>
        ) : (
          <>
            {!modalState.selectedPath ? (
              <>
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="intent" value="selectDirectory" />
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="convertRomdata"
                        checked={conversionOptions.convertRomdata}
                        onChange={e => setConversionOptions(prev => ({ ...prev, convertRomdata: e.target.checked }))}
                        className="mr-2"
                      />
                      Convert ROM data files
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="convertSystems"
                        checked={conversionOptions.convertSystems}
                        onChange={e => setConversionOptions(prev => ({ ...prev, convertSystems: e.target.checked }))}
                        className="mr-2"
                      />
                      Convert systems data
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="convertEmulators"
                        checked={conversionOptions.convertEmulators}
                        onChange={e => setConversionOptions(prev => ({ ...prev, convertEmulators: e.target.checked }))}
                        className="mr-2"
                      />
                      Convert emulators data
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="convertMediaPanel"
                        checked={conversionOptions.convertMediaPanel}
                        onChange={e => setConversionOptions(prev => ({ ...prev, convertMediaPanel: e.target.checked }))}
                        className="mr-2"
                      />
                      Convert media panel configuration
                    </label>
                  </div>
                  <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                    Select QuickPlay Folder
                  </button>
                </Form>
                {modalState.error && <p className="mt-4 text-red-600">{modalState.error}</p>}
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  {actionData?.existingData ? (
                    <>
                      <Form method="post">
                        <input type="hidden" name="sourcePath" value={modalState.selectedPath} />
                        <input type="hidden" name="action" value="backup" />
                        <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                          Backup & Continue
                        </button>
                      </Form>
                      <Form method="post">
                        <input type="hidden" name="sourcePath" value={modalState.selectedPath} />
                        <input type="hidden" name="action" value="overwrite" />
                        <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Overwrite</button>
                      </Form>
                    </>
                  ) : (
                    <Form method="post">
                      <input type="hidden" name="sourcePath" value={modalState.selectedPath} />
                      <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Convert</button>
                    </Form>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {modalState.result?.success && <p className="mt-4 text-green-600">{modalState.result.message}</p>}

        {!modalState.isConverting && (
          <button
            onClick={() => navigate('/')}
            className="mt-4 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Close
          </button>
        )}
      </div>
    </Modal>
  )
}
