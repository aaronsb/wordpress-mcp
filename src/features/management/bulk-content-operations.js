/**
 * Bulk Content Operations Feature
 *
 * Perform bulk operations on posts - for administrators
 */

export default {
  name: 'bulk-content-operations',
  description: 'Perform bulk operations on multiple posts',

  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['trash', 'restore', 'delete', 'change_status'],
        description: 'Bulk operation to perform',
      },
      postIds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of post IDs to operate on',
      },
      newStatus: {
        type: 'string',
        enum: ['draft', 'publish', 'private', 'trash'],
        description: 'New status (required for change_status operation)',
      },
    },
    required: ['operation', 'postIds'],
  },

  async execute(params, context) {
    const { wpClient } = context;
    const results = [];
    const errors = [];

    for (const postId of params.postIds) {
      try {
        let result;

        switch (params.operation) {
          case 'trash':
            result = await wpClient.updatePost(postId, { status: 'trash' });
            break;

          case 'restore':
            result = await wpClient.updatePost(postId, { status: 'draft' });
            break;

          case 'delete':
            result = await wpClient.deletePost(postId, true);
            break;

          case 'change_status':
            if (!params.newStatus) {
              throw new Error('newStatus is required for change_status operation');
            }
            result = await wpClient.updatePost(postId, { status: params.newStatus });
            break;
        }

        results.push({
          postId,
          success: true,
          title: result.title?.rendered || `Post ${postId}`,
        });
      } catch (error) {
        errors.push({
          postId,
          error: error.message,
        });
      }
    }

    return {
      success: errors.length === 0,
      operation: params.operation,
      processed: results.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
    };
  },
};
