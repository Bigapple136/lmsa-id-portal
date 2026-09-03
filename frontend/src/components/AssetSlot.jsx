import { useRef } from 'react'

// One image "slot" on the Edit Student form — the photo or the signature.
//
// The slot has four visual states, all resolved from props so the parent
// owns the truth:
//   empty        — nothing on file and nothing staged            → "Upload"
//   current      — a file on record, nothing staged              → "Replace" / "Remove"
//   staged       — a new file picked but not yet saved           → "Change" / "Undo"
//   removing     — the current file is marked for removal on save → "Undo"
//
// Nothing is destructive until the parent submits the form: "Remove" only
// flips a flag that the backend honours on save, and "Undo" clears it. This
// keeps the modal's Cancel button a true escape hatch (Nielsen #3) while
// avoiding a second confirmation dialog for something reversible.
export default function AssetSlot({
  id,
  label,
  accept,
  hint,
  currentUrl,
  stagedFile,
  markedForRemoval,
  onPick,
  onRemove,
  onUndo,
  thumbStyle,
  emptyText = 'No file yet',
  currentText = 'Current file',
  removeLabel = 'Remove',
}) {
  const inputRef = useRef(null)

  function openPicker() {
    inputRef.current?.click()
  }

  function onZoneKeyDown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    openPicker()
  }

  const state = stagedFile
    ? 'staged'
    : markedForRemoval
      ? 'removing'
      : currentUrl
        ? 'current'
        : 'empty'

  return (
    <div className="field-group asset-slot" data-state={state}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          // allow re-picking the same file after an Undo
          e.target.value = ''
        }}
      />

      <div className="asset-slot-row">
        <div
          className="upload-zone asset-slot-zone"
          role="button"
          tabIndex={0}
          aria-label={
            state === 'empty'
              ? `Upload ${label.toLowerCase()}`
              : `Choose a replacement ${label.toLowerCase()}`
          }
          onClick={openPicker}
          onKeyDown={onZoneKeyDown}
        >
          {state === 'current' && (
            <div className="asset-slot-preview">
              <img src={currentUrl} alt="" style={thumbStyle} />
              <span className="upload-text">
                {currentText} · <span className="upload-link">Replace</span>
              </span>
            </div>
          )}
          {state === 'staged' && (
            <div className="asset-slot-preview">
              <span className="upload-selected asset-slot-filename" title={stagedFile.name}>
                {stagedFile.name}
              </span>
              <span className="upload-text">
                Ready to upload · <span className="upload-link">Change</span>
              </span>
            </div>
          )}
          {state === 'removing' && (
            <div className="asset-slot-preview asset-slot-preview--removing">
              <img src={currentUrl} alt="" style={thumbStyle} aria-hidden="true" />
              <span className="upload-text">
                Will be removed on save · <span className="upload-link">Upload new instead</span>
              </span>
            </div>
          )}
          {state === 'empty' && (
            <p className="upload-text">
              {emptyText} · <span className="upload-link">Upload</span>
            </p>
          )}
        </div>

        {state === 'current' && (
          <button
            type="button"
            className="btn-secondary asset-slot-action asset-slot-action--remove"
            onClick={onRemove}
            aria-label={`${removeLabel} ${label.toLowerCase()}`}
          >
            {removeLabel}
          </button>
        )}
        {(state === 'staged' || state === 'removing') && (
          <button
            type="button"
            className="btn-secondary asset-slot-action"
            onClick={onUndo}
            aria-label={`Undo ${state === 'staged' ? 'replacement' : 'removal'} of ${label.toLowerCase()}`}
          >
            Undo
          </button>
        )}
      </div>

      {hint && state !== 'removing' && <p className="upload-hint asset-slot-hint">{hint}</p>}
      {state === 'removing' && (
        <p className="asset-slot-notice" role="status">
          The {label.toLowerCase()} is deleted from storage when you save. The card will show the
          template placeholder until a new one is uploaded.
        </p>
      )}
    </div>
  )
}
