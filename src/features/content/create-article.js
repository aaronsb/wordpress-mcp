/**
 * Create Article Feature
 *
 * Creates an article with WordPress blocks and publishing options - for authors and administrators
 */

import { BlockConverter } from '../../core/block-converter.js';
import blocksConfig from '../../../config/blocks.json' assert { type: 'json' };

export default {
  name: 'create-article',
  description: 'Create an article using WordPress blocks with options to publish immediately or schedule',

  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Article title',
      },
      content: {
        type: 'string',
        description: 'Article content (Markdown format preferred)',
      },
      status: {
        type: 'string',
        enum: ['draft', 'publish', 'future', 'private'],
        default: 'draft',
        description: 'Publication status',
      },
      schedule_date: {
        type: 'string',
        description: 'ISO 8601 date for future publishing (required if status is "future")',
      },
      excerpt: {
        type: 'string',
        description: 'Article summary',
      },
      featured_media: {
        type: 'number',
        description: 'Featured image ID',
      },
      categories: {
        type: 'array',
        items: { type: 'number' },
        description: 'Category IDs',
      },
      tags: {
        type: 'array',
        items: { type: 'number' },
        description: 'Tag IDs',
      },
      useClassicEditor: {
        type: 'boolean',
        description: 'Force classic editor format instead of blocks (default: false)',
        default: false,
      },
    },
    required: ['title', 'content'],
  },

  async execute(params, context) {
    const { wpClient } = context;
    const blockConverter = new BlockConverter();

    let contentHtml = params.content;

    // Convert to blocks unless explicitly requested otherwise
    if (blocksConfig.blocks.enabled && !params.useClassicEditor) {
      // Check if content is already in block format
      if (!params.content.includes('<!-- wp:')) {
        // Assume markdown input and convert to blocks
        contentHtml = blockConverter.markdownToBlocks(params.content);
      }
    }

    // Prepare post data
    const postData = {
      title: params.title,
      content: contentHtml,
      status: params.status || 'draft',
      excerpt: params.excerpt || '',
      featured_media: params.featured_media || 0,
      categories: params.categories || [],
      tags: params.tags || [],
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
      message: `Article ${post.status === 'publish' ? 'published' : post.status}: "${params.title}"`,
    };
  },
};
