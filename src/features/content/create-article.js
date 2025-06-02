/**
 * Create Article Feature
 * 
 * Creates an article with publishing options - for authors and administrators
 */

export default {
  name: 'create-article',
  description: 'Create an article with options to publish immediately or schedule',
  
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Article title'
      },
      content: {
        type: 'string',
        description: 'Article content (HTML or plain text)'
      },
      status: {
        type: 'string',
        enum: ['draft', 'publish', 'future', 'private'],
        default: 'draft',
        description: 'Publication status'
      },
      schedule_date: {
        type: 'string',
        description: 'ISO 8601 date for future publishing (required if status is "future")'
      },
      excerpt: {
        type: 'string',
        description: 'Article summary'
      },
      featured_media: {
        type: 'number',
        description: 'Featured image ID'
      },
      categories: {
        type: 'array',
        items: { type: 'number' },
        description: 'Category IDs'
      },
      tags: {
        type: 'array',
        items: { type: 'number' },
        description: 'Tag IDs'
      }
    },
    required: ['title', 'content']
  },

  async execute(params, context) {
    const { wpClient } = context;
    
    // Prepare post data
    const postData = {
      title: params.title,
      content: params.content,
      status: params.status || 'draft',
      excerpt: params.excerpt || '',
      featured_media: params.featured_media || 0,
      categories: params.categories || [],
      tags: params.tags || []
    };

    // Handle scheduled posts
    if (params.status === 'future' && params.schedule_date) {
      postData.date = params.schedule_date;
    }

    // Create the post - WordPress will handle permissions
    const post = await wpClient.createPost(postData);

    return {
      success: true,
      postId: post.id,
      title: post.title.rendered,
      status: post.status,
      link: post.link,
      message: `Article ${post.status === 'publish' ? 'published' : post.status}: "${params.title}"`
    };
  }
};