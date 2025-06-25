/**
 * Pull for Editing Feature
 *
 * Download a post or page to local workspace for atomic editing
 */

import { WorkspaceManager } from '../../core/workspace-manager.js';

export default {
  name: 'pull-for-editing',
  description: 'Download a post or page to local workspace for precise editing. Use this workflow instead of updating content directly - it enables atomic, safe editing operations.',

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
    required: ['postId'],
  },

  async execute(params, context) {
    const { wpClient } = context;
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
        // Get the post using Feature API
        content = await wpClient.executeFeature('resource-post', { 
          id: params.postId,
          context: 'edit' // Get full editing context
        });
        
        // Get current user to verify permissions
        currentUser = await wpClient.executeFeature('resource-users/me');
        
        // Check if user can edit this post
        if (content.author !== currentUser.id && !currentUser.capabilities?.edit_others_posts) {
          throw new Error('You do not have permission to edit this post');
        }
      }

      // Initialize workspace manager
      const workspace = new WorkspaceManager();
      await workspace.initialize();
      
      // Pull content to local workspace
      const result = await workspace.pullContent(content, wpClient, contentType);
      
      return {
        success: true,
        [`${contentType}Id`]: content.id,
        title: content.title.rendered,
        status: content.status,
        type: contentType,
        localPath: result.localPath,
        wordCount: this.estimateWordCount(content.content.rendered),
        lastModified: new Date(content.modified).toISOString(),
        message: `${contentType === 'page' ? 'Page' : 'Post'} "${content.title.rendered}" is now available for editing`,
        workflow: contentType === 'page' 
          ? 'Use the document editing tools to modify the page content, then sync-to-wordpress to save your changes.'
          : 'Use the semantic editing workflow: edit-post-content for changes, then sync-to-wordpress to save. This is safer than direct post updates.',
        instructions: contentType === 'page'
          ? [
              'Use read-document to view the current page content',
              'Use edit-document or related tools to make changes',
              'Use sync-to-wordpress when ready to publish your changes',
              'Pages are for static content like About, Services, Contact pages'
            ]
          : [
              'Use edit-post-content to make precise changes (not direct post updates)',
              'Use sync-to-wordpress when ready to update (not REST API calls)',
              'Use cleanup-workspace when finished editing',
            ],
        semanticContext: {
          contentType: contentType,
          hint: contentType === 'page' 
            ? 'This is a PAGE - use it for permanent, timeless content that forms your site structure'
            : 'This is a POST - use it for time-based content like news, articles, or blog entries'
        },
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