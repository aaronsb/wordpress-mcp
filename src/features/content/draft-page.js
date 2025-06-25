/**
 * Draft Page Feature
 * 
 * Creates a draft page with WordPress blocks for review before publishing
 * Pages are static content that form site structure, unlike time-based blog posts
 */

import { BlockConverter } from '../../core/block-converter.js';
import blocksConfig from '../../../config/blocks.json' assert { type: 'json' };

export default {
  name: 'draft-page',
  description: 'Create a draft page using WordPress blocks for static content. Pages are used for permanent site content like About, Services, or Contact pages - not for blog posts or news articles.',

  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Page title (e.g., "About Us", "Our Services", "Contact Information")',
      },
      content: {
        type: 'string',
        description: 'Page content (Markdown format preferred) - typically evergreen content',
      },
      parent: {
        type: 'number',
        description: 'Parent page ID to create hierarchical structure (e.g., Services > Web Design)',
      },
      menu_order: {
        type: 'number',
        description: 'Order for page in navigation menus (optional)',
        default: 0,
      },
      template: {
        type: 'string',
        description: 'Custom page template to use (optional, e.g., "full-width", "landing-page")',
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

      // Prepare page data - always draft status for this feature
      const pageData = {
        title: { raw: params.title },
        content: { raw: contentHtml },
        status: 'draft',
        parent: params.parent || 0,
        menu_order: params.menu_order || 0,
      };

      // Add template if specified
      if (params.template) {
        pageData.template = params.template;
      }

      // Create the draft page
      const page = await wpClient.createPage(pageData);

      // Provide context about the page hierarchy
      let hierarchyInfo = '';
      if (page.parent) {
        try {
          const parentPage = await wpClient.getPage(page.parent);
          hierarchyInfo = ` under "${parentPage.title.rendered}"`;
        } catch (e) {
          hierarchyInfo = ' as a child page';
        }
      }

      return {
        success: true,
        pageId: page.id,
        title: page.title.rendered,
        status: 'draft',
        editLink: `${wpClient.baseUrl}/wp-admin/post.php?post=${page.id}&action=edit`,
        previewLink: page.link + '?preview=true',
        message: `Draft page created${hierarchyInfo}: "${params.title}"`,
        semanticContext: {
          type: 'page',
          purpose: 'static_content',
          hint: 'This is a page, not a post. Pages are for timeless content that forms your site structure.',
          examples: ['About Us', 'Services', 'Contact', 'Privacy Policy', 'Team'],
        }
      };
    } catch (error) {
      throw new Error(`Failed to create draft page: ${error.message}`);
    }
  },
};