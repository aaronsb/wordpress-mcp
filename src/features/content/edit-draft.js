/**
 * Edit Draft Feature
 *
 * Edit an existing draft with WordPress blocks - available to all personalities
 */

import { BlockConverter } from '../../core/block-converter.js';
import blocksConfig from '../../../config/blocks.json' assert { type: 'json' };

export default {
  name: 'edit-draft',
  description: 'Edit an existing draft post with content and metadata',

  inputSchema: {
    type: 'object',
    properties: {
      postId: {
        type: 'number',
        description: 'ID of the draft to edit',
      },
      title: {
        type: 'string',
        description: 'New title (optional)',
      },
      content: {
        type: 'string',
        description: 'New content (optional, Markdown format preferred)',
      },
      excerpt: {
        type: 'string',
        description: 'New excerpt (optional)',
      },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Category names',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tag names',
      },
      useClassicEditor: {
        type: 'boolean',
        description: 'Force classic editor format instead of blocks (default: false)',
        default: false,
      },
    },
    required: ['postId'],
  },

  async execute(params, context) {
    const { wpClient } = context;
    const blockConverter = new BlockConverter();

    // Build update data
    const updateData = {};
    if (params.title !== undefined) updateData.title = params.title;
    if (params.excerpt !== undefined) updateData.excerpt = params.excerpt;

    // Handle content conversion
    if (params.content !== undefined) {
      let contentHtml = params.content;

      // Convert to blocks unless explicitly requested otherwise
      if (blocksConfig.blocks.enabled && !params.useClassicEditor) {
        // Check if content is already in block format
        if (!params.content.includes('<!-- wp:')) {
          // Assume markdown input and convert to blocks
          contentHtml = blockConverter.markdownToBlocks(params.content);
        }
      }

      updateData.content = contentHtml;
    }

    // Handle categories if provided
    if (params.categories && params.categories.length > 0) {
      updateData.categories = await this.resolveCategories(params.categories, wpClient);
    }

    // Handle tags if provided
    if (params.tags && params.tags.length > 0) {
      updateData.tags = await this.resolveTags(params.tags, wpClient);
    }

    // Update the post - WordPress handles permission checking
    const post = await wpClient.updatePost(params.postId, updateData);

    return {
      success: true,
      postId: post.id,
      title: post.title.rendered,
      status: post.status,
      editLink: post.link + '?preview=true',
      message: `Draft updated: "${post.title.rendered}"`,
    };
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
