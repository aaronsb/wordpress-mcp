/**
 * Trash Own Content Feature
 * 
 * Allows authors to move their own posts and pages to trash
 */

export default {
  name: 'trash-own-content',
  description: 'Move your own posts or pages to trash',
  
  inputSchema: {
    type: 'object',
    properties: {
      contentId: {
        type: 'number',
        description: 'ID of the post or page to trash'
      },
      contentType: {
        type: 'string',
        enum: ['post', 'page'],
        description: 'Type of content to trash',
        default: 'post'
      }
    },
    required: ['contentId']
  },

  async execute(params, context) {
    const { wpClient } = context;
    const { contentId, contentType = 'post' } = params;

    try {
      // First, verify ownership
      let content;
      let currentUserId;
      
      // Get current user
      const currentUser = await wpClient.request('/users/me');
      currentUserId = currentUser.id;

      // Get the content to check ownership
      if (contentType === 'post') {
        content = await wpClient.getPost(contentId);
      } else {
        content = await wpClient.getPage(contentId);
      }

      // Check if user owns the content
      if (content.author !== currentUserId) {
        return {
          success: false,
          error: 'Permission denied',
          message: `You can only trash your own ${contentType}s. This ${contentType} belongs to another author.`
        };
      }

      // User owns the content, proceed with trashing
      // Use DELETE method without force parameter to move to trash
      let result;
      if (contentType === 'post') {
        result = await wpClient.deletePost(contentId, false); // false = don't force delete, just trash
      } else {
        result = await wpClient.deletePage(contentId, false); // false = don't force delete, just trash
      }

      return {
        success: true,
        contentId,
        contentType,
        title: result.title?.rendered || result.title?.raw || `${contentType} ${contentId}`,
        message: `Successfully moved ${contentType} "${result.title?.rendered || result.title?.raw}" to trash`,
        hint: `To restore this ${contentType}, an editor or administrator can help, or you can restore it from the WordPress admin panel.`
      };

    } catch (error) {
      // Handle specific WordPress errors
      if (error.code === 'rest_post_invalid_id' || error.code === 'rest_page_invalid_id') {
        return {
          success: false,
          error: 'Not found',
          message: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} with ID ${contentId} not found`
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to trash content',
        message: `Could not move ${contentType} to trash. ${error.data?.message || error.message || ''}`
      };
    }
  }
};