/**
 * Publish Markdown as Page Feature
 * 
 * Special-purpose tool for importing markdown directly as a WordPress page
 * This is the only tool that uses classic markdown conversion
 * Automatically converts to blocks via WordPress API when possible
 */

import { readFile } from 'fs/promises';
import { BlockConverter } from '../../core/block-converter.js';

export default {
  name: 'publish-markdown-as-page',
  description: 'Convert markdown file/content directly to WordPress page with automatic block conversion',

  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'Absolute file path or markdown content',
      },
      sourceType: {
        type: 'string',
        enum: ['file', 'content'],
        description: 'Whether source is a file path or direct content',
      },
      title: {
        type: 'string',
        description: 'Page title (extracted from markdown if not provided)',
      },
      parent: {
        type: 'number',
        description: 'Parent page ID (optional)',
      },
      status: {
        type: 'string',
        enum: ['draft', 'publish', 'private'],
        default: 'publish',
        description: 'Publication status',
      },
    },
    required: ['source', 'sourceType'],
  },

  async execute(params, context) {
    const { wpClient } = context;
    const blockConverter = new BlockConverter();

    try {
      let markdownContent;
      let extractedTitle = params.title;

      // Get markdown content
      if (params.sourceType === 'file') {
        // Read from file
        markdownContent = await readFile(params.source, 'utf8');
      } else {
        // Use provided content
        markdownContent = params.source;
      }

      // Extract title from markdown if not provided
      if (!extractedTitle) {
        const titleMatch = markdownContent.match(/^#\s+(.+)$/m);
        if (titleMatch) {
          extractedTitle = titleMatch[1];
          // Remove the title line from content
          markdownContent = markdownContent.replace(/^#\s+.+\n?/m, '');
        } else {
          extractedTitle = 'Imported Page';
        }
      }

      // Convert markdown to blocks
      const blockContent = blockConverter.markdownToBlocks(markdownContent);

      // Prepare page data
      const pageData = {
        title: { raw: extractedTitle },
        content: { raw: blockContent },
        status: params.status || 'publish',
        parent: params.parent || 0,
      };

      // Create the page
      const page = await wpClient.createPage(pageData);

      // Try to convert classic blocks to standard blocks via WordPress API
      if (page.content.raw.includes('<!-- wp:freeform -->')) {
        try {
          // Attempt block recovery/conversion
          const convertedContent = await this.convertClassicBlocks(page.id, wpClient);
          if (convertedContent && convertedContent !== page.content.raw) {
            // Update with converted content
            await wpClient.updatePage(page.id, {
              content: { raw: convertedContent }
            });
          }
        } catch (conversionError) {
          // Conversion is optional, don't fail the import
          console.log('Classic block conversion attempted but not successful:', conversionError.message);
        }
      }

      return {
        success: true,
        pageId: page.id,
        title: page.title.rendered,
        status: page.status,
        link: page.link,
        format: 'blocks',
        sourceType: params.sourceType,
        message: `Page "${extractedTitle}" created successfully from ${params.sourceType}`,
        parentId: page.parent || null,
        hasClassicBlocks: page.content.raw.includes('<!-- wp:freeform -->'),
      };

    } catch (error) {
      throw new Error(`Markdown import failed: ${error.message}`);
    }
  },

  /**
   * Attempt to convert classic blocks to standard blocks
   * Uses WordPress block parser/converter if available
   */
  async convertClassicBlocks(pageId, wpClient) {
    // Check if block-renderer endpoint supports conversion
    try {
      const response = await wpClient.request(`/block-renderer/convert`, {
        method: 'POST',
        body: JSON.stringify({
          post_id: pageId,
          convert_classic: true
        })
      });

      if (response.content) {
        return response.content;
      }
    } catch (error) {
      // Try alternative approach - parse and re-save
      try {
        const page = await wpClient.getPage(pageId);
        if (page.content.rendered) {
          // Re-parse the rendered content
          const blockConverter = new BlockConverter();
          return blockConverter.markdownToBlocks(
            blockConverter.htmlToMarkdown(page.content.rendered)
          );
        }
      } catch (fallbackError) {
        // Conversion failed, return null
        return null;
      }
    }

    return null;
  }
};