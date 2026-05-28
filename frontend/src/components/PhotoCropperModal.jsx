import { useEffect, useRef, useState, useCallback } from 'react'
import Cropper from 'cropperjs'

const ASPECT_RATIO = 3 / 4
const OUTPUT_WIDTH = 300
const OUTPUT_HEIGHT = 400

export default function PhotoCropperModal({ file, onCrop, onCancel }) {
  const imgRef = useRef(null)
  const cropperRef = useRef(null)
  const [imageUrl, setImageUrl] = useState('')

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (!imageUrl || !imgRef.current) return
    if (cropperRef.current) {
      cropperRef.current.destroy()
      cropperRef.current = null
    }

    const c = new Cropper(imgRef.current)
    cropperRef.current = c

    const sel = c.getCropperSelection()
    if (sel) {
      sel.aspectRatio = ASPECT_RATIO
      sel.initialCoverage = 0.8
    }

    return () => {
      if (cropperRef.current) {
        cropperRef.current.destroy()
        cropperRef.current = null
      }
    }
  }, [imageUrl])

  const handleZoomIn = useCallback(() => {
    const sel = cropperRef.current?.getCropperSelection()
    if (sel) sel.$zoom(0.1)
  }, [])

  const handleZoomOut = useCallback(() => {
    const sel = cropperRef.current?.getCropperSelection()
    if (sel) sel.$zoom(-0.1)
  }, [])

  const handleReset = useCallback(() => {
    const sel = cropperRef.current?.getCropperSelection()
    if (sel) sel.$reset()
  }, [])

  const handleCrop = useCallback(async () => {
    const sel = cropperRef.current?.getCropperSelection()
    if (!sel) return
    try {
      const canvas = await sel.$toCanvas({ width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT })
      canvas.toBlob((blob) => {
        const croppedFile = new File([blob], file.name.replace(/\.\w+$/, '.png'), { type: 'image/png' })
        onCrop(croppedFile)
      }, 'image/png')
    } catch (err) {
      console.error('Crop failed:', err)
    }
  }, [file, onCrop])

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal cropper-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>Crop Photo</span>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        {imageUrl && (
          <div className="cropper-container-wrapper">
            <img ref={imgRef} src={imageUrl} alt="Crop preview" style={{ maxWidth: '100%' }} />
          </div>
        )}

        <div className="cropper-controls">
          <button className="btn-outline" onClick={handleZoomOut} title="Zoom Out">−</button>
          <button className="btn-outline" onClick={handleReset} title="Reset">⟲</button>
          <button className="btn-outline" onClick={handleZoomIn} title="Zoom In">+</button>
        </div>

        <div className="cropper-hint">
          Drag to reposition · Resize the crop box · {OUTPUT_WIDTH}×{OUTPUT_HEIGHT}px output
        </div>

        <div className="btn-row" style={{ marginTop: '12px' }}>
          <button className="btn-gold" onClick={handleCrop}>Crop & Confirm</button>
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
