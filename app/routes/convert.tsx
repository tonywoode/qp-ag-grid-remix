import { useState, useEffect } from 'react'
import { Form, useActionData, useNavigate, useNavigation, useRevalidator, useSubmit } from '@remix-run/react'
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
  const [modalState, setModalState] = useState<ModalState>({ isOpen: true }) // Open by default in route
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const navigate = useNavigate()
  const submit = useSubmit()
  const revalidator = useRevalidator()

  useEffect(() => {
    if (actionData?.success && actionData?.complete) {
      // First revalidate
      revalidator.revalidate()
      // Then set a small timeout before navigating away
      const timer = setTimeout(() => {
        setModalState({ isOpen: false })
        navigate('/', { replace: true })
      }, 500)
      return () => clearTimeout(timer)
    } else if (actionData) {
      setModalState(prev => ({
        ...prev,
        isConverting: false,
        selectedPath: actionData.path,
        error: actionData.error,
        result: {
          success: actionData.success,
          message: actionData.message
        }
      }))
    }
  }, [actionData, navigate, revalidator])

  // Add this to handle the close action
  const handleClose = () => {
    if (actionData?.success && actionData?.complete) {
      // If we're closing after a successful conversion, revalidate first
      revalidator.revalidate()
      setTimeout(() => {
        setModalState({ isOpen: false })
        navigate('/', { replace: true })
      }, 500)
    } else {
      setModalState({ isOpen: false })
      navigate('/', { replace: true })
    }
  }

  return (
    <Modal
      isOpen={modalState.isOpen}
      onRequestClose={() => {
        if (!modalState.isConverting) {
          handleClose()
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
            <p>Processing...</p>
          </div>
        ) : (
          <>
            {actionData?.complete ? (
              <div className="mb-4">
                <p className="text-green-600 mb-2">{actionData.message}</p>
                <button onClick={handleClose} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                  Close
                </button>
              </div>
            ) : (
              <>
                {!modalState.selectedPath ? (
                  <>
                    {modalState.result?.success ? (
                      <div className="mb-4">
                        <p className="text-green-600 mb-2">{modalState.result.message}</p>
                      </div>
                    ) : (
                      <>
                        <Form method="post">
                          <input type="hidden" name="intent" value="selectDirectory" />
                          <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                            Select QuickPlay Folder
                          </button>
                        </Form>
                        {modalState.error && <p className="mt-4 text-red-600">{modalState.error}</p>}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mb-4 text-sm text-gray-600">Selected: {modalState.selectedPath}</p>
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
                            <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
                              Overwrite
                            </button>
                          </Form>
                        </>
                      ) : (
                        <Form method="post">
                          <input type="hidden" name="sourcePath" value={modalState.selectedPath} />
                          <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                            Convert
                          </button>
                        </Form>
                      )}
                    </div>
                  </>
                )}
                <button
                  onClick={handleClose}
                  className="mt-4 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Close
                </button>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
