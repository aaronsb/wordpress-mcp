/**
 * Sync to WordPress Feature
 *
 * Push editing session changes back to WordPress
 */

import { DocumentSessionManager } from '../../core/document-session-manager.js';

export default {
  name: 'sync-to-wordpress',
  description: 'Push editing session changes back to WordPress',

  inputSchema: {
    type: 'object',
    properties: {
      documentHandle: {
        type: 'string',
        description: 'Document handle from pull-for-editing',
      },
      closeSession: {
        type: 'boolean',
        description: 'Close editing session after sync',
        default: false,
      },
    },
    required: ['documentHandle'],
  },

  async execute(params, context) {
    const { wpClient, server } = context;

    try {
      // Get session manager
      const sessionManager = server.documentSessionManager;
      if (!sessionManager) {
        throw new Error('No active document sessions. Use pull-for-editing first.');
      }

      // Get session info
      const sessionInfo = await sessionManager.getSessionInfo(params.documentHandle);
      const contentType = sessionInfo.contentType;
      const contentId = sessionInfo.contentId;

      // Get changes summary
      const changes = await sessionManager.getChanges(params.documentHandle);
      
      // Validate all blocks before syncing
      const validation = await sessionManager.validateBlocks(params.documentHandle);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
          blockErrors: Array.from(validation.blockErrors.entries()),
          message: 'Cannot sync: Some blocks have validation errors',
          suggestion: 'Use validate-blocks to see specific issues and fix them before syncing',
        };
      }

      // Get the block content
      const blockContent = await sessionManager.getDocumentContent(params.documentHandle);
      
      // Update WordPress
      const updateData = {
        content: { raw: blockContent },
      };

      let updatedContent;
      if (contentType === 'page') {
        updatedContent = await wpClient.updatePage(contentId, updateData);
      } else {
        updatedContent = await wpClient.updatePost(contentId, updateData);
      }
      
      // Close session if requested
      if (params.closeSession) {
        await sessionManager.closeSession(params.documentHandle);
      }
      
      return {
        success: true,
        [`${contentType}Id`]: updatedContent.id,
        title: updatedContent.title.rendered,
        status: updatedContent.status,
        format: 'blocks',
        lastModified: new Date(updatedContent.modified).toISOString(),
        sessionClosed: params.closeSession,
        message: `${contentType === 'page' ? 'Page' : 'Post'} "${updatedContent.title.rendered}" updated successfully with ${changes.total} changes`,
        link: updatedContent.link,
        changes: {
          modified: changes.modified.length,
          added: changes.added.length,
          deleted: changes.deleted.length,
        },
      };
    } catch (error) {
      throw error;
    }
  },
};