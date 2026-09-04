import LayoutMapper from '../../components/LayoutMapper'
import { useDashboard } from './DashboardContext'

export default function LayoutTab() {
  const {
    activeTemplateBack,
    activeTemplateFront,
    cardLayout,
    fieldSides,
    fields,
    loadLayoutHistory,
    revertLayout,
    saveFieldSides,
    saveLayout,
  } = useDashboard()

  return (
  <div>
              <div className="section-title">
                Card layout mapper <span className="new-badge">Front & Back</span>
              </div>
              <p className="section-desc">
                Configure field positions for both sides of the ID card. Each side uses its own template
                and layout. Drag fields on the preview, adjust properties in the panel, then save. Use the
                Front/Back tabs in the mapper to switch sides.
              </p>
  
              <LayoutMapper
                enabledFields={fields}
                templateUrlFront={activeTemplateFront?.file_url}
                templateUrlBack={activeTemplateBack?.file_url}
                templateNameFront={activeTemplateFront?.file_name}
                templateNameBack={activeTemplateBack?.file_name}
                initialLayout={cardLayout}
                onSave={saveLayout}
                suggestedLayoutFront={activeTemplateFront?.suggested_layout_front}
                suggestedLayoutBack={activeTemplateBack?.suggested_layout_back}
                fieldSides={fieldSides}
                onSaveFieldSides={saveFieldSides}
                onLoadLayoutHistory={loadLayoutHistory}
                onRevertLayout={revertLayout}
              />
            </div>
  )
}
