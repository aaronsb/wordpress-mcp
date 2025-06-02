/**
 * Edit Post Content Feature
 *
 * Atomically edit post content using exact string replacement
 * Similar to cups-mcp's edit_document but for WordPress posts
 */

import { WorkspaceManager } from '../../core/workspace-manager.js';

export default {
  name: 'edit-post-content',
  description: 'Edit post content using precise string replacement. This is the recommended way to modify content - much safer than replacing entire post content.',

  inputSchema: {
    type: 'object',
    properties: {
      postId: {
        type: 'number',
        description: 'ID of the post to edit',
      },
      oldString: {
        type: 'string',
        description: 'Exact string to find and replace',
      },
      newString: {
        type: 'string',
        description: 'String to replace with',
      },
      expectedReplacements: {
        type: 'number',
        description: 'Expected number of replacements (default: 1)',
        default: 1,
      },
    },
    required: ['postId', 'oldString', 'newString'],
  },

  async execute(params, context) {
    const { wpClient } = context;

    try {
      // Initialize workspace manager
      const workspace = new WorkspaceManager();
      await workspace.initialize();
      
      // Perform atomic edit
      const result = await workspace.editPostContent(
        params.postId,
        params.oldString,
        params.newString,
        params.expectedReplacements || 1
      );
      
      return {
        success: true,
        postId: params.postId,
        replacements: result.replacements,
        localPath: result.localPath,
        snippet: result.snippet,
        message: `Made ${result.replacements} replacement(s) in post ${params.postId}`,
        nextSteps: [
          'Continue editing with more edit-post-content calls',
          'Use sync-to-wordpress to save changes to WordPress',
          'Use cleanup-workspace when finished editing',
        ],
      };
    } catch (error) {
      throw error;
    }
  },
};