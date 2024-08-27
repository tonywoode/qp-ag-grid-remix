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
    <div className="relative w-full h-full bg-slate-200/70">
      {/* why dont we need this prop on prev line prev there: pdfSlick"> */}
      <div className="flex-1 relative h-full">
        <PDFSlickViewer {...{ viewerRef, usePDFSlickStore }} />
        <PDFNavigation {...{ usePDFSlickStore }} />
      </div>
    </div>
  )
}
export default SimplePDFViewer
