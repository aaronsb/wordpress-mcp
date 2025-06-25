/**
 * Draft Article Feature
 *
 * Creates a draft article with WordPress blocks - available to all personalities
 */

import { BlockConverter } from '../../core/block-converter.js';
import blocksConfig from '../../../config/blocks.json' assert { type: 'json' };

export default {
  name: 'draft-article',
  description: 'Create a draft article using WordPress blocks that can be reviewed before publishing',

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
      excerpt: {
        type: 'string',
        description: 'Brief summary of the article (optional)',
      },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Category names or IDs (optional)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tag names (optional)',
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

    try {
      let contentHtml = params.content;

      // Convert to blocks unless explicitly requested otherwise
      if (blocksConfig.blocks.enabled && !params.useClassicEditor) {
        // Check if content is already in block format
        if (!params.content.includes('<!-- wp:')) {
          // Assume markdown input and convert to blocks
          contentHtml = blockConverter.markdownToBlocks(params.content);
        }
      }

      // Prepare post data for Feature API
      const postData = {
        title: { raw: params.title },
        content: { raw: contentHtml },
        status: 'draft', // Always draft for this feature
        excerpt: { raw: params.excerpt || '' },
      };

      // Handle categories if provided
      if (params.categories && params.categories.length > 0) {
        postData.categories = await this.resolveCategories(params.categories, wpClient);
      }

      // Handle tags if provided
      if (params.tags && params.tags.length > 0) {
        postData.tags = await this.resolveTags(params.tags, wpClient);
      }

      // Use Feature API to create the post
      const post = await wpClient.executeFeature('tool-posts', postData);

      return {
        success: true,
        postId: post.id,
        title: post.title.rendered,
        status: post.status,
        editLink: post.link.replace(wpClient.baseUrl, '') + '?preview=true',
        message: `Draft created successfully: "${params.title}"`,
      };
    } catch (error) {
      // WordPress will return appropriate error if user can't create posts
      throw error;
    }
  },

  async resolveCategories(categories, wpClient) {
    // Get existing categories
    const existingCats = await wpClient.getCategories();
    const catIds = [];

    for (const cat of categories) {
      // Check if it's already an ID
      if (typeof cat === 'number') {
        catIds.push(cat);
        continue;
      }

      // Find by name
      const existing = existingCats.find((c) => c.name.toLowerCase() === cat.toLowerCase());

      if (existing) {
        catIds.push(existing.id);
      }
      // Note: Only admins can create categories, so we just skip unknown ones
    }

    return catIds;
  },

  async resolveTags(tags, wpClient) {
    const tagIds = [];

    for (const tagName of tags) {
      try {
        // Try to create the tag (will fail if no permission)
        const tag = await wpClient.createTag({ name: tagName });
        tagIds.push(tag.id);
      } catch (error) {
        // If can't create, try to find existing
        const existingTags = await wpClient.getTags();
        const existing = existingTags.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
        if (existing) {
          tagIds.push(existing.id);
        }
        // Skip if can't create or find
      }
    }

    return tagIds;
  },
};
