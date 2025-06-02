/**
 * View Editorial Feedback Feature
 * 
 * View comments and feedback on posts - for contributors
 */

export default {
  name: 'view-editorial-feedback',
  description: 'View editorial comments and feedback on your posts',
  
  inputSchema: {
    type: 'object',
    properties: {
      postId: {
        type: 'number',
        description: 'Post ID to get feedback for (optional, shows all if not specified)'
      },
      status: {
        type: 'string',
        enum: ['all', 'approved', 'pending', 'spam', 'trash'],
        default: 'all',
        description: 'Filter comments by status'
      }
    }
  },

  async execute(params, context) {
    const { wpClient } = context;
    
    const queryParams = {
      status: params.status || 'all'
    };
    
    if (params.postId) {
      queryParams.post = params.postId;
    }
    
    const comments = await wpClient.getComments(queryParams);
    
    // Format comments for easy reading
    const feedback = comments.map(comment => ({
      id: comment.id,
      post: comment.post,
      author: comment.author_name,
      date: comment.date,
      content: comment.content.rendered,
      status: comment.status
    }));
    
    return {
      success: true,
      count: feedback.length,
      feedback: feedback.length > 0 ? feedback : 'No editorial feedback found',
      message: feedback.length > 0 
        ? `Found ${feedback.length} feedback items` 
        : 'No feedback available yet'
    };
  }
};