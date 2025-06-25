/**
 * Bulk Content Operations Feature
 *
 * Perform bulk operations on posts and pages - for editors and administrators
 */

export default {
  name: 'bulk-content-operations',
  description: 'Perform bulk operations on multiple posts or pages',

  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['trash', 'restore', 'delete', 'change_status'],
        description: 'Bulk operation to perform',
      },
      contentIds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of content IDs to operate on',
      },
      contentType: {
        type: 'string',
        enum: ['post', 'page'],
        description: 'Type of content (default: post)',
        default: 'post'
      },
      newStatus: {
        type: 'string',
        enum: ['draft', 'publish', 'private', 'trash'],
        description: 'New status (required for change_status operation)',
      },
    },
    required: ['operation', 'contentIds'],
  },

  async execute(params, context) {
    const { wpClient } = context;
    const results = [];
    const errors = [];
    const contentType = params.contentType || 'post';
    const contentTypePlural = contentType === 'post' ? 'posts' : 'pages';

    for (const contentId of params.contentIds) {
      try {
        let result;

        switch (params.operation) {
          case 'trash':
            // Use DELETE method without force parameter to move to trash
            if (contentType === 'post') {
              result = await wpClient.deletePost(contentId, false); // false = don't force delete, just trash
            } else {
              result = await wpClient.deletePage(contentId, false); // false = don't force delete, just trash
            }
            break;

          case 'restore':
            if (contentType === 'post') {
              result = await wpClient.updatePost(contentId, { status: 'draft' });
            } else {
              result = await wpClient.updatePage(contentId, { status: 'draft' });
            }
            break;

          case 'delete':
            if (contentType === 'post') {
              result = await wpClient.deletePost(contentId, true);
            } else {
              result = await wpClient.deletePage(contentId, true);
            }
            break;

          case 'change_status':
            if (!params.newStatus) {
              throw new Error('newStatus is required for change_status operation');
            }
            if (contentType === 'post') {
              result = await wpClient.updatePost(contentId, { status: params.newStatus });
            } else {
              result = await wpClient.updatePage(contentId, { status: params.newStatus });
            }
            break;
        }

        results.push({
          contentId,
          contentType,
          success: true,
          title: result.title?.rendered || result.title?.raw || `${contentType} ${contentId}`,
        });
      } catch (error) {
        errors.push({
          contentId,
          contentType,
          error: error.message,
        });
      }
    }

    return {
      success: errors.length === 0,
      operation: params.operation,
      contentType: contentType,
      processed: results.length + errors.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
      message: `Bulk ${params.operation} operation completed on ${contentTypePlural}: ${results.length} successful, ${errors.length} failed`
    };
  },
};
