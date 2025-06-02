/**
 * Manage Own Drafts Feature
 *
 * List, search and organize own draft content - contributor workflow
 */

export default {
  name: 'manage-own-drafts',
  description: 'View and organize your draft articles. Use this instead of querying posts directly - it provides a contributor-focused workflow view.',

  inputSchema: {
    type: 'object',
    properties: {
      search: {
        type: 'string',
        description: 'Search drafts by title or content',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of drafts to return (default: 10)',
        default: 10,
      },
      orderBy: {
        type: 'string',
        description: 'Sort order for drafts',
        enum: ['date', 'modified', 'title'],
        default: 'modified',
      },
    },
  },

  async execute(params, context) {
    const { wpClient } = context;

    try {
      // Get current user to filter to own drafts only
      const currentUser = await wpClient.executeFeature('resource-users/me');
      
      // Query own drafts using Feature API
      const queryParams = {
        author: [currentUser.id],
        status: ['draft'],
        per_page: params.limit || 10,
        orderby: params.orderBy || 'modified',
        order: 'desc',
      };

      // Add search if provided
      if (params.search) {
        queryParams.search = params.search;
      }

      const drafts = await wpClient.executeFeature('resource-posts', queryParams);

      // Format for contributor workflow
      const formattedDrafts = drafts.map(draft => ({
        id: draft.id,
        title: draft.title.rendered,
        excerpt: draft.excerpt.rendered.replace(/<[^>]*>/g, '').trim() || 'No excerpt',
        lastModified: new Date(draft.modified).toLocaleDateString(),
        wordCount: this.estimateWordCount(draft.content.rendered),
        status: draft.status,
        editLink: `${draft.link}?preview=true`,
        canEdit: true, // Contributors can always edit their own drafts
      }));

      return {
        success: true,
        drafts: formattedDrafts,
        total: formattedDrafts.length,
        summary: {
          totalDrafts: formattedDrafts.length,
          searchTerm: params.search || null,
          sortedBy: params.orderBy || 'modified',
        },
        message: `Found ${formattedDrafts.length} draft${formattedDrafts.length === 1 ? '' : 's'}`,
      };
    } catch (error) {
      throw new Error(`Failed to retrieve drafts: ${error.message}`);
    }
  },

  // Helper method to estimate word count
  estimateWordCount(htmlContent) {
    // Strip HTML tags and count words
    const textContent = htmlContent.replace(/<[^>]*>/g, ' ').trim();
    return textContent ? textContent.split(/\s+/).length : 0;
  },
};