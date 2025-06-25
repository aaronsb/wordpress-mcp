/**
 * Enhanced Document Session Manager
 * 
 * Manages document sessions using WordPress blocks as the default format
 * Classic markdown editing is deprecated except for markdown import tool
 */

import { DocumentSessionManager } from './document-session-manager.js';
import { BlockDocumentSession } from './block-document-session.js';
import { BlockConverter } from './block-converter.js';
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
    return await blockSession.insertBlock(
      params.type,
      params.content,
      params.position,
      params.attributes,
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
    return Array.from(this.sessions.entries()).map(([handle, session]) => ({
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