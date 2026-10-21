import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: true });
markdown.validateLink = url => /^https?:\/\//i.test(url);
export function renderMarkdown(source: string): string { return markdown.render(source); }
export function escapeHtml(source: string): string {
  return source.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
