import React, { useState, useEffect } from 'react'
import { VscChevronLeft, VscChevronRight, VscZoomIn, VscZoomOut } from 'react-icons/vsc'

const ImageNavigation = ({ images, currentIndex, onClose, updateDimensions }) => {
  const [index, setIndex] = useState(currentIndex)
  const [scale, setScale] = useState(1)
  const [loading, setLoading] = useState(true)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    setLoading(true)
    const img = new Image()
    img.src = images[index]
    img.onload = () => {
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight
      const imgWidth = img.width
      const imgHeight = img.height
      const widthScale = (screenWidth * 0.8) / imgWidth
      const heightScale = (screenHeight * 0.8) / imgHeight
      const scale = Math.min(widthScale, heightScale)
      setScale(scale)
      setImageDimensions({ width: imgWidth, height: imgHeight })
      updateDimensions({ width: `${imgWidth * scale}px`, height: `${imgHeight * scale}px` })
      setLoading(false) // Set loading to false after updating dimensions
    }
  }, [index, images, updateDimensions])

  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 5))
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.25))
  const nextImage = () => setIndex(prev => Math.min(prev + 1, images.length - 1))
  const prevImage = () => setIndex(prev => Math.max(prev - 1, 0))

  return (
    <div className="fixed top-0 left-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
      <div className="relative" style={{ width: 'auto', height: 'auto' }}>
        {!loading && (
          <img
            src={images[index]}
            alt={`${index + 1}`}
            style={{
              width: `${imageDimensions.width * scale}px`,
              height: `${imageDimensions.height * scale}px`,
              objectFit: 'contain',
              transition: 'opacity 0.3s ease-in-out'
            }}
          />
        )}
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
    </div>
  )
}

export default ImageNavigation
