export function applyTheme(theme = 'dark') {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark'
}

