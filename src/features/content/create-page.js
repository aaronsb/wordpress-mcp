/**
 * Create Page Feature
 * 
 * Creates static pages with WordPress blocks (not blog posts) - for building site structure
 * Pages are hierarchical and typically used for permanent content like About, Contact, Services, etc.
 */

import { BlockConverter } from '../../core/block-converter.js';
import blocksConfig from '../../../config/blocks.json' assert { type: 'json' };

export default {
  name: 'create-page',
  description: 'Create a static page using WordPress blocks for permanent content (not a blog post). Pages are hierarchical and used for site structure like About, Contact, or Service pages.',

  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Page title (e.g., "About Us", "Contact", "Services")',
      },
      content: {
        type: 'string',
        description: 'Page content (Markdown format preferred)',
      },
      status: {
        type: 'string',
        enum: ['draft', 'publish', 'private'],
        default: 'draft',
        description: 'Publication status (pages cannot be scheduled like posts)',
      },
      parent: {
        type: 'number',
        description: 'Parent page ID for hierarchical structure (optional)',
      },
      menu_order: {
        type: 'number',
        description: 'Order for page in menus (lower numbers appear first)',
        default: 0,
      },
      template: {
        type: 'string',
        description: 'Page template filename (e.g., "full-width.php", "contact.php")',
      },
      featured_media: {
        type: 'number',
        description: 'Featured image ID (optional)',
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

      // Prepare page data
      const pageData = {
        title: typeof params.title === 'string' ? { raw: params.title } : params.title,
        content: { raw: contentHtml },
        status: params.status || 'draft',
        parent: params.parent || 0,
        menu_order: params.menu_order || 0,
      };

      // Add optional fields if provided
      if (params.template) {
        pageData.template = params.template;
      }
      if (params.featured_media) {
        pageData.featured_media = params.featured_media;
      }

      // Create the page using the pages endpoint
      const page = await wpClient.createPage(pageData);

      // Build parent path if page has a parent
      let pagePath = '';
      if (page.parent) {
        try {
          const parentPage = await wpClient.getPage(page.parent);
          pagePath = `${parentPage.slug}/`;
        } catch (e) {
          // If we can't get parent, just use the page slug
        }
      }
      pagePath += page.slug;

      return {
        success: true,
        pageId: page.id,
        title: page.title.rendered,
        status: page.status,
        link: page.link,
        path: `/${pagePath}`,
        parent: page.parent,
        message: `Page "${params.title}" created successfully${page.parent ? ' as a child page' : ''}`,
        semanticContext: {
          type: 'page',
          description: 'Static page for site structure',
          usage: 'Use pages for permanent content that forms your site structure, not for time-based blog content',
        }
      };
    } catch (error) {
      throw new Error(`Failed to create page: ${error.message}`);
    }
  },
};