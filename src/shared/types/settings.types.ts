export interface SettingsEntry {
  key: string
  value: string
}

export interface SettingsExport {
  version: string
  exportedAt: string
  settings: Record<string, string>
}
