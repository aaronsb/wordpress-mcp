/**
 * Sync to WordPress Feature
 *
 * Upload local workspace changes back to WordPress
 */

import { WorkspaceManager } from '../../core/workspace-manager.js';

export default {
  name: 'sync-to-wordpress',
  description: 'Sync local workspace changes back to WordPress',

  inputSchema: {
    type: 'object',
    properties: {
      postId: {
        type: 'number',
        description: 'ID of the post to sync',
      },
      autoCleanup: {
        type: 'boolean',
        description: 'Automatically cleanup workspace after sync (default: false)',
        default: false,
      },
    },
    required: ['postId'],
  },

  async execute(params, context) {
    const { wpClient } = context;

    try {
      // Initialize workspace manager
      const workspace = new WorkspaceManager();
      await workspace.initialize();
      
      // Sync changes to WordPress
      const updatedPost = await workspace.syncToWordPress(params.postId, wpClient);
      
      // Auto-cleanup if requested
      if (params.autoCleanup) {
        await workspace.cleanup(params.postId);
      }
      
      return {
        success: true,
        postId: updatedPost.id,
        title: updatedPost.title.rendered,
        status: updatedPost.status,
        lastModified: new Date(updatedPost.modified).toISOString(),
        autoCleanup: params.autoCleanup,
        message: `Post "${updatedPost.title.rendered}" updated successfully`,
        link: updatedPost.link,
      };
    } catch (error) {
      throw error;
    }
  },
};