/**
 * Submit for Review Feature
 * 
 * Submit a draft for editorial review - for contributors
 */

export default {
  name: 'submit-for-review',
  description: 'Submit a draft post for editorial review',
  
  inputSchema: {
    type: 'object',
    properties: {
      postId: {
        type: 'number',
        description: 'ID of the draft post to submit'
      },
      note: {
        type: 'string',
        description: 'Note to editors (optional)'
      }
    },
    required: ['postId']
  },

  async execute(params, context) {
    const { wpClient } = context;
    
    // Update post status to pending
    const updateData = {
      status: 'pending'
    };
    
    // Add editorial note as excerpt or custom field if provided
    if (params.note) {
      updateData.excerpt = params.note;
    }
    
    const post = await wpClient.updatePost(params.postId, updateData);
    
    return {
      success: true,
      postId: post.id,
      title: post.title.rendered,
      status: post.status,
      message: `Submitted for review: "${post.title.rendered}"`
    };
  }
};