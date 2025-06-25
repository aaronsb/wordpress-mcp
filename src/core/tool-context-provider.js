/**
 * Tool Context Provider
 * 
 * Provides dynamic context for tool descriptions based on current state
 */

export class ToolContextProvider {
  constructor(server) {
    this.server = server;
  }

  /**
   * Get context for a specific tool
   */
  async getContext(toolName) {
    const context = {
      personality: this.server.personality,
      permissions: await this.getPermissions(),
      activeSession: await this.getActiveSession(),
      availableBlocks: this.getAvailableBlocks(),
      formatSupport: this.getFormatSupport(),
      siteCapabilities: await this.getSiteCapabilities(),
    };

    return context;
  }

  /**
   * Get user permissions
   */
  async getPermissions() {
    try {
      if (this.server.wpClient) {
        const user = await this.server.wpClient.getCurrentUser();
        return user.capabilities || {};
      }
    } catch (error) {
      // Fallback to personality-based permissions
    }

    // Default permissions based on personality
    const personalityPermissions = {
      author: ['edit_posts', 'upload_files', 'edit_published_posts'],
      editor: ['edit_posts', 'edit_others_posts', 'edit_pages', 'publish_posts', 'moderate_comments'],
      administrator: ['manage_options', 'edit_posts', 'edit_pages', 'manage_categories', 'moderate_comments'],
    };

    return personalityPermissions[this.server.personality] || [];
  }

  /**
   * Get active editing session info
   */
  async getActiveSession() {
    if (!this.server.documentSessionManager) {
      return null;
    }

    const sessions = this.server.documentSessionManager.getActiveSessions();
    if (sessions.length === 0) {
      return null;
    }

    // Get the most recent session
    const latestSession = sessions[0];
    
    try {
      const sessionInfo = await this.server.documentSessionManager.getSessionInfo(latestSession.documentHandle);
      const blockSession = this.server.documentSessionManager.getBlockSession(latestSession.documentHandle);
      
      return {
        ...sessionInfo,
        blocks: blockSession ? blockSession.blocks : [],
        changes: blockSession ? blockSession.getChanges() : { total: 0 },
      };
    } catch (error) {
      return latestSession;
    }
  }

  /**
   * Get available block types
   */
  getAvailableBlocks() {
    return [
      { type: 'core/paragraph', name: 'Paragraph', description: 'Basic text block' },
      { type: 'core/heading', name: 'Heading', description: 'Section headings (H1-H6)' },
      { type: 'core/list', name: 'List', description: 'Bulleted or numbered lists' },
      { type: 'core/quote', name: 'Quote', description: 'Blockquotes with citation' },
      { type: 'core/code', name: 'Code', description: 'Code blocks with syntax highlighting' },
      { type: 'core/image', name: 'Image', description: 'Images with captions' },
      { type: 'core/separator', name: 'Separator', description: 'Visual divider between sections' },
      { type: 'core/table', name: 'Table', description: 'Data tables' },
    ];
  }

  /**
   * Get supported inline formats
   */
  getFormatSupport() {
    return {
      core: ['bold', 'italic', 'link', 'code', 'strikethrough'],
      extended: ['subscript', 'superscript'],
      plugin: [], // Would be populated from WordPress
    };
  }

  /**
   * Get site capabilities
   */
  async getSiteCapabilities() {
    return {
      blocks: true,
      classicEditor: false,
      restApi: true,
      applicationPasswords: true,
    };
  }

  /**
   * Generate dynamic description for a tool
   */
  async generateDescription(tool, baseDescription) {
    const context = await this.getContext(tool.name);
    
    // Tools with session-aware descriptions
    const sessionAwareTools = [
      'edit-block', 'insert-block', 'delete-block', 'list-blocks',
      'sync-to-wordpress', 'validate-blocks', 'reorder-blocks'
    ];

    if (sessionAwareTools.includes(tool.name) && !context.activeSession) {
      return `${baseDescription}\n\nNote: You must first use pull-for-editing to start an editing session.`;
    }

    // Generate specific descriptions based on tool
    switch (tool.name) {
      case 'pull-for-editing':
        return this.describePullForEditing(context);
      case 'edit-block':
        return this.describeEditBlock(context);
      case 'insert-block':
        return this.describeInsertBlock(context);
      case 'sync-to-wordpress':
        return this.describeSyncToWordPress(context);
      case 'bulk-content-operations':
        return this.describeBulkOperations(context);
      case 'draft-article':
      case 'create-article':
        return this.describeArticleCreation(context, baseDescription);
      case 'list-blocks':
        return this.describeListBlocks(context);
      default:
        return baseDescription;
    }
  }

  /**
   * Tool-specific description generators
   */

  describePullForEditing(context) {
    if (context.activeSession) {
      return `Fetch a WordPress post or page into an editing session.

⚠️ You already have an active session for ${context.activeSession.contentType} #${context.activeSession.contentId}.
Consider using sync-to-wordpress or close-editing-session before starting a new session.`;
    }

    return `Fetch a WordPress post or page into an editing session.

This creates a block-based editing environment where you can:
- List and read individual blocks
- Edit blocks with immediate validation
- Insert, delete, and reorder blocks
- Validate changes before syncing

After pulling content, use the block editing tools to make changes.`;
  }

  describeEditBlock(context) {
    if (!context.activeSession) {
      return 'Edit block content and attributes. Note: You must first use pull-for-editing to start a session.';
    }

    const { blocks } = context.activeSession;
    const blockList = blocks.slice(0, 5).map(b => 
      `- ${b.id}: ${b.type} ("${b.preview.substring(0, 40)}...")`
    ).join('\n');

    return `Edit a block in the current ${context.activeSession.contentType} (#${context.activeSession.contentId}).

Available blocks:
${blockList}${blocks.length > 5 ? `\n... and ${blocks.length - 5} more blocks` : ''}

Common attributes by block type:
- Paragraph: fontSize, textAlign, dropCap
- Heading: level (1-6), textAlign
- List: ordered (true/false), reversed
- Image: alt, caption, linkDestination

Example: edit-block blockId="block-3" content="New text" attributes={fontSize: "large"}`;
  }

  describeInsertBlock(context) {
    if (!context.activeSession) {
      return 'Insert a new block at specified position. Note: You must first use pull-for-editing to start a session.';
    }

    const availableTypes = context.availableBlocks.map(b => 
      `- ${b.type}: ${b.description}`
    ).join('\n');

    return `Insert a new block in the current ${context.activeSession.contentType}.

Current document has ${context.activeSession.blocks.length} blocks.

Available block types:
${availableTypes}

Examples:
- insert-block type="core/paragraph" content="New paragraph" position=${context.activeSession.blocks.length}
- insert-block type="core/heading" content="Introduction" position=0 attributes={level: 2}

Blocks are validated before insertion to prevent errors.`;
  }

  describeSyncToWordPress(context) {
    if (!context.activeSession) {
      return 'Push editing session changes back to WordPress. No active session - use pull-for-editing first.';
    }

    const { changes } = context.activeSession;
    if (changes.total === 0) {
      return `Sync changes to WordPress ${context.activeSession.contentType} #${context.activeSession.contentId}.

ℹ️ No changes detected. The document is already in sync with WordPress.`;
    }

    return `Sync ${changes.total} changes to WordPress ${context.activeSession.contentType} #${context.activeSession.contentId}:
- Modified blocks: ${changes.modified.length}
- New blocks: ${changes.added.length}  
- Deleted blocks: ${changes.deleted.length}

Options:
- closeSession: Auto-cleanup after sync (default: false)

All blocks are validated before syncing to ensure WordPress compatibility.`;
  }

  describeBulkOperations(context) {
    const baseDesc = 'Perform bulk operations on multiple posts or pages.';
    
    const examples = context.personality === 'administrator' 
      ? `
Examples:
- Delete all posts in trash
- Change status of multiple pages
- Bulk restore deleted content
- Manage content across the entire site`
      : context.personality === 'editor'
      ? `
Examples:
- Move multiple drafts to trash
- Change visibility of posts
- Restore recently trashed items
- Manage content from multiple authors`
      : `
Examples:
- Trash your own draft posts
- Restore your recently deleted content
- Manage your own content in bulk`;
      
    return baseDesc + examples;
  }

  describeArticleCreation(context, baseDescription) {
    const blockInfo = `

This tool creates content using WordPress blocks by default. Your content will be converted from Markdown to blocks automatically.

Supported Markdown:
- # Headings (H1-H6)
- **Bold** and *italic* text
- Lists (- item or 1. item)
- > Blockquotes
- \`inline code\` and code blocks
- [Links](url)
- ![Images](url)
- Tables

The content will be saved as modern WordPress blocks for better compatibility.`;

    return baseDescription + blockInfo;
  }

  describeListBlocks(context) {
    if (!context.activeSession) {
      return 'List all blocks in the current document session. Note: You must first use pull-for-editing to start a session.';
    }

    const { blocks } = context.activeSession;
    const blockTypes = {};
    blocks.forEach(b => {
      blockTypes[b.type] = (blockTypes[b.type] || 0) + 1;
    });

    const summary = Object.entries(blockTypes)
      .map(([type, count]) => `- ${type}: ${count} block${count > 1 ? 's' : ''}`)
      .join('\n');

    return `List all blocks in the current ${context.activeSession.contentType} (#${context.activeSession.contentId}).

Current document contains ${blocks.length} blocks:
${summary}

You can filter results by:
- type: Show only specific block types
- hasContent: Show only blocks with content

Example: list-blocks filter={type: "core/heading"}`;
  }

  /**
   * Generate examples for a tool based on context
   */
  async generateExamples(tool) {
    const context = await this.getContext(tool.name);
    
    switch (tool.name) {
      case 'edit-block':
        return this.getEditBlockExamples(context);
      case 'insert-block':
        return this.getInsertBlockExamples(context);
      default:
        return [];
    }
  }

  getEditBlockExamples(context) {
    if (!context.activeSession || context.activeSession.blocks.length === 0) {
      return [];
    }

    const firstBlock = context.activeSession.blocks[0];
    return [
      {
        description: 'Change text content',
        code: `edit-block blockId="${firstBlock.id}" content="Updated content"`
      },
      {
        description: 'Update block attributes',
        code: `edit-block blockId="${firstBlock.id}" attributes={fontSize: "large", textAlign: "center"}`
      },
      {
        description: 'Change both content and attributes',
        code: `edit-block blockId="${firstBlock.id}" content="New text" attributes={dropCap: true}`
      }
    ];
  }

  getInsertBlockExamples(context) {
    if (!context.activeSession) {
      return [];
    }

    const position = context.activeSession.blocks.length;
    return [
      {
        description: 'Add a paragraph at the end',
        code: `insert-block type="core/paragraph" content="New paragraph" position=${position}`
      },
      {
        description: 'Insert a heading at the beginning',
        code: `insert-block type="core/heading" content="Introduction" position=0 attributes={level: 2}`
      },
      {
        description: 'Add a list in the middle',
        code: `insert-block type="core/list" content="<ul><li>First item</li><li>Second item</li></ul>" position=${Math.floor(position / 2)}`
      }
    ];
  }
}