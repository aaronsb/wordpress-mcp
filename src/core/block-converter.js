/**
 * Block Converter
 * 
 * Converts between markdown and WordPress block format
 * Provides the foundation for block-based content creation
 */

export class BlockConverter {
  constructor() {
    // Block type mappings
    this.blockTypes = {
      heading1: 'core/heading',
      heading2: 'core/heading',
      heading3: 'core/heading',
      heading4: 'core/heading',
      heading5: 'core/heading',
      heading6: 'core/heading',
      paragraph: 'core/paragraph',
      list: 'core/list',
      quote: 'core/quote',
      code: 'core/code',
      image: 'core/image',
      separator: 'core/separator',
      table: 'core/table',
    };
  }

  /**
   * Convert markdown content to WordPress blocks
   * @param {string} markdown - Markdown content to convert
   * @returns {string} WordPress block-formatted HTML
   */
  markdownToBlocks(markdown) {
    const lines = markdown.split('\n');
    const blocks = [];
    let currentBlock = null;
    let listItems = [];
    let inCodeBlock = false;
    let codeContent = [];
    let tableRows = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Handle code blocks
      if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
          // End code block
          blocks.push(this.createBlock('core/code', codeContent.join('\n')));
          codeContent = [];
          inCodeBlock = false;
        } else {
          // Start code block
          inCodeBlock = true;
          // Save any pending blocks
          if (listItems.length > 0) {
            blocks.push(this.createListBlock(listItems));
            listItems = [];
          }
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      // Handle tables
      if (this.isTableRow(trimmed)) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        tableRows.push(trimmed);
        continue;
      } else if (inTable && tableRows.length > 0) {
        // End of table
        blocks.push(this.createTableBlock(tableRows));
        tableRows = [];
        inTable = false;
      }

      // Skip empty lines
      if (trimmed === '') {
        // Save any pending lists
        if (listItems.length > 0) {
          blocks.push(this.createListBlock(listItems));
          listItems = [];
        }
        continue;
      }

      // Handle headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        // Save any pending lists
        if (listItems.length > 0) {
          blocks.push(this.createListBlock(listItems));
          listItems = [];
        }
        const level = headingMatch[1].length;
        const text = headingMatch[2];
        blocks.push(this.createHeadingBlock(text, level));
        continue;
      }

      // Handle lists
      const listMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
      if (listMatch) {
        const indent = listMatch[1].length;
        const text = listMatch[2];
        listItems.push({ text, indent });
        continue;
      }

      // Handle ordered lists
      const orderedListMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
      if (orderedListMatch) {
        const indent = orderedListMatch[1].length;
        const text = orderedListMatch[2];
        listItems.push({ text, indent, ordered: true });
        continue;
      }

      // Handle quotes
      if (trimmed.startsWith('>')) {
        // Save any pending lists
        if (listItems.length > 0) {
          blocks.push(this.createListBlock(listItems));
          listItems = [];
        }
        const quoteText = trimmed.replace(/^>\s*/, '');
        blocks.push(this.createQuoteBlock(quoteText));
        continue;
      }

      // Handle horizontal rules
      if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
        // Save any pending lists
        if (listItems.length > 0) {
          blocks.push(this.createListBlock(listItems));
          listItems = [];
        }
        blocks.push(this.createSeparatorBlock());
        continue;
      }

      // Handle images
      const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imageMatch) {
        // Save any pending lists
        if (listItems.length > 0) {
          blocks.push(this.createListBlock(listItems));
          listItems = [];
        }
        const alt = imageMatch[1];
        const url = imageMatch[2];
        blocks.push(this.createImageBlock(url, alt));
        continue;
      }

      // Default to paragraph
      if (listItems.length > 0) {
        blocks.push(this.createListBlock(listItems));
        listItems = [];
      }
      blocks.push(this.createParagraphBlock(trimmed));
    }

    // Handle any remaining items
    if (listItems.length > 0) {
      blocks.push(this.createListBlock(listItems));
    }
    if (inCodeBlock && codeContent.length > 0) {
      blocks.push(this.createBlock('core/code', codeContent.join('\n')));
    }
    if (inTable && tableRows.length > 0) {
      blocks.push(this.createTableBlock(tableRows));
    }

    return blocks.join('\n\n');
  }

  /**
   * Create a WordPress block
   * @param {string} type - Block type (e.g., 'core/paragraph')
   * @param {string} content - Block content
   * @param {object} attributes - Block attributes
   * @returns {string} WordPress block HTML
   */
  createBlock(type, content, attributes = {}) {
    const attrString = Object.keys(attributes).length > 0 
      ? ' ' + JSON.stringify(attributes)
      : '';
    
    return `<!-- wp:${type}${attrString} -->\n${content}\n<!-- /wp:${type} -->`;
  }

  /**
   * Create a heading block
   */
  createHeadingBlock(text, level) {
    const content = `<h${level}>${this.escapeHtml(text)}</h${level}>`;
    return this.createBlock('core/heading', content, { level });
  }

  /**
   * Create a paragraph block
   */
  createParagraphBlock(text) {
    // Process inline formatting
    const formatted = this.processInlineFormatting(text);
    const content = `<p>${formatted}</p>`;
    return this.createBlock('core/paragraph', content);
  }

  /**
   * Create a list block
   */
  createListBlock(items) {
    const isOrdered = items.some(item => item.ordered);
    const listTag = isOrdered ? 'ol' : 'ul';
    
    const listHtml = items.map(item => {
      const formatted = this.processInlineFormatting(item.text);
      return `<li>${formatted}</li>`;
    }).join('\n');
    
    const content = `<${listTag}>\n${listHtml}\n</${listTag}>`;
    return this.createBlock('core/list', content, { ordered: isOrdered });
  }

  /**
   * Create a quote block
   */
  createQuoteBlock(text) {
    const formatted = this.processInlineFormatting(text);
    const content = `<blockquote class="wp-block-quote"><p>${formatted}</p></blockquote>`;
    return this.createBlock('core/quote', content);
  }

  /**
   * Create an image block
   */
  createImageBlock(url, alt) {
    const content = `<figure class="wp-block-image"><img src="${this.escapeHtml(url)}" alt="${this.escapeHtml(alt)}"/></figure>`;
    return this.createBlock('core/image', content);
  }

  /**
   * Create a separator block
   */
  createSeparatorBlock() {
    const content = '<hr class="wp-block-separator"/>';
    return this.createBlock('core/separator', content);
  }

  /**
   * Create a table block
   */
  createTableBlock(rows) {
    // Simple table parsing - assumes first row is header if it has separator
    let headerRow = null;
    let bodyRows = rows;
    
    if (rows.length > 1 && this.isTableSeparator(rows[1])) {
      headerRow = rows[0];
      bodyRows = rows.slice(2);
    }

    let tableHtml = '<figure class="wp-block-table"><table>';
    
    if (headerRow) {
      tableHtml += '<thead><tr>';
      const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
      headers.forEach(header => {
        tableHtml += `<th>${this.escapeHtml(header)}</th>`;
      });
      tableHtml += '</tr></thead>';
    }
    
    if (bodyRows.length > 0) {
      tableHtml += '<tbody>';
      bodyRows.forEach(row => {
        if (!this.isTableSeparator(row)) {
          tableHtml += '<tr>';
          const cells = row.split('|').map(c => c.trim()).filter(c => c);
          cells.forEach(cell => {
            tableHtml += `<td>${this.processInlineFormatting(cell)}</td>`;
          });
          tableHtml += '</tr>';
        }
      });
      tableHtml += '</tbody>';
    }
    
    tableHtml += '</table></figure>';
    return this.createBlock('core/table', tableHtml);
  }

  /**
   * Check if a line is a table row
   */
  isTableRow(line) {
    return line.includes('|') && !line.startsWith('```');
  }

  /**
   * Check if a line is a table separator
   */
  isTableSeparator(line) {
    return /^\s*\|?\s*[-:]+\s*\|/.test(line);
  }

  /**
   * Process inline formatting (bold, italic, links, code)
   */
  processInlineFormatting(text) {
    let formatted = this.escapeHtml(text);
    
    // Bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Links
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    
    // Strikethrough
    formatted = formatted.replace(/~~([^~]+)~~/g, '<s>$1</s>');
    
    return formatted;
  }

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    const htmlEntities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    
    return text.replace(/[&<>"']/g, char => htmlEntities[char]);
  }

  /**
   * Convert WordPress blocks back to markdown (for reading/editing)
   * This is a simplified version - full implementation would parse block comments
   */
  blocksToMarkdown(blocksHtml) {
    // This is a placeholder for now
    // Full implementation would parse WordPress block comments and convert back
    return blocksHtml
      .replace(/<!-- wp:[\s\S]*?-->/g, '')
      .replace(/<!-- \/wp:[\s\S]*?-->/g, '')
      .replace(/<h([1-6])>(.*?)<\/h[1-6]>/g, (match, level, text) => {
        return '#'.repeat(parseInt(level)) + ' ' + text;
      })
      .replace(/<p>(.*?)<\/p>/g, '$1\n')
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replace(/<em>(.*?)<\/em>/g, '*$1*')
      .replace(/<code>(.*?)<\/code>/g, '`$1`')
      .replace(/<a href="([^"]+)">([^<]+)<\/a>/g, '[$2]($1)')
      .replace(/<hr[^>]*>/g, '---')
      .trim();
  }

  /**
   * Convert HTML to markdown (for classic content)
   */
  htmlToMarkdown(html) {
    // Basic HTML to markdown conversion
    return html
      .replace(/<h([1-6])>(.*?)<\/h[1-6]>/g, (match, level, text) => {
        return '#'.repeat(parseInt(level)) + ' ' + text + '\n\n';
      })
      .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replace(/<b>(.*?)<\/b>/g, '**$1**')
      .replace(/<em>(.*?)<\/em>/g, '*$1*')
      .replace(/<i>(.*?)<\/i>/g, '*$1*')
      .replace(/<code>(.*?)<\/code>/g, '`$1`')
      .replace(/<a href="([^"]+)">([^<]+)<\/a>/g, '[$2]($1)')
      .replace(/<hr[^>]*>/g, '\n---\n')
      .replace(/<br[^>]*>/g, '\n')
      .replace(/<ul>([\s\S]*?)<\/ul>/g, (match, content) => {
        return content.replace(/<li>(.*?)<\/li>/g, '- $1\n');
      })
      .replace(/<ol>([\s\S]*?)<\/ol>/g, (match, content) => {
        let index = 1;
        return content.replace(/<li>(.*?)<\/li>/g, () => {
          return `${index++}. $1\n`;
        });
      })
      .replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1')
      .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
      .trim();
  }
}