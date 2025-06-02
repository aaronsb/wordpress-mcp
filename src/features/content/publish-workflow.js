/**
 * Publish Workflow Feature
 * 
 * Publish or schedule posts - for authors and administrators
 */

export default {
  name: 'publish-workflow',
  description: 'Publish a post immediately or schedule for future',
  
  inputSchema: {
    type: 'object',
    properties: {
      postId: {
        type: 'number',
        description: 'ID of the post to publish'
      },
      action: {
        type: 'string',
        enum: ['publish_now', 'schedule', 'private'],
        description: 'Publishing action'
      },
      schedule_date: {
        type: 'string',
        description: 'ISO 8601 date for scheduling (required if action is "schedule")'
      }
    },
    required: ['postId', 'action']
  },

  async execute(params, context) {
    const { wpClient } = context;
    
    const updateData = {};
    
    switch (params.action) {
      case 'publish_now':
        updateData.status = 'publish';
        break;
      
      case 'schedule':
        if (!params.schedule_date) {
          throw new Error('schedule_date is required for scheduling');
        }
        updateData.status = 'future';
        updateData.date = params.schedule_date;
        break;
      
      case 'private':
        updateData.status = 'private';
        break;
    }
    
    const post = await wpClient.updatePost(params.postId, updateData);
    
    const actionText = {
      'publish': 'published',
      'future': `scheduled for ${params.schedule_date}`,
      'private': 'published privately'
    };
    
    return {
      success: true,
      postId: post.id,
      title: post.title.rendered,
      status: post.status,
      link: post.link,
      message: `Post ${actionText[post.status]}: "${post.title.rendered}"`
    };
  }
};