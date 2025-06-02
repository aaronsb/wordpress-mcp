/**
 * Manage All Content Feature
 * 
 * View and manage all posts regardless of author - for administrators
 */

export default {
  name: 'manage-all-content',
  description: 'List and filter all posts on the site',
  
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['any', 'publish', 'draft', 'pending', 'private', 'trash'],
        default: 'any',
        description: 'Filter by post status'
      },
      author: {
        type: 'number',
        description: 'Filter by author ID'
      },
      search: {
        type: 'string',
        description: 'Search posts by keyword'
      },
      per_page: {
        type: 'number',
        default: 20,
        description: 'Number of posts to return'
      },
      orderby: {
        type: 'string',
        enum: ['date', 'modified', 'title', 'author'],
        default: 'date',
        description: 'Order posts by'
      }
    }
  },

  async execute(params, context) {
    const { wpClient } = context;
    
    // Build query parameters
    const queryParams = {
      per_page: params.per_page || 20,
      orderby: params.orderby || 'date',
      order: 'desc'
    };
    
    if (params.status && params.status !== 'any') {
      queryParams.status = params.status;
    }
    
    if (params.author) {
      queryParams.author = params.author;
    }
    
    if (params.search) {
      queryParams.search = params.search;
    }
    
    const posts = await wpClient.listPosts(queryParams);
    
    return {
      success: true,
      count: posts.length,
      posts: posts.map(post => ({
        id: post.id,
        title: post.title.rendered,
        status: post.status,
        author: post.author,
        date: post.date,
        modified: post.modified,
        link: post.link,
        excerpt: post.excerpt.rendered
      }))
    };
  }
};