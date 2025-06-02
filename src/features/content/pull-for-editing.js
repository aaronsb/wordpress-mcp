/**
 * Pull for Editing Feature
 *
 * Download a post to local workspace for atomic editing
 */

import { WorkspaceManager } from '../../core/workspace-manager.js';

export default {
  name: 'pull-for-editing',
  description: 'Download a post to local workspace for precise editing. Use this workflow instead of updating posts directly - it enables atomic, safe editing operations.',

  inputSchema: {
    type: 'object',
    properties: {
      postId: {
        type: 'number',
        description: 'ID of the post to pull for editing',
      },
    },
    required: ['postId'],
  },

  async execute(params, context) {
    const { wpClient } = context;

    try {
      // Get the post using Feature API
      const post = await wpClient.executeFeature('resource-post', { 
        id: params.postId,
        context: 'edit' // Get full editing context
      });
      
      // Get current user to verify permissions
      const currentUser = await wpClient.executeFeature('resource-users/me');
      
      // Check if user can edit this post
      if (post.author !== currentUser.id && !currentUser.capabilities?.edit_others_posts) {
        throw new Error('You do not have permission to edit this post');
      }

      // Initialize workspace manager
      const workspace = new WorkspaceManager();
      await workspace.initialize();
      
      // Pull post to local workspace
      const result = await workspace.pullPost(post, wpClient);
      
      return {
        success: true,
        postId: post.id,
        title: post.title.rendered,
        status: post.status,
        localPath: result.localPath,
        wordCount: this.estimateWordCount(post.content.rendered),
        lastModified: new Date(post.modified).toISOString(),
        message: `Post "${post.title.rendered}" is now available for editing`,
        workflow: 'Use the semantic editing workflow: edit-post-content for changes, then sync-to-wordpress to save. This is safer than direct post updates.',
        instructions: [
          'Use edit-post-content to make precise changes (not direct post updates)',
          'Use sync-to-wordpress when ready to update (not REST API calls)',
          'Use cleanup-workspace when finished editing',
        ],
      };
    } catch (error) {
      throw error;
    }
  },

  estimateWordCount(htmlContent) {
    const textContent = htmlContent.replace(/<[^>]*>/g, ' ').trim();
    return textContent ? textContent.split(/\s+/).length : 0;
  },
};