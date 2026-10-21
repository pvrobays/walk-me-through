import { expect, it } from 'vitest';
import { renderMarkdown } from '../src/markdown';

it('renders Markdown while neutralizing HTML and command links', () => {
  const html = renderMarkdown('**bold** *italic* `code`\n\n- item\n\n```ts\nconst x = 1;\n```\n\n<script>alert(1)</script><img src=x onerror=alert(1)>\n\n[run](command:evil) [web](https://example.com)');
  expect(html).toContain('<strong>bold</strong>'); expect(html).toContain('<em>italic</em>');
  expect(html).toContain('<code>code</code>'); expect(html).toContain('<li>item</li>');
  expect(html).not.toMatch(/<script|<img|href="command:/);
  expect(html).toContain('href="https://example.com"');
});
