/**
 * Edit Draft Feature
 * 
 * Edit an existing draft - available to all personalities
 */

export default {
  name: 'edit-draft',
  description: 'Edit an existing draft post',
  
  inputSchema: {
    type: 'object',
    properties: {
      postId: {
        type: 'number',
        description: 'ID of the post to edit'
      },
      title: {
        type: 'string',
        description: 'New title (optional)'
      },
      content: {
        type: 'string',
        description: 'New content (optional)'
      },
      excerpt: {
        type: 'string',
        description: 'New excerpt (optional)'
      }
    },
    required: ['postId']
  },

  async execute(params, context) {
    const { wpClient } = context;
    
    // Build update data
    const updateData = {};
    if (params.title !== undefined) updateData.title = params.title;
    if (params.content !== undefined) updateData.content = params.content;
    if (params.excerpt !== undefined) updateData.excerpt = params.excerpt;
    
    // Update the post - WordPress handles permission checking
    const post = await wpClient.updatePost(params.postId, updateData);
    
    return {
      success: true,
      postId: post.id,
      title: post.title.rendered,
      status: post.status,
      editLink: post.link + '?preview=true',
      message: `Draft updated: "${post.title.rendered}"`
    };
  }
};