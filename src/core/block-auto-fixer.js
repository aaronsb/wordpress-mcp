/**
 * Block Auto-Fixer
 * 
 * Automatically fixes common block validation issues during sync.
 * Philosophy: Better to have slightly imperfect content than lose everything.
 */

export class BlockAutoFixer {
  constructor() {
    this.fixes = [];
  }

  /**
   * Fix blocks before sync to WordPress
   * @param {Array} blocks - Array of blocks to fix
   * @returns {Object} Fixed blocks and list of applied fixes
   */
  fixBlocks(blocks) {
    this.fixes = [];
    const fixedBlocks = blocks.map(block => this.fixBlock(block));
    
    return {
      blocks: fixedBlocks,
      fixes: this.fixes,
      fixCount: this.fixes.length
    };
  }

  /**
   * Fix a single block
   * @param {Object} block - Block to fix
   * @returns {Object} Fixed block
   */
  fixBlock(block) {
    const fixed = { ...block };
    
    // Fix based on block type
    switch (block.type) {
      case 'core/heading':
        this.fixHeadingBlock(fixed);
        break;
      case 'core/list':
        this.fixListBlock(fixed);
        break;
      case 'core/image':
        this.fixImageBlock(fixed);
        break;
      case 'core/paragraph':
        this.fixParagraphBlock(fixed);
        break;
      default:
        // For unknown block types, ensure basic structure
        if (fixed.content && !fixed.content.includes('<')) {
          // Content is plain text, wrap it
          fixed.content = `<div>${this.escapeHtml(fixed.content)}</div>`;
          this.fixes.push(`Generated HTML wrapper for ${block.type}`);
        }
    }
    
    // Ensure all blocks have required fields
    if (!fixed.id) {
      fixed.id = `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.fixes.push('Added missing block ID');
    }
    
    return fixed;
  }

  /**
   * Fix heading blocks
   */
  fixHeadingBlock(block) {
    // Ensure level is valid
    if (!block.attributes) block.attributes = {};
    
    if (!block.attributes.level || block.attributes.level < 1 || block.attributes.level > 6) {
      block.attributes.level = 2; // Default to H2
      this.fixes.push('Fixed invalid heading level');
    }
    
    // Generate proper HTML content if needed
    if (block.content) {
      const level = block.attributes.level;
      if (!block.content.includes(`<h${level}>`)) {
        // Content needs proper heading tags
        if (this.isHtml(block.content)) {
          // Strip any existing tags and rewrap
          const text = block.content.replace(/<[^>]+>/g, '');
          block.content = `<h${level}>${text}</h${level}>`;
        } else {
          // Plain text, escape and wrap
          block.content = `<h${level}>${this.escapeHtml(block.content)}</h${level}>`;
        }
        this.fixes.push('Generated heading HTML');
      }
    }
  }

  /**
   * Fix list blocks
   */
  fixListBlock(block) {
    if (!block.attributes) block.attributes = {};
    
    // Fix ordered attribute
    if (typeof block.attributes.ordered !== 'boolean') {
      block.attributes.ordered = false; // Default to unordered
      this.fixes.push('Fixed list ordered attribute');
    }
    
    // Generate proper HTML content if needed
    if (block.content && !block.content.includes('<li>')) {
      const tag = block.attributes.ordered ? 'ol' : 'ul';
      
      // Try to parse content as list items
      const items = block.content.split('\n').filter(item => item.trim());
      if (items.length > 0) {
        const listItems = items.map(item => 
          `<li>${this.escapeHtml(item.replace(/^[\d\.\-\*]\s*/, ''))}</li>`
        ).join('');
        block.content = `<${tag}>${listItems}</${tag}>`;
        this.fixes.push('Generated list HTML from content');
      } else {
        block.content = `<${tag}><li>Empty list</li></${tag}>`;
        this.fixes.push('Fixed empty list');
      }
    }
  }

  /**
   * Fix image blocks
   */
  fixImageBlock(block) {
    if (!block.attributes) block.attributes = {};
    
    // Ensure alt text exists (empty is fine for decorative images)
    if (block.attributes.alt === undefined) {
      block.attributes.alt = '';
      this.fixes.push('Added missing alt attribute');
    }
    
    // If no URL, convert to paragraph with placeholder
    if (!block.attributes.url) {
      block.type = 'core/paragraph';
      const placeholderText = `[Image placeholder: ${block.attributes.alt || 'No description'}]`;
      block.content = `<p>${placeholderText}</p>`;
      delete block.attributes.url;
      delete block.attributes.alt;
      this.fixes.push('Converted image without URL to paragraph placeholder');
    }
  }

  /**
   * Fix paragraph blocks
   */
  fixParagraphBlock(block) {
    // Generate proper HTML content if needed
    if (block.content !== undefined) {
      // Check if content is already properly formatted HTML
      if (!block.content.trim().startsWith('<p>') || !block.content.trim().endsWith('</p>')) {
        // Content needs wrapping
        if (this.isHtml(block.content)) {
          // Content is HTML but not wrapped in <p> tags
          block.content = `<p>${block.content}</p>`;
        } else {
          // Content is plain text, escape and wrap it
          block.content = `<p>${this.escapeHtml(block.content)}</p>`;
        }
        this.fixes.push('Generated paragraph HTML');
      }
    }
    
    // Empty paragraphs are valid, so no fix needed
  }

  /**
   * Check if string contains HTML
   */
  isHtml(str) {
    if (!str) return false;
    // Simple check for HTML tags
    return /<[a-z][\s\S]*>/i.test(str);
  }

  /**
   * Escape HTML to prevent injection
   */
  escapeHtml(text) {
    if (!text) return '';
    
    const div = {
      textContent: text,
      innerHTML: ''
    };
    
    // Simple HTML escape
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Get a summary of fixes
   */
  getFixSummary() {
    if (this.fixes.length === 0) {
      return 'No fixes needed';
    }
    
    const summary = [`Applied ${this.fixes.length} fixes:`];
    const fixCounts = {};
    
    this.fixes.forEach(fix => {
      const key = fix.split(' ').slice(0, 2).join(' ');
      fixCounts[key] = (fixCounts[key] || 0) + 1;
    });
    
    Object.entries(fixCounts).forEach(([fix, count]) => {
      summary.push(`- ${fix}: ${count}`);
    });
    
    return summary.join('\n');
  }
}