/**
 * Pull for Editing Feature
 *
 * Fetch a WordPress post or page into an editing session with block support
 */

import { SessionManager } from '../../core/session-manager.js';

export default {
  name: 'pull-for-editing',
  description: 'Fetch a WordPress post or page into an editing session',

  inputSchema: {
    type: 'object',
    properties: {
      postId: {
        type: 'number',
        description: 'ID of the post or page to pull for editing',
      },
      type: {
        type: 'string',
        enum: ['post', 'page'],
        default: 'post',
        description: 'Type of content to pull (post or page)',
      },
    },
    required: ['postId', 'type'],
  },

  async execute(params, context) {
    const { wpClient, server } = context;
    const contentType = params.type || 'post';

    try {
      // Get the content based on type
      let content;
      let currentUser;
      
      if (contentType === 'page') {
        // Get the page directly using REST API
        content = await wpClient.getPage(params.postId);
        currentUser = await wpClient.getCurrentUser();
        
        // Check if user can edit this page
        if (content.author !== currentUser.id && !currentUser.capabilities?.edit_pages) {
          throw new Error('You do not have permission to edit this page');
        }
      } else {
        // Get the post using REST API for consistency
        content = await wpClient.getPost(params.postId);
        currentUser = await wpClient.getCurrentUser();
        
        // Check if user can edit this post
        if (content.author !== currentUser.id && !currentUser.capabilities?.edit_others_posts) {
          throw new Error('You do not have permission to edit this post');
        }
      }

      // Get document session manager from server
      let sessionManager = server.documentSessionManager;
      if (!sessionManager) {
        sessionManager = new SessionManager();
        server.documentSessionManager = sessionManager;
      }
      
      // Create editing session with blocks
      const session = await sessionManager.createSession(
        params.postId,
        content.content.raw || content.content.rendered,
        {
          title: content.title.rendered,
          status: content.status,
          contentType: contentType,
          wpClient: wpClient,
          author: content.author,
          modified: content.modified,
        }
      );
      
      return {
        success: true,
        documentHandle: session.documentHandle,
        [`${contentType}Id`]: content.id, 
        contentType: contentType,
        title: session.title,
        status: session.status,
        format: session.format,
        blockCount: session.blockCount,
        lastModified: new Date(content.modified).toISOString(),
        message: session.message,
        blocks: session.blocks,
      };
    } catch (error) {
      throw error;
    }
  },
};