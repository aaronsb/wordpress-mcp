/**
 * Sync to WordPress Feature
 *
 * Upload local workspace changes back to WordPress
 */

import { WorkspaceManager } from '../../core/workspace-manager.js';

export default {
  name: 'sync-to-wordpress',
  description: 'Sync local workspace changes back to WordPress (works with both posts and pages)',

  inputSchema: {
    type: 'object',
    properties: {
      postId: {
        type: 'number',
        description: 'ID of the post or page to sync',
      },
      type: {
        type: 'string',
        enum: ['post', 'page'],
        default: 'post',
        description: 'Type of content to sync (post or page)',
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
    const contentType = params.type || 'post';

    try {
      // Initialize workspace manager
      const workspace = new WorkspaceManager();
      await workspace.initialize();
      
      // Sync changes to WordPress based on content type
      const updatedContent = await workspace.syncToWordPress(params.postId, wpClient, contentType);
      
      // Auto-cleanup if requested
      if (params.autoCleanup) {
        await workspace.cleanup(params.postId, contentType);
      }
      
      return {
        success: true,
        [`${contentType}Id`]: updatedContent.id,
        title: updatedContent.title.rendered,
        status: updatedContent.status,
        type: contentType,
        lastModified: new Date(updatedContent.modified).toISOString(),
        autoCleanup: params.autoCleanup,
        message: `${contentType === 'page' ? 'Page' : 'Post'} "${updatedContent.title.rendered}" updated successfully`,
        link: updatedContent.link,
        semanticContext: {
          contentType: contentType,
          hint: contentType === 'page' 
            ? 'Page updated - remember pages are for static, timeless content'
            : 'Post updated - posts are for time-based content like news or articles'
        },
      };
    } catch (error) {
      throw error;
    }
  },
};