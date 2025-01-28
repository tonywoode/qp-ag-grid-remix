import { useState, useEffect } from 'react'
import fs from 'fs'
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
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'selectDirectory') {
    const result = await electron.dialog.showOpenDialog({
      message: "Select original QuickPlay install folder (should contain 'Data' and 'Dats' dirs)",
      properties: ['openDirectory']
    })

    if (result.canceled || !result.filePaths.length) {
      return json({ success: false, message: 'No folder selected' })
    }

    const sourcePath = result.filePaths[0]
    const options = {
      convertRomdata: formData.get('convertRomdata') === 'true',
      convertSystems: formData.get('convertSystems') === 'true',
      convertEmulators: formData.get('convertEmulators') === 'true',
      convertMediaPanel: formData.get('convertMediaPanel') === 'true'
    }

    // Check for existing directories before proceeding
    if (options.convertRomdata && fs.existsSync('data')) {
      return json({
        success: false,
        path: sourcePath,
        message: 'EXISTING_DATA',
        existingData: true,
        options
      })
    }

    if ((options.convertSystems || options.convertEmulators || options.convertMediaPanel) && fs.existsSync('dats')) {
      return json({
        success: false,
        path: sourcePath,
        message: 'EXISTING_DATS',
        existingData: true,
        options
      })
    }

    return json({
      success: true,
      path: sourcePath,
      message: `Selected: ${sourcePath}`,
      options
    })
  }

  const sourcePath = formData.get('sourcePath')?.toString()
  const backupChoice = formData.get('action')?.toString() as BackupChoice
  const options = JSON.parse(formData.get('options') as string)

  if (!sourcePath) {
    return json({ success: false, message: 'No path selected' })
  }

  try {
    const result = await convertQuickPlayData(sourcePath, options, backupChoice)
    return json({
      success: result.success,
      message: result.success ? 'Successfully converted files' : result.error?.message,
      complete: result.success
    })
  } catch (error) {
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
              <Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="selectDirectory" />
                <div className="space-y-2">
                  {Object.entries(conversionOptions).map(([key, value]) => (
                    <label key={key} className="flex items-center">
                      <input
                        type="checkbox"
                        name={key}
                        checked={value}
                        value="true"
                        onChange={e =>
                          setConversionOptions(prev => ({
                            ...prev,
                            [key]: e.target.checked
                          }))
                        }
                        className="mr-2"
                      />
                      {key
                        .replace(/convert/, '')
                        .replace(/([A-Z])/g, ' $1')
                        .trim()}{' '}
                      data
                    </label>
                  ))}
                </div>
                <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                  Select QuickPlay Folder
                </button>
              </Form>
            ) : (
              <Form method="post">
                <input type="hidden" name="sourcePath" value={modalState.selectedPath} />
                <input type="hidden" name="options" value={JSON.stringify(actionData?.options)} />
                {actionData?.existingData ? (
                  <div className="flex gap-2">
                    <button
                      name="action"
                      value="backup"
                      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                      Backup & Continue
                    </button>
                    <button
                      name="action"
                      value="overwrite"
                      className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                    >
                      Overwrite
                    </button>
                  </div>
                ) : (
                  <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Convert</button>
                )}
              </Form>
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
