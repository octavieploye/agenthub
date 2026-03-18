import { AGENT_COLOR_PALETTE } from '@shared/constants/defaults'

interface FolderColorPickerProps {
  currentColor: string
  onSelect: (color: string) => void
  onClose: () => void
}

export default function FolderColorPicker({ currentColor, onSelect, onClose }: FolderColorPickerProps): React.JSX.Element {
  return (
    <div
      className="absolute z-10 p-2 rounded-xl shadow-lg border border-white/15 backdrop-blur-xl"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.08) 100%)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap gap-1.5 max-w-[140px]">
        {AGENT_COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className={`w-5 h-5 rounded-full border-2 transition-all ${
              currentColor === color ? 'border-base-content scale-110' : 'border-transparent hover:border-base-content/30'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => {
              onSelect(color)
              onClose()
            }}
          />
        ))}
      </div>
      <input
        type="color"
        value={currentColor}
        onChange={(e) => {
          onSelect(e.target.value)
          onClose()
        }}
        className="w-full h-5 mt-1.5 rounded cursor-pointer border-0 p-0"
        title="Custom color"
      />
    </div>
  )
}
