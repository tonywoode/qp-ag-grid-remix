import { usePDFSlick } from '@pdfslick/react'
import PDFNavigation from './PDFNavigation'

type PDFViewerAppProps = {
  pdfFilePath: ArrayBuffer
}

const SimplePDFViewer = ({ pdfFilePath }: PDFViewerAppProps) => {
  const { viewerRef, usePDFSlickStore, PDFSlickViewer } = usePDFSlick(pdfFilePath, {
    singlePageViewer: true,
    scaleValue: 'page-fit'
  })

  return (
    <>
      <PDFSlickViewer {...{ viewerRef, usePDFSlickStore }} />
      <PDFNavigation {...{ usePDFSlickStore }} />
    </>
  )
}
export default SimplePDFViewer
