const ICON_MAP: Record<string, string> = {
  // Directories
  directory: '📁',
  // Code
  '.ts': '🔷', '.tsx': '🔷', '.js': '🟡', '.jsx': '🟡', '.mjs': '🟡', '.cjs': '🟡',
  '.py': '🐍', '.rs': '🦀', '.go': '🔵', '.java': '☕', '.rb': '💎',
  '.php': '🐘', '.swift': '🦅', '.kt': '🟪', '.c': '⚙️', '.cpp': '⚙️', '.h': '⚙️',
  '.cs': '🟣', '.vue': '💚', '.svelte': '🧡',
  // Config
  '.json': '📋', '.yaml': '📋', '.yml': '📋', '.toml': '📋',
  '.env': '🔒', '.ini': '📋', '.xml': '📋',
  // Markup / Docs
  '.md': '📝', '.mdx': '📝', '.txt': '📄', '.rst': '📄',
  '.html': '🌐', '.htm': '🌐', '.css': '🎨', '.scss': '🎨', '.less': '🎨',
  // Data / DB
  '.sql': '🗄️', '.graphql': '🔮', '.gql': '🔮',
  // Shell
  '.sh': '💻', '.bash': '💻', '.zsh': '💻',
  // Images
  '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️', '.gif': '🖼️', '.svg': '🖼️', '.webp': '🖼️',
  // Build / Config files
  '.dockerfile': '🐳', '.lock': '🔒',
  // Generic
  default: '📄'
}

const FILENAME_MAP: Record<string, string> = {
  'Dockerfile': '🐳',
  'Makefile': '⚙️',
  '.gitignore': '🙈',
  '.env': '🔒',
  '.env.local': '🔒',
  'package.json': '📦',
  'tsconfig.json': '🔷',
  'README.md': '📖'
}

export function getFileIcon(name: string, type: 'file' | 'directory'): string {
  if (type === 'directory') return ICON_MAP.directory

  if (FILENAME_MAP[name]) return FILENAME_MAP[name]

  const dotIdx = name.lastIndexOf('.')
  if (dotIdx >= 0) {
    const ext = name.slice(dotIdx).toLowerCase()
    if (ICON_MAP[ext]) return ICON_MAP[ext]
  }

  return ICON_MAP.default
}
