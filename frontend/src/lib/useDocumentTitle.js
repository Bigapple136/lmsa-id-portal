import { useEffect } from 'react'

const SUFFIX = 'LMSA ID Portal'

// Every route used to share the one static <title> from index.html, so tabs,
// bookmarks and browser history were indistinguishable — and in a single-page
// app the document title is the main "where am I now" signal a screen reader
// announces on navigation.
//
// Pass the page-specific part only; the portal name is appended.
export default function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · ${SUFFIX}` : SUFFIX
    return () => {
      document.title = previous
    }
  }, [title])
}
