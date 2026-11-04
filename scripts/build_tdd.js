const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Read Markdown content
const mdPath = path.join(__dirname, '..', 'TECHNICAL_DESIGN_DOCUMENT.md');
const mdRaw = fs.readFileSync(mdPath, 'utf8');

// Simple, robust markdown to structured HTML parser
function convertMarkdownToHtml(md) {
  const lines = md.split(/\r?\n/);
  let html = [];
  let inTable = false;
  let inCode = false;
  let codeBlock = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCode) {
        html.push(`<pre class="code-block"><code>${codeBlock.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`);
        codeBlock = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBlock.push(line);
      continue;
    }

    // Horizontal Rule
    if (line.trim() === '---') {
      if (inList) { html.push('</ul>'); inList = false; }
      if (inTable) { html.push('</tbody></table>'); inTable = false; }
      html.push('<hr class="divider" />');
      continue;
    }

    // Tables
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (inList) { html.push('</ul>'); inList = false; }
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (cells.every(c => /^:?-+:?$/.test(c))) {
        // Table header separator line, ignore
        continue;
      }
      if (!inTable) {
        inTable = true;
        html.push('<div class="table-container"><table class="report-table"><thead><tr>');
        cells.forEach(c => html.push(`<th>${formatInline(c)}</th>`));
        html.push('</tr></thead><tbody>');
      } else {
        html.push('<tr>');
        cells.forEach(c => html.push(`<td>${formatInline(c)}</td>`));
        html.push('</tr>');
      }
      continue;
    } else if (inTable) {
      html.push('</tbody></table></div>');
      inTable = false;
    }

    // Lists
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      if (!inList) {
        inList = true;
        html.push('<ul class="report-list">');
      }
      html.push(`<li>${formatInline(line.trim().substring(2))}</li>`);
      continue;
    } else if (inList && line.trim() === '') {
      html.push('</ul>');
      inList = false;
    }

    // Images
    const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)/);
    if (imgMatch) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`
        <figure class="diagram-figure">
          <img src="${imgMatch[2]}" alt="${imgMatch[1]}" class="diagram-img" />
          <figcaption class="diagram-caption">${imgMatch[1]}</figcaption>
        </figure>
      `);
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h1 class="doc-title">${formatInline(line.substring(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h2 class="section-h2">${formatInline(line.substring(3))}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h3 class="section-h3">${formatInline(line.substring(4))}</h3>`);
      continue;
    }
    if (line.startsWith('#### ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h4 class="section-h4">${formatInline(line.substring(5))}</h4>`);
      continue;
    }

    // Math block lines
    if (line.trim().startsWith('$$') && line.trim().endsWith('$$')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<div class="equation-block">${line.trim()}</div>`);
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      continue;
    }

    // Paragraph
    html.push(`<p class="report-paragraph">${formatInline(line)}</p>`);
  }

  if (inTable) html.push('</tbody></table></div>');
  if (inList) html.push('</ul>');
  if (inCode) html.push(`</code></pre>`);

  return html.join('\n');
}

function formatInline(str) {
  // Bold
  str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  str = str.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline Code
  str = str.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  return str;
}

const bodyHtml = convertMarkdownToHtml(mdRaw);

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ThreadFlow: Technical Design Document (v3.0.0)</title>
  <!-- KaTeX for crisp offline/online vector mathematical formulas -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"
          onload="renderMathInElement(document.body, {delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}]});"></script>
  <style>
    @page {
      size: A4;
      margin: 20mm 18mm 20mm 18mm;
      @bottom-right {
        content: counter(page);
        font-family: 'Times New Roman', Times, serif;
        font-size: 9pt;
      }
      @bottom-left {
        content: "ThreadFlow Engineering Design Report — v3.0.0";
        font-family: 'Times New Roman', Times, serif;
        font-size: 8.5pt;
        color: #444;
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 10.5pt;
      line-height: 1.45;
      color: #111;
      background: #FFFFFF;
      margin: 0;
      padding: 0;
    }

    .doc-container {
      max-width: 820px;
      margin: 0 auto;
      padding: 20px;
    }

    /* Formal Cover Header */
    .doc-title {
      font-size: 20pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 0;
      margin-bottom: 6px;
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
    }

    .section-h2 {
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-top: 24px;
      margin-bottom: 8px;
      border-bottom: 1px solid #111;
      padding-bottom: 4px;
      page-break-after: avoid;
    }

    .section-h3 {
      font-size: 11pt;
      font-weight: bold;
      margin-top: 16px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }

    .section-h4 {
      font-size: 10.5pt;
      font-style: italic;
      font-weight: bold;
      margin-top: 12px;
      margin-bottom: 4px;
      page-break-after: avoid;
    }

    .report-paragraph {
      margin-top: 0;
      margin-bottom: 8px;
      text-align: justify;
      text-justify: inter-word;
    }

    .report-list {
      margin-top: 0;
      margin-bottom: 10px;
      padding-left: 24px;
    }

    .report-list li {
      margin-bottom: 4px;
      text-align: justify;
    }

    .divider {
      border: 0;
      border-top: 1px solid #999;
      margin: 18px 0;
    }

    /* Formal Academic Table Styling */
    .table-container {
      margin: 12px 0 16px 0;
      page-break-inside: avoid;
      overflow-x: auto;
    }

    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
      line-height: 1.35;
    }

    .report-table th, .report-table td {
      border: 1px solid #333;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }

    .report-table th {
      background-color: #F0F0F0;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 8.5pt;
      letter-spacing: 0.3px;
    }

    .report-table tr:nth-child(even) td {
      background-color: #FAFAFA;
    }

    /* Math Formula Blocks */
    .equation-block {
      margin: 10px 0;
      padding: 8px 12px;
      background: #FBFBFB;
      border: 1px solid #DDD;
      border-left: 3px solid #222;
      text-align: center;
      page-break-inside: avoid;
      font-size: 11pt;
    }

    /* Code Blocks */
    .code-block {
      background: #F8F8F8;
      border: 1px solid #CCC;
      padding: 10px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 8.5pt;
      line-height: 1.3;
      page-break-inside: avoid;
      overflow-x: auto;
      margin: 10px 0;
    }

    .inline-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 9pt;
      background: #EEE;
      padding: 1px 4px;
      border-radius: 2px;
    }

    /* Schematic Figure Blocks */
    .diagram-figure {
      margin: 16px 0;
      text-align: center;
      page-break-inside: avoid;
    }

    .diagram-img {
      max-width: 100%;
      height: auto;
      border: 1px solid #333;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .diagram-caption {
      font-size: 9pt;
      font-weight: bold;
      margin-top: 6px;
      text-align: center;
      color: #333;
    }

    @media print {
      body {
        font-size: 10pt;
      }
      .doc-container {
        padding: 0;
      }
      .section-h2 {
        page-break-before: auto;
      }
    }
  </style>
</head>
<body>
  <div class="doc-container">
    ${bodyHtml}
  </div>
</body>
</html>
`;

const htmlOutputPath = path.join(__dirname, '..', 'submission', 'Technical_Design_Document.html');
fs.writeFileSync(htmlOutputPath, fullHtml, 'utf8');
console.log('✅ Generated HTML report at:', htmlOutputPath);

// 2. Invoke headless Microsoft Edge to compile publication-grade PDF
const pdfOutputPath = path.join(__dirname, '..', 'submission', 'Technical_Design_Document.pdf');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

try {
  console.log('Compiling PDF via Headless Edge...');
  // Using file URI for accurate asset resolution
  const fileUri = 'file:///' + htmlOutputPath.replace(/\\/g, '/');
  const edgeCommand = `"${edgePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --virtual-time-budget=5000 --print-to-pdf="${pdfOutputPath}" "${fileUri}"`;
  execSync(edgeCommand, { stdio: 'inherit' });
  console.log('✅ Generated PDF successfully at:', pdfOutputPath);
} catch (err) {
  console.error('Error generating PDF with Edge:', err);
}
