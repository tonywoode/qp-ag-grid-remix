import { useState, useEffect } from 'react'
import { VscChevronRight, VscChevronLeft, VscZoomIn, VscZoomOut } from 'react-icons/vsc'

type ImageNavigationProps = {
  images: string[]
  currentIndex: number
  onClose: () => void
}

export default function ImageNavigation({ images, currentIndex, onClose }: ImageNavigationProps) {
  const [scale, setScale] = useState(1)
  const [index, setIndex] = useState(currentIndex)

  useEffect(() => {
    // Calculate initial scale to fit the image to 80% of the screen size
    const img = new Image()
    img.src = images[currentIndex]
    img.onload = () => {
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight
      const imgWidth = img.width
      const imgHeight = img.height
      const widthScale = (screenWidth * 0.8) / imgWidth
      const heightScale = (screenHeight * 0.8) / imgHeight
      setScale(Math.min(widthScale, heightScale))
    }
  }, [currentIndex, images])

  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 5))
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.25))
  const nextImage = () => setIndex(prev => Math.min(prev + 1, images.length - 1))
  const prevImage = () => setIndex(prev => Math.max(prev - 1, 0))

  return (
    <div className="fixed w-full h-full top-0 left-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
      <div className="relative">
        <img
          src={images[index]}
          alt={`${index + 1}`}
          style={{ transform: `scale(${scale})`, maxWidth: '80vw', maxHeight: '80vh' }}
        />
        <div className="absolute bottom-0 w-full flex justify-center space-x-2 p-2 bg-white bg-opacity-75">
          <button onClick={prevImage} disabled={index === 0} className="p-2">
            <VscChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={zoomOut} disabled={scale <= 0.25} className="p-2">
            <VscZoomOut className="h-5 w-5" />
          </button>
          <button onClick={zoomIn} disabled={scale >= 5} className="p-2">
            <VscZoomIn className="h-5 w-5" />
          </button>
          <button onClick={nextImage} disabled={index === images.length - 1} className="p-2">
            <VscChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
      <button onClick={onClose} className="absolute top-0 right-0 p-4 text-white">
        Close
      </button>
    </div>
  )
}