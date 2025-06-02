/**
 * Draft Article Feature
 *
 * Creates a draft article - available to all personalities
 */

export default {
  name: 'draft-article',
  description: 'Create a draft article that can be reviewed before publishing',

  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Article title',
      },
      content: {
        type: 'string',
        description: 'Article content (HTML or plain text)',
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
    },
    required: ['title', 'content'],
  },

  async execute(params, context) {
    const { wpClient } = context;

    try {
      // Prepare post data
      const postData = {
        title: params.title,
        content: params.content,
        status: 'draft', // Always draft for this feature
        excerpt: params.excerpt || '',
      };

      // Handle categories if provided
      if (params.categories && params.categories.length > 0) {
        postData.categories = await this.resolveCategories(params.categories, wpClient);
      }

      // Handle tags if provided
      if (params.tags && params.tags.length > 0) {
        postData.tags = await this.resolveTags(params.tags, wpClient);
      }

      // Create the post
      const post = await wpClient.createPost(postData);

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
