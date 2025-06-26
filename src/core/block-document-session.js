/**
 * Block Document Session
 * 
 * Enhanced document session with block structure support
 * Provides atomic operations with immediate validation
 */

import { randomBytes, createHash } from 'crypto';
import { BlockValidator } from './block-validator.js';
import { BlockConverter } from './block-converter.js';

export class BlockDocumentSession {
  constructor(sessionId, contentType, contentId, wpClient) {
    this.sessionId = sessionId;
    this.contentType = contentType;
    this.contentId = contentId;
    this.wpClient = wpClient;
    
    // Session state
    this.format = 'blocks';
    this.blocks = [];
    this.blockIndex = new Map(); // blockId -> block reference
    this.history = []; // For undo operations
    this.originalBlocks = []; // For change detection
    
    // Tools
    this.validator = new BlockValidator();
    this.converter = new BlockConverter();
    
    // Validation cache
    this.validationCache = new Map();
    this.blockIdCounter = 0;
  }

  /**
   * Initialize session with content
   */
  async initialize(content, metadata = {}) {
    this.metadata = metadata;

    // Parse content into blocks
    if (content.includes('<!-- wp:')) {
      // Already in block format
      this.blocks = this.parseBlocks(content);
    } else {
      // Convert from markdown/HTML to blocks
      const blockHtml = this.converter.markdownToBlocks(content);
      this.blocks = this.parseBlocks(blockHtml);
    }

    // Store original state for change detection
    this.originalBlocks = this.cloneBlocks(this.blocks);
    
    // Build block index
    this.rebuildIndex();

    return {
      format: this.format,
      blockCount: this.blocks.length,
      blocks: this.blocks.map(b => this.getBlockSummary(b)),
    };
  }

  /**
   * Parse WordPress block HTML into structured blocks
   */
  parseBlocks(html) {
    const blocks = [];
    const blockRegex = /<!-- wp:([a-z\/\-]+)(\s+({[^}]*}))?\s*-->([\s\S]*?)<!-- \/wp:\1 -->/g;
    let match;
    let position = 0;

    while ((match = blockRegex.exec(html)) !== null) {
      const [fullMatch, blockType, , attributesJson, content] = match;
      
      const block = {
        id: this.generateBlockId(),
        type: blockType,
        attributes: attributesJson ? JSON.parse(attributesJson) : {},
        content: content.trim(),
        position: position++,
        originalHash: this.hashBlock({ type: blockType, attributes: attributesJson, content }),
      };

      blocks.push(block);
    }

    return blocks;
  }

  /**
   * Generate block HTML from structured blocks
   */
  blocksToHtml(blocks = this.blocks) {
    return blocks.map(block => {
      const attrString = Object.keys(block.attributes).length > 0
        ? ' ' + JSON.stringify(block.attributes)
        : '';
      
      return `<!-- wp:${block.type}${attrString} -->\n${block.content}\n<!-- /wp:${block.type} -->`;
    }).join('\n\n');
  }

  /**
   * List all blocks with preview
   */
  listBlocks(filter = {}) {
    let blocks = [...this.blocks];

    // Apply filters
    if (filter.type) {
      blocks = blocks.filter(b => b.type === filter.type);
    }
    if (filter.hasContent) {
      blocks = blocks.filter(b => b.content && b.content.trim() !== '');
    }

    return {
      blocks: blocks.map(b => this.getBlockSummary(b)),
      total: this.blocks.length,
      filtered: blocks.length,
    };
  }

  /**
   * Read a specific block
   */
  readBlock(blockId) {
    const block = this.blockIndex.get(blockId);
    if (!block) {
      throw new Error(`Block ${blockId} not found`);
    }

    return {
      ...block,
      validation: this.getCachedValidation(blockId),
    };
  }

  /**
   * Edit block with immediate validation
   */
  async editBlock(blockId, updates, validateImmediately = true) {
    const block = this.blockIndex.get(blockId);
    if (!block) {
      throw new Error(`Block ${blockId} not found`);
    }

    // Create backup for potential rollback
    const backup = this.cloneBlock(block);

    try {
      // Apply updates
      if (updates.content !== undefined) {
        block.content = updates.content;
      }
      if (updates.attributes !== undefined) {
        block.attributes = { ...block.attributes, ...updates.attributes };
      }

      // Immediate validation - but don't block on errors
      let validationWarnings = [];
      if (validateImmediately) {
        const errors = this.validator.validateBlock(block);
        if (errors.length > 0) {
          // Don't revert - just warn
          validationWarnings = errors;
          console.error(`Block validation warnings for ${block.type}:`, errors);
        }
      }

      // Success - update hash and history
      block.hash = this.hashBlock(block);
      this.history.push({ op: 'edit', blockId, backup });
      this.invalidateValidationCache(blockId);

      return {
        success: true,
        block: this.getBlockSummary(block),
        message: validationWarnings.length > 0 
          ? `Block updated with ${validationWarnings.length} validation warnings`
          : 'Block updated and validated successfully',
        warnings: validationWarnings,
      };

    } catch (error) {
      // Ensure session integrity
      this.revertBlock(blockId, backup);
      throw error;
    }
  }

  /**
   * Insert a new block with validation
   */
  async insertBlock(type, content, position, attributes = {}, validateImmediately = true) {
    // Create new block
    const newBlock = {
      id: this.generateBlockId(),
      type,
      content,
      attributes,
      position,
      hash: null,
    };

    // Validate but don't block insertion
    let validationWarnings = [];
    if (validateImmediately) {
      const errors = this.validator.validateBlock(newBlock);
      if (errors.length > 0) {
        // Don't block - just warn
        validationWarnings = errors;
        console.error(`Block validation warnings for new ${type}:`, errors);
      }
    }

    // Valid - proceed with insertion
    newBlock.hash = this.hashBlock(newBlock);
    
    // Update positions of subsequent blocks
    this.blocks.forEach(block => {
      if (block.position >= position) {
        block.position++;
      }
    });

    // Insert the block
    this.blocks.splice(position, 0, newBlock);
    this.rebuildIndex();

    // Record in history
    this.history.push({ op: 'insert', blockId: newBlock.id, position });

    return {
      success: true,
      blockId: newBlock.id,
      message: validationWarnings.length > 0
        ? `${type} block inserted with ${validationWarnings.length} validation warnings`
        : `${type} block inserted at position ${position}`,
      block: this.getBlockSummary(newBlock),
      warnings: validationWarnings,
    };
  }

  /**
   * Delete a block
   */
  deleteBlock(blockId) {
    const block = this.blockIndex.get(blockId);
    if (!block) {
      throw new Error(`Block ${blockId} not found`);
    }

    // Remove from blocks array
    const index = this.blocks.indexOf(block);
    this.blocks.splice(index, 1);

    // Update positions
    this.blocks.forEach(b => {
      if (b.position > block.position) {
        b.position--;
      }
    });

    // Update index
    this.blockIndex.delete(blockId);

    // Record in history
    this.history.push({ op: 'delete', blockId, block: this.cloneBlock(block) });

    return {
      success: true,
      message: `Block ${blockId} deleted`,
      remainingBlocks: this.blocks.length,
    };
  }

  /**
   * Reorder blocks
   */
  reorderBlocks(blockId, newPosition) {
    const block = this.blockIndex.get(blockId);
    if (!block) {
      throw new Error(`Block ${blockId} not found`);
    }

    const oldPosition = block.position;
    if (oldPosition === newPosition) {
      return { success: true, message: 'Block already at specified position' };
    }

    // Remove from current position
    this.blocks.splice(oldPosition, 1);

    // Insert at new position
    this.blocks.splice(newPosition, 0, block);

    // Update all positions
    this.blocks.forEach((b, index) => {
      b.position = index;
    });

    // Record in history
    this.history.push({ op: 'reorder', blockId, oldPosition, newPosition });

    return {
      success: true,
      message: `Block moved from position ${oldPosition} to ${newPosition}`,
    };
  }

  /**
   * Validate all blocks
   */
  async validateBlocks(blockIds = null) {
    const blocksToValidate = blockIds 
      ? blockIds.map(id => this.blockIndex.get(id)).filter(Boolean)
      : this.blocks;

    const result = this.validator.validateBlocks(blocksToValidate);

    // Cache validation results
    blocksToValidate.forEach(block => {
      const errors = result.blockErrors.get(block.id) || [];
      this.validationCache.set(block.id, {
        valid: errors.length === 0,
        errors,
        timestamp: Date.now(),
      });
    });

    return result;
  }

  /**
   * Get changes for sync
   */
  getChanges() {
    const changes = {
      modified: [],
      added: [],
      deleted: [],
      total: 0,
    };

    // Compare current blocks with original
    const originalMap = new Map(
      this.originalBlocks.map(b => [b.id, b])
    );

    // Check for modified and new blocks
    this.blocks.forEach(block => {
      const original = originalMap.get(block.id);
      if (!original) {
        changes.added.push(block.id);
      } else if (this.hashBlock(block) !== original.originalHash) {
        changes.modified.push(block.id);
      }
      originalMap.delete(block.id);
    });

    // Remaining in originalMap are deleted
    changes.deleted = Array.from(originalMap.keys());
    changes.total = changes.modified.length + changes.added.length + changes.deleted.length;

    return changes;
  }

  /**
   * Get markdown view for reading
   */
  getMarkdownView() {
    const html = this.blocksToHtml();
    return this.converter.blocksToMarkdown(html);
  }

  /**
   * Get session summary
   */
  getSummary() {
    return {
      documentHandle: this.sessionId,
      contentType: this.contentType,
      contentId: this.contentId,
      format: this.format,
      blockCount: this.blocks.length,
      hasChanges: this.getChanges().total > 0,
      metadata: this.metadata,
    };
  }

  // Helper methods

  generateBlockId() {
    return `block-${++this.blockIdCounter}-${randomBytes(4).toString('hex')}`;
  }

  rebuildIndex() {
    this.blockIndex.clear();
    this.blocks.forEach(block => {
      this.blockIndex.set(block.id, block);
    });
  }

  cloneBlock(block) {
    return JSON.parse(JSON.stringify(block));
  }

  cloneBlocks(blocks) {
    return blocks.map(b => this.cloneBlock(b));
  }

  hashBlock(block) {
    const content = JSON.stringify({
      type: block.type,
      attributes: block.attributes || {},
      content: block.content || '',
    });
    return createHash('md5').update(content).digest('hex');
  }

  revertBlock(blockId, backup) {
    const block = this.blockIndex.get(blockId);
    if (block && backup) {
      Object.assign(block, backup);
    }
  }

  getBlockSummary(block) {
    const contentPreview = block.content
      .replace(/<[^>]*>/g, '') // Strip HTML
      .trim()
      .substring(0, 80);

    return {
      id: block.id,
      type: block.type,
      preview: contentPreview + (contentPreview.length >= 80 ? '...' : ''),
      position: block.position,
      attributes: block.attributes,
      hasChanges: this.hashBlock(block) !== block.originalHash,
    };
  }

  getCachedValidation(blockId) {
    return this.validationCache.get(blockId) || { valid: true, errors: [] };
  }

  invalidateValidationCache(blockId) {
    this.validationCache.delete(blockId);
  }

  getSuggestionsForErrors(errors) {
    const suggestions = [];
    
    errors.forEach(error => {
      if (error.includes('Unknown block type')) {
        suggestions.push(`Use one of: ${this.validator.getValidBlockTypes().join(', ')}`);
      } else if (error.includes('requires content')) {
        suggestions.push('Add content to the block');
      } else if (error.includes('Missing required attribute')) {
        suggestions.push('Add the required attributes listed in the error');
      }
    });

    return suggestions.join('\n');
  }
}