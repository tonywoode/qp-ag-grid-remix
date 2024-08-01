import { usePDFSlick } from '@pdfslick/react'
// import PDFNavigation from "./PDFNavigation";
// import '@pdfslick/react/dist/pdf_viewer.css'

// TODO: better way to resolve the pdf.worker for pdfjs - (currently copying it during bootstrapping in desktop/index.js
//  pdf.js wants to resolve it from a relative route, so currently copying it into public/build
// https://github.com/wojtekmaj/react-pdf?tab=readme-ov-file#import-worker-recommended
// import pdfjs from 'pdfjs-dist'
// import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.js'
// console.log('pdfjs is empty here?')
// console.log(pdfjs)
// pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.js', import.meta.url).toString()

type PDFViewerAppProps = {
  pdfFilePath: ArrayBuffer
}

const SimplePDFViewer = ({ pdfFilePath }: PDFViewerAppProps) => {
  const { viewerRef, usePDFSlickStore, PDFSlickViewer } = usePDFSlick(pdfFilePath, {
    singlePageViewer: true,
    scaleValue: 'page-fit'
  })

  return (
    <div className="absolute inset-0 bg-slate-200/70 pdfSlick">
      <div className="flex-1 relative h-full">
        <PDFSlickViewer {...{ viewerRef, usePDFSlickStore }} />
        {/* <PDFNavigation {...{ usePDFSlickStore }} /> */}
      </div>
    </div>
  )
}

export default SimplePDFViewer
