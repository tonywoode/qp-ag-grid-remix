import { usePDFSlick } from '@pdfslick/react'
import PDFNavigation from './PDFNavigation'

type PDFViewerAppProps = {
  pdfFilePath: ArrayBuffer
}

const SimplePDFViewer = ({ pdfFilePath }: PDFViewerAppProps) => {
  const { viewerRef, usePDFSlickStore, PDFSlickViewer } = usePDFSlick(pdfFilePath, {
    // singlePageViewer: true,
    scaleValue: 'page-width' //page-width/page-fit/auto - fit vs width doesn't seems to make a difference with 50%/100% container ratio?
  })

  return (
    <>
      <PDFSlickViewer {...{ viewerRef, usePDFSlickStore }} />
      <PDFNavigation {...{ usePDFSlickStore }} />
    </>
  )
}
export default SimplePDFViewer
