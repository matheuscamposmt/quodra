// Minimal, XSS-safe markdown renderer for Linear issue descriptions shown on the
// client board. Strategy: escape ALL HTML first, then layer on a small, known-safe
// set of transforms (bold, italic, code, links, headings, lists). Output is meant
// for v-html. We never emit a tag we didn't construct ourselves.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(s: string): string {
  // inline code first so its contents aren't re-processed
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  // markdown links [text](url) — only http(s) URLs are allowed
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) =>
    /^https?:\/\//i.test(url) ? link(url, text) : text,
  )
  // bare http(s) URLs (skip ones already inside an attribute)
  s = s.replace(/(^|[^"=>/])(https?:\/\/[^\s<]+)/g, (_m, pre, url) => `${pre}${link(url, url)}`)
  return s
}

function link(url: string, text: string): string {
  return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`
}

export function renderMarkdown(src: string): string {
  if (!src || !src.trim()) return ''
  const lines = escapeHtml(src).split('\n')

  let html = ''
  let para: string[] = []
  let listOpen = false
  const flushPara = () => {
    if (para.length) { html += `<p>${para.map(inline).join('<br>')}</p>`; para = [] }
  }
  const closeList = () => { if (listOpen) { html += '</ul>'; listOpen = false } }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (line.trim() === '') { flushPara(); closeList(); continue }
    if (/^#{1,6}\s+/.test(line)) {
      flushPara(); closeList()
      html += `<h3>${inline(line.replace(/^#{1,6}\s+/, ''))}</h3>`
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      flushPara()
      if (!listOpen) { html += '<ul>'; listOpen = true }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`
      continue
    }
    para.push(line)
  }
  flushPara(); closeList()
  return html
}
