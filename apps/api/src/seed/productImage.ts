import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      default:
        return '&quot;';
    }
  });
}

function wrapText(value: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines;
}

export interface PlaceholderImageInput {
  fileName: string;
  title: string;
  subtitle: string;
  colors: [string, string];
  variant: number;
}

/**
 * Seed images are generated locally as SVG files so the catalog renders without
 * bundling third-party product photography.
 */
export async function writePlaceholderImage(
  uploadsDir: string,
  input: PlaceholderImageInput,
): Promise<string> {
  await mkdir(uploadsDir, { recursive: true });

  const [from, to] = input.colors;
  const lines = wrapText(input.title, 22, 3);
  const body = lines
    .map((line, index) => `<tspan x="400" dy="${index === 0 ? 0 : 46}">${escapeXml(line)}</tspan>`)
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" role="img" aria-label="${escapeXml(input.title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${to}"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <circle cx="${input.variant % 2 === 0 ? 640 : 160}" cy="170" r="110" fill="${from}" opacity="0.18"/>
  <rect x="290" y="${180 + input.variant * 6}" width="220" height="330" rx="34" fill="${from}" opacity="0.92"/>
  <rect x="345" y="${140 + input.variant * 6}" width="110" height="52" rx="16" fill="${from}"/>
  <rect x="320" y="${300 + input.variant * 6}" width="160" height="96" rx="12" fill="#ffffff" opacity="0.88"/>
  <text x="400" y="${360 + input.variant * 6}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="${from}">DrDo</text>
  <text x="400" y="600" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="600" fill="#1f2933">${body}</text>
  <text x="400" y="742" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#52606d">${escapeXml(input.subtitle)}</text>
</svg>
`;

  const filePath = path.join(uploadsDir, input.fileName);
  await writeFile(filePath, svg, 'utf8');
  return filePath;
}
