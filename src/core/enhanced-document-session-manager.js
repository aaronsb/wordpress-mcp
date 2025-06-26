/**
 * Enhanced Document Session Manager
 * 
 * Manages document sessions using WordPress blocks as the default format
 * Classic markdown editing is deprecated except for markdown import tool
 */

import { DocumentSessionManager } from './document-session-manager.js';
import { BlockDocumentSession } from './block-document-session.js';
import { BlockConverter } from './block-converter.js';
import { BlockAutoFixer } from './block-auto-fixer.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const blocksConfig = JSON.parse(readFileSync(join(__dirname, '../../config/blocks.json'), 'utf8'));

export class EnhancedDocumentSessionManager extends DocumentSessionManager {
  constructor(wpClient) {
    super();
    
    this.wpClient = wpClient;
    // Block-specific state
    this.blockSessions = new Map(); // handle -> BlockDocumentSession
    this.blockConverter = new BlockConverter();
    this.autoFixer = new BlockAutoFixer();
  }

  generateHandle() {
    return `wp-session-${Math.random().toString(36).substr(2, 16)}`;
  }

  /**
   * Create a new editing session - always uses blocks
   */
  async createSession(contentId, content, metadata = {}) {
    const handle = this.generateHandle();
    const contentType = metadata.contentType || 'post';
    
    // Always create block session (blocks are the default)
    const blockSession = new BlockDocumentSession(
      handle,
      contentType,
      contentId,
      this.wpClient
    );
    
    await blockSession.initialize(content, metadata);
    this.blockSessions.set(handle, blockSession);
    
    // Store minimal session info for cleanup
    this.sessions.set(handle, {
      contentId,
      contentType,
      created: new Date(),
      metadata,
      format: 'blocks'
    });
    
    return {
      documentHandle: handle,
      contentId,
      contentType,
      format: 'blocks',
      blockCount: blockSession.blocks.length,
      title: metadata.title,
      status: metadata.status,
      message: `Block document ready for editing with handle: ${handle}`,
      blocks: blockSession.listBlocks().blocks,
    };
  }

  /**
   * Check if session exists
   */
  hasSession(handle) {
    return this.blockSessions.has(handle);
  }

  /**
   * Get block session
   */
  getBlockSession(handle) {
    const session = this.blockSessions.get(handle);
    if (!session) {
      throw new Error(`No block session found for handle: ${handle}`);
    }
    return session;
  }

  /**
   * List blocks
   */
  async listBlocks(handle, filter = {}) {
    const blockSession = this.getBlockSession(handle);
    return blockSession.listBlocks(filter);
  }

  /**
   * Read specific block
   */
  async readBlock(handle, blockId) {
    const blockSession = this.getBlockSession(handle);
    return blockSession.readBlock(blockId);
  }

  /**
   * Edit block with validation
   */
  async editBlock(handle, blockId, updates) {
    const blockSession = this.getBlockSession(handle);
    return await blockSession.editBlock(
      blockId, 
      updates, 
      updates.validateImmediately !== false
    );
  }

  /**
   * Insert new block
   */
  async insertBlock(handle, params) {
    const blockSession = this.getBlockSession(handle);
    
    // Build attributes object from both params.attributes and individual attribute parameters
    let attributes = params.attributes || {};
    
    // Handle individual attribute parameters (like level, align, etc.)
    const attributeParams = ['level', 'align', 'ordered', 'reversed', 'start', 'fontSize', 'textColor', 'backgroundColor', 'dropCap'];
    for (const attr of attributeParams) {
      if (params[attr] !== undefined) {
        attributes[attr] = params[attr];
      }
    }
    
    return await blockSession.insertBlock(
      params.type,
      params.content,
      params.position,
      attributes,
      params.validateImmediately !== false
    );
  }

  /**
   * Delete block
   */
  async deleteBlock(handle, blockId) {
    const blockSession = this.getBlockSession(handle);
    return blockSession.deleteBlock(blockId);
  }

  /**
   * Reorder blocks
   */
  async reorderBlocks(handle, blockId, newPosition) {
    const blockSession = this.getBlockSession(handle);
    return blockSession.reorderBlocks(blockId, newPosition);
  }

  /**
   * Validate blocks
   */
  async validateBlocks(handle, blockIds = null) {
    const blockSession = this.getBlockSession(handle);
    return blockSession.validateBlocks(blockIds);
  }

  /**
   * Get document content for syncing back to WordPress
   */
  async getDocumentContent(handle) {
    const blockSession = this.getBlockSession(handle);
    return blockSession.blocksToHtml();
  }

  /**
   * Get content and metadata for sync to WordPress (blocks format)
   */
  async getContentForSync(handle) {
    const blockSession = this.getBlockSession(handle);
    const session = this.sessions.get(handle);
    
    if (!session) {
      throw new Error(`Session ${handle} not found`);
    }
    
    // Get the blocks and apply auto-fixes
    const blocks = blockSession.blocks;
    const fixResult = this.autoFixer.fixBlocks(blocks);
    
    // Update blocks in session with fixed versions
    blockSession.blocks = fixResult.blocks;
    
    // Generate HTML from fixed blocks
    let content;
    try {
      content = blockSession.blocksToHtml();
    } catch (error) {
      // Fallback: Convert everything to paragraph blocks
      console.error('Failed to generate HTML, falling back to paragraph blocks:', error);
      const fallbackBlocks = blocks.map(block => ({
        type: 'core/paragraph',
        id: block.id || `fallback_${Date.now()}`,
        content: `<p>${block.content || '[Empty block]'}</p>`,
        attributes: {}
      }));
      
      // Try again with simplified blocks
      blockSession.blocks = fallbackBlocks;
      content = blockSession.blocksToHtml();
      
      fixResult.fixes.push('Converted all blocks to paragraphs as last resort');
      fixResult.fixCount = fixResult.fixes.length;
    }
    
    return {
      contentId: session.contentId,
      contentType: session.contentType, 
      content: content,
      metadata: session.metadata,
      hasChanges: blockSession.getChanges().total > 0,
      validation: {
        fixesApplied: fixResult.fixCount > 0,
        fixCount: fixResult.fixCount,
        fixes: fixResult.fixes,
        summary: fixResult.fixCount > 0 
          ? `Applied ${fixResult.fixCount} fixes to ensure valid blocks. Review content after sync to ensure it matches your intent.`
          : 'Content validated successfully'
      }
    };
  }
  
  /**
   * Escape HTML helper
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Get editing session info
   */
  async getSessionInfo(handle) {
    const blockSession = this.getBlockSession(handle);
    return blockSession.getSummary();
  }

  /**
   * Get changes for sync
   */
  async getChanges(handle) {
    const blockSession = this.getBlockSession(handle);
    return blockSession.getChanges();
  }

  /**
   * Clean up session
   */
  async closeSession(handle) {
    // Remove block session
    if (this.blockSessions.has(handle)) {
      this.blockSessions.delete(handle);
    }

    // Remove session info
    if (this.sessions.has(handle)) {
      this.sessions.delete(handle);
    }

    return {
      success: true,
      documentHandle: handle,
      message: `Session ${handle} closed and cleaned up`
    };
  }

  /**
   * List active sessions
   */
  getActiveSessions() {
    return Array.from(this.blockSessions.entries()).map(([handle, session]) => ({
      documentHandle: handle,
      contentId: session.contentId,
      contentType: session.contentType,
      created: session.created,
      format: 'blocks', // Always blocks now
      hasChanges: this.blockSessions.has(handle) ? 
        this.blockSessions.get(handle).getChanges().total > 0 : false
    }));
  }
}