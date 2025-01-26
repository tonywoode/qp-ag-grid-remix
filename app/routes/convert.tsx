import { useState, useEffect } from 'react'
import { Form, useActionData, useNavigate, useNavigation } from '@remix-run/react'
import { json } from '@remix-run/node'
import Modal from 'react-modal'
import electron from '~/electron.server'
import { convertQuickPlayData, validateQuickPlayDirectory } from '~/utils/convertQuickPlayData.server'
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
    try {
      await validateQuickPlayDirectory(sourcePath)
      return json({
        success: true,
        path: sourcePath,
        message: `Selected: ${sourcePath}`
      })
    } catch (error) {
      return json({
        success: false,
        error: error.message
      })
    }
  }

  const sourcePath = formData.get('sourcePath')
  const action = formData.get('action')

  if (!sourcePath) {
    return json({ success: false, message: 'No path selected' })
  }

  try {
    const convertedFiles = await convertQuickPlayData(sourcePath.toString(), 'data', action?.toString() as BackupChoice)
    return json({
      success: true,
      message: `Successfully converted ${convertedFiles} romdata files`,
      complete: true
    })
  } catch (error) {
    if (error.message === 'EXISTING_DATA') {
      return json({
        success: false,
        path: sourcePath,
        message: 'EXISTING_DATA',
        existingData: true
      })
    }
    return json({ success: false, message: error.message })
  }
}

export default function Convert() {
  useEffect(() => Modal.setAppElement('#root'), []) // Set the app element for react-modal (else it complains in console about aria)
  const [modalState, setModalState] = useState<ModalState>({ isOpen: true })
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const navigate = useNavigate()

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
            <p>
              {modalState.selectedPath ? (
                <>
                  Converting files from: <span className="text-sm text-gray-600">{modalState.selectedPath}</span>
                </>
              ) : (
                'Selecting folder...'
              )}
            </p>
          </div>
        ) : (
          <>
            {!modalState.selectedPath ? (
              <>
                <Form method="post">
                  <input type="hidden" name="intent" value="selectDirectory" />
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
