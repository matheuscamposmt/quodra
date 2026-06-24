import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '../server/utils/markdown'

describe('renderMarkdown', () => {
  it('escapes raw HTML to prevent XSS', () => {
    const out = renderMarkdown('<script>alert(1)</script>')
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script&gt;')
  })

  it('renders bold and italic', () => {
    expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>')
    expect(renderMarkdown('*it*')).toContain('<em>it</em>')
  })

  it('renders inline code', () => {
    expect(renderMarkdown('use `npm ci`')).toContain('<code>npm ci</code>')
  })

  it('linkifies http(s) links and adds rel/target', () => {
    const out = renderMarkdown('see https://example.com here')
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('target="_blank"')
  })

  it('renders markdown links but rejects javascript: scheme', () => {
    expect(renderMarkdown('[ok](https://a.com)')).toContain('href="https://a.com"')
    const bad = renderMarkdown('[x](javascript:alert(1))')
    expect(bad).not.toContain('javascript:')
  })

  it('renders headings and bullet lists', () => {
    expect(renderMarkdown('# Título')).toContain('<h3>Título</h3>')
    const list = renderMarkdown('- um\n- dois')
    expect(list).toContain('<li>um</li>')
    expect(list).toContain('<li>dois</li>')
  })

  it('turns blank lines into paragraph breaks and keeps single newlines as <br>', () => {
    expect(renderMarkdown('a\nb')).toContain('a<br>b')
  })

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('')
  })
})
