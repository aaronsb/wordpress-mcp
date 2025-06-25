# Block Editor Refactor Specification

## Overview

This specification outlines the refactoring of WordPress MCP content creation and editing tools to use WordPress blocks (Gutenberg) as the default format, while maintaining the clean markdown editing experience for AI interactions.

## Core Principles

1. **Blocks by Default** - All content creation uses WordPress blocks, no classic editor
2. **Semantic Block Abstraction** - AI works with human-readable block representations, not raw Gutenberg HTML comments
3. **Document Session Context** - Block editing operates within existing document sessions
4. **Change Tracking** - Only modified blocks are sent back to WordPress
5. **Graceful Markdown Import** - Special tool for one-off markdown imports

## Architecture Changes

### 1. Content Creation Updates

All content creation features will be updated to generate block-formatted content:

#### Current State
```javascript
// Creates classic content
content: { raw: "<p>Hello world</p>" }
```

#### New State
```javascript
// Creates block content
content: { 
  raw: '<!-- wp:paragraph -->\n<p>Hello world</p>\n<!-- /wp:paragraph -->' 
}
```

#### Affected Features
- `draft-article`
- `create-article` (publish-article)
- `draft-page`
- `create-page`
- `edit-draft`

### 2. Document Session Enhancement

#### Current Session Structure
```javascript
{
  documentHandle: "wp-session-abc123",
  contentType: "post",
  contentId: 42,
  content: "markdown content"
}
```

#### Enhanced Session Structure
```javascript
{
  documentHandle: "wp-session-abc123",
  contentType: "post",
  contentId: 42,
  format: "blocks", // or "classic"
  blocks: [
    {
      id: "block-1",
      type: "core/paragraph",
      attributes: { fontSize: "large" },
      content: "This is a paragraph with large text",
      originalHash: "abc123", // for change detection
      position: 0
    },
    {
      id: "block-2", 
      type: "core/heading",
      attributes: { level: 2 },
      content: "Section Title",
      originalHash: "def456",
      position: 1
    }
  ],
  // Fallback markdown representation for read-only viewing
  markdownView: "# Title\n\nContent..."
}
```

### 3. New Block Editing Tools

These tools work only within active document sessions:

#### `list-blocks`
```javascript
{
  name: 'list-blocks',
  description: 'List all blocks in the current document session',
  inputSchema: {
    properties: {
      documentHandle: { type: 'string' },
      filter: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Filter by block type' },
          hasContent: { type: 'boolean', description: 'Only show blocks with content' }
        }
      }
    },
    required: ['documentHandle']
  }
}

// Response format
{
  blocks: [
    {
      id: "block-1",
      type: "core/paragraph",
      preview: "This is a paragraph with large text...",
      position: 0,
      attributes: { fontSize: "large" }
    }
  ]
}
```

#### `read-block`
```javascript
{
  name: 'read-block',
  description: 'Read a specific block by ID',
  inputSchema: {
    properties: {
      documentHandle: { type: 'string' },
      blockId: { type: 'string' }
    },
    required: ['documentHandle', 'blockId']
  }
}
```

#### `edit-block`
```javascript
{
  name: 'edit-block',
  description: 'Edit block content and/or attributes',
  inputSchema: {
    properties: {
      documentHandle: { type: 'string' },
      blockId: { type: 'string' },
      content: { type: 'string', description: 'New content (optional)' },
      attributes: { type: 'object', description: 'Block attributes to update (optional)' },
      validateImmediately: { 
        type: 'boolean', 
        default: true,
        description: 'Validate block after edit (recommended)' 
      }
    },
    required: ['documentHandle', 'blockId']
  },
  
  // Implementation includes immediate validation
  async execute(params, context) {
    const { session, validator } = context;
    
    // Apply the edit
    const block = session.updateBlock(params.blockId, {
      content: params.content,
      attributes: params.attributes
    });
    
    // Immediate validation
    if (params.validateImmediately !== false) {
      const errors = await validator.validateBlock(block);
      if (errors.length > 0) {
        // Revert the change
        session.revertBlock(params.blockId);
        
        return {
          success: false,
          errors,
          suggestion: 'The block would be invalid. Common fixes:\n' +
                     this.getSuggestionsForErrors(errors),
          validAttributes: this.getValidAttributesForType(block.type)
        };
      }
    }
    
    return {
      success: true,
      block: block,
      message: 'Block updated and validated successfully'
    };
  }
}
```

#### `insert-block`
```javascript
{
  name: 'insert-block',
  description: 'Insert a new block at specified position',
  inputSchema: {
    properties: {
      documentHandle: { type: 'string' },
      type: { type: 'string', description: 'Block type (e.g., core/paragraph)' },
      content: { type: 'string' },
      position: { type: 'number', description: 'Insert position (0-based)' },
      attributes: { type: 'object', description: 'Block attributes (optional)' },
      validateImmediately: { type: 'boolean', default: true }
    },
    required: ['documentHandle', 'type', 'content', 'position']
  },
  
  async execute(params, context) {
    const { session, validator } = context;
    
    // Create the block
    const newBlock = {
      id: session.generateBlockId(),
      type: params.type,
      content: params.content,
      attributes: params.attributes || {}
    };
    
    // Validate BEFORE inserting
    if (params.validateImmediately !== false) {
      const errors = await validator.validateBlock(newBlock);
      if (errors.length > 0) {
        return {
          success: false,
          errors,
          suggestion: `Cannot insert invalid block. Issues:\n${errors.join('\n')}`,
          validTypes: validator.getValidBlockTypes(),
          exampleAttributes: validator.getExampleAttributes(params.type)
        };
      }
    }
    
    // Only insert if valid
    session.insertBlock(newBlock, params.position);
    
    return {
      success: true,
      blockId: newBlock.id,
      message: `${params.type} block inserted at position ${params.position}`
    };
  }
}
```

#### `delete-block`
```javascript
{
  name: 'delete-block',
  description: 'Delete a block',
  inputSchema: {
    properties: {
      documentHandle: { type: 'string' },
      blockId: { type: 'string' }
    },
    required: ['documentHandle', 'blockId']
  }
}
```

#### `reorder-blocks`
```javascript
{
  name: 'reorder-blocks',
  description: 'Change block order',
  inputSchema: {
    properties: {
      documentHandle: { type: 'string' },
      blockId: { type: 'string' },
      newPosition: { type: 'number', description: 'New position (0-based)' }
    },
    required: ['documentHandle', 'blockId', 'newPosition']
  }
}
```

### 4. Block Representation for AI

Instead of showing raw Gutenberg HTML comments, blocks will be presented in a semantic format:

#### Raw WordPress Format (Hidden from AI)
```html
<!-- wp:paragraph {"fontSize":"large"} -->
<p class="has-large-font-size">This is a paragraph with large text</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>Section Title</h2>
<!-- /wp:heading -->
```

#### AI-Friendly Format
```
[Block #block-1: Paragraph (fontSize: large)]
This is a paragraph with large text

[Block #block-2: Heading (level: 2)]
Section Title
```

### 5. Block Validation

#### Pre-commit Validation
The system should validate blocks before syncing to prevent errors:

```javascript
{
  name: 'validate-blocks',
  description: 'Validate block structure without saving to WordPress',
  inputSchema: {
    properties: {
      documentHandle: { type: 'string' },
      blocks: { 
        type: 'array',
        description: 'Specific blocks to validate (optional, validates all if not provided)'
      }
    },
    required: ['documentHandle']
  }
}
```

#### Validation Methods

1. **Client-side Validation**
```javascript
class BlockValidator {
  validateBlock(block) {
    const errors = [];
    
    // Check block type is registered
    if (!this.registeredBlocks.has(block.type)) {
      errors.push(`Unknown block type: ${block.type}`);
    }
    
    // Validate required attributes
    const schema = this.blockSchemas.get(block.type);
    if (schema) {
      errors.push(...this.validateAttributes(block.attributes, schema));
    }
    
    // Check format support
    if (block.content) {
      errors.push(...this.validateFormats(block));
    }
    
    return errors;
  }
}
```

2. **WordPress API Validation**
```javascript
// Use WordPress block parser endpoint
async validateWithWordPress(blocks) {
  const blockHtml = this.blocksToHtml(blocks);
  
  // WordPress parse endpoint validates without saving
  const response = await wpClient.request('/wp/v2/block-renderer/validate', {
    method: 'POST',
    body: JSON.stringify({ content: blockHtml })
  });
  
  return response.valid ? [] : response.errors;
}
```

3. **Dry Run Updates**
```javascript
// Test update without committing
async dryRunSync(contentId, blocks) {
  const response = await wpClient.request(`/wp/v2/posts/${contentId}`, {
    method: 'POST',
    headers: {
      'X-WP-Dry-Run': 'true' // Custom header for validation only
    },
    body: JSON.stringify({
      content: { raw: this.blocksToHtml(blocks) }
    })
  });
  
  return response.validation_result;
}
```

### 6. Sync Optimization

The `sync-to-wordpress` feature will be enhanced to:

1. **Pre-validate blocks** before attempting sync
2. Compare block hashes to detect changes
3. Build minimal update payload with only changed blocks
4. Use WordPress block-specific update endpoints when available
5. Fall back to full content update if necessary

```javascript
// Enhanced sync with validation
async syncToWordPress(session) {
  // Step 1: Validate all changed blocks
  const validation = await this.validateBlocks(session.getChangedBlocks());
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      suggestion: 'Use validate-blocks to see specific issues'
    };
  }
  
  // Step 2: Build optimized update
  const changes = {
    changedBlocks: ["block-1", "block-5"],
    deletedBlocks: ["block-3"],
    insertedBlocks: ["block-7", "block-8"]
  };
  
  // Step 3: Sync with confidence
  return await this.performSync(changes);
}
```

### 7. Markdown Import Tool

A special-purpose tool for importing markdown directly as a WordPress page:

```javascript
{
  name: 'publish-markdown-as-page',
  description: 'Convert markdown file/content directly to WordPress page with automatic block conversion',
  inputSchema: {
    properties: {
      source: { 
        type: 'string', 
        description: 'Absolute file path or markdown content' 
      },
      sourceType: { 
        type: 'string', 
        enum: ['file', 'content'] 
      },
      title: { 
        type: 'string', 
        description: 'Page title (extracted from markdown if not provided)' 
      },
      parent: { 
        type: 'number', 
        description: 'Parent page ID (optional)' 
      },
      status: { 
        type: 'string', 
        enum: ['draft', 'publish', 'private'],
        default: 'publish'
      }
    },
    required: ['source', 'sourceType']
  }
}
```

## Inline Formatting & Plugin Support

### Core Format Handling

WordPress blocks support inline formatting within text content. The system must handle both core WordPress formats and plugin-specific formats gracefully.

#### Core Formats (Always Available)
```javascript
const CORE_FORMATS = {
  'core/bold': { markdown: '**text**', html: '<strong>text</strong>' },
  'core/italic': { markdown: '*text*', html: '<em>text</em>' },
  'core/link': { markdown: '[text](url)', html: '<a href="url">text</a>' },
  'core/code': { markdown: '`code`', html: '<code>code</code>' },
  'core/strikethrough': { markdown: '~~text~~', html: '<s>text</s>' },
  'core/subscript': { markdown: null, html: '<sub>text</sub>' },
  'core/superscript': { markdown: null, html: '<sup>text</sup>' }
};
```

#### Plugin Format Detection
```javascript
class FormatRegistry {
  async detectAvailableFormats(wpClient) {
    // Query WordPress for registered formats
    const formats = await wpClient.request('/wp/v2/block-renderer/formats');
    
    // Build a map of available formats with fallback strategies
    return new Map(formats.map(f => [
      f.name,
      {
        ...f,
        fallback: this.determineFallback(f)
      }
    ]));
  }
}
```

#### AI-Friendly Format Syntax
For plugin-specific formats, use a clear syntax that AI can understand:

```markdown
[Block #1: Paragraph]
This is **bold text** and *italic text*. 
Here's {{highlight:yellow}}highlighted content{{/highlight}}.
And a {{tooltip:"Definition here"}}term{{/tooltip}} with explanation.
```

#### Fallback Strategies
When a format isn't available:

```javascript
const FALLBACK_STRATEGIES = {
  'strip': (content) => content, // Remove formatting
  'bold': (content) => `<strong>${content}</strong>`, // Convert to bold
  'annotate': (content, format) => `${content} [${format}]`, // Add note
  'comment': (content, format) => `<!-- ${format} -->${content}<!-- /${format} -->` 
};
```

### Block-Specific Format Support

Different block types support different inline formats:

```javascript
const BLOCK_FORMAT_SUPPORT = {
  'core/paragraph': ['all'], // Supports all formats
  'core/heading': ['bold', 'italic', 'link'], // Limited formatting
  'core/button': ['bold', 'italic'], // Very limited
  'core/code': [], // No formatting
  'core/list': ['bold', 'italic', 'link', 'code'],
};
```

## Contextual Tool Descriptions

### Dynamic Description System

Tool descriptions must adapt based on context to guide AI behavior effectively.

#### Context Provider
```javascript
class ToolContextProvider {
  async getContext(toolName) {
    return {
      personality: this.server.personality,
      permissions: await this.getPermissions(),
      activeSession: this.sessionManager.getActive(),
      availableBlocks: await this.getAvailableBlocks(),
      formatSupport: await this.getFormatSupport(),
      siteCapabilities: await this.getSiteCapabilities(),
    };
  }
}
```

#### Enhanced Tool Definitions
```javascript
{
  name: 'edit-block',
  shortDescription: 'Edit block content and attributes',
  description: (context) => {
    const { session } = context;
    if (!session) {
      return 'Edit a block. Note: You must first use pull-for-editing to start a session.';
    }
    
    return `Edit a block in the current ${session.contentType} (#${session.contentId}).
    
Available blocks:
${session.blocks.map(b => `- ${b.id}: ${b.type} ("${b.preview.substring(0, 40)}...")`).join('\n')}

Common attributes by block type:
- Paragraph: fontSize, textAlign, dropCap
- Heading: level (1-6), textAlign
- List: ordered (true/false), reversed
- Image: alt, caption, linkDestination

Example: edit-block blockId="block-3" content="New text" attributes={fontSize: "large"}`;
  }
}
```

#### State-Aware Descriptions
```javascript
{
  name: 'sync-to-wordpress',
  description: (context) => {
    const { activeSession } = context;
    
    if (!activeSession) {
      return `Sync changes to WordPress. No active session - use pull-for-editing first.`;
    }
    
    const changes = activeSession.getChanges();
    return `Sync ${changes.total} changes to WordPress ${activeSession.contentType} #${activeSession.contentId}:
- Modified blocks: ${changes.modified.length}
- New blocks: ${changes.added.length}  
- Deleted blocks: ${changes.deleted.length}

Options:
- closeSession: Auto-cleanup after sync (default: false)
- validateBlocks: Validate before syncing (default: true)`;
  }
}
```

#### Role-Based Descriptions
```javascript
{
  name: 'bulk-content-operations',
  description: (context) => {
    const { personality } = context;
    
    const baseDesc = `Perform bulk operations on multiple posts or pages.`;
    
    const examples = personality === 'administrator' 
      ? '\nExamples:\n- Delete all posts in trash\n- Change status of multiple pages\n- Bulk restore deleted content'
      : '\nExamples:\n- Move multiple drafts to trash\n- Change visibility of posts\n- Restore recently trashed items';
      
    return baseDesc + examples;
  }
}
```

### Progressive Disclosure

Tools should provide increasing detail as needed:

```javascript
{
  name: 'insert-block',
  // Basic info for discovery
  shortDescription: 'Insert a new block',
  
  // Detailed info when considering the tool
  description: (context) => generateDetailedDescription(context),
  
  // Rich examples based on current state
  examples: (context) => {
    const session = context.activeSession;
    if (!session) return [];
    
    return [
      {
        description: 'Add a paragraph after current content',
        code: `insert-block type="core/paragraph" content="New paragraph" position=${session.blocks.length}`
      },
      {
        description: 'Insert a heading at the beginning',
        code: 'insert-block type="core/heading" content="Introduction" position=0 attributes={level: 2}'
      }
    ];
  }
}
```

## Conversion Pipeline

### Markdown to Blocks

The system will convert markdown elements to appropriate WordPress blocks:

| Markdown | WordPress Block |
|----------|----------------|
| `# Heading` | `core/heading` (level: 1) |
| `## Subheading` | `core/heading` (level: 2) |
| `Paragraph text` | `core/paragraph` |
| `- List item` | `core/list` |
| `> Quote` | `core/quote` |
| `` `code` `` | `core/code` |
| `![image](url)` | `core/image` |
| `---` | `core/separator` |
| Tables | `core/table` |

### Smart Block Detection

Advanced patterns will be detected and converted:

1. **Column Detection**: Adjacent content sections → `core/columns`
2. **Media & Text**: Image followed by text → `core/media-text`
3. **Button Links**: Links on their own line → `core/button`
4. **Embed Detection**: URLs on their own line → appropriate embed block

## Implementation Phases

### Phase 1: Block Creation (Priority)
- Update all content creation features to generate blocks
- Implement basic markdown → block conversion
- Ensure backwards compatibility

### Phase 2: Enhanced Document Sessions
- Add block parsing to `pull-for-editing`
- Store block structure in sessions
- Implement block change tracking

### Phase 3: Block Editing Tools
- Implement block CRUD operations
- Add block-specific tools to document sessions
- Create AI-friendly block representations

### Phase 4: Optimization
- Implement partial block updates
- Add block caching
- Performance optimization

### Phase 5: Advanced Features
- Block patterns and reusable blocks
- Custom block support
- Block validation and constraints

## Migration Strategy

1. **Feature Flag**: Add `ENABLE_BLOCKS` configuration option
2. **Content Detection**: Check if content has blocks on pull
3. **Gradual Rollout**: Test with individual features before full deployment
4. **Fallback Handling**: Gracefully handle sites without block support

## Configuration & Settings

### Format Configuration
```javascript
{
  blocks: {
    enabled: true, // Master switch for block support
    fallbackToClassic: true, // Use classic if blocks unavailable
    formats: {
      detectPluginFormats: true,
      fallbackStrategy: 'annotate', // 'strip', 'bold', 'comment'
      customFormatSyntax: '{{format:params}}content{{/format}}',
      preserveUnknownFormats: false
    }
  },
  descriptions: {
    contextual: true, // Enable dynamic descriptions
    verbosity: 'adaptive', // 'minimal', 'normal', 'detailed'
    includeExamples: true,
    showAvailableBlocks: true
  }
}
```

## Testing Requirements

1. **Block Generation**: Verify all creation tools produce valid blocks
2. **Conversion Accuracy**: Test markdown → block conversion fidelity
3. **Change Detection**: Ensure only modified blocks are synced
4. **AI Interaction**: Validate AI can understand and manipulate blocks
5. **Backwards Compatibility**: Classic content still works
6. **Format Handling**: Test core and plugin format conversions
7. **Fallback Behavior**: Verify graceful degradation
8. **Context Descriptions**: Ensure descriptions adapt properly

## Error Prevention Strategy

### Immediate Validation Benefits

By validating on each block operation:

1. **Early Error Detection** - Catch issues immediately, not after 10+ edits
2. **Clear Error Context** - AI knows exactly which operation failed
3. **Guided Recovery** - Provide valid alternatives with each error
4. **Prevent Cascading Failures** - One bad block doesn't corrupt the session

### Session Integrity

```javascript
class DocumentSession {
  constructor() {
    this.blocks = [];
    this.history = []; // For undo operations
    this.validationCache = new Map();
  }
  
  // Every operation is atomic and validated
  updateBlock(blockId, changes) {
    const backup = this.cloneBlock(blockId);
    
    try {
      const updated = this.applyChanges(blockId, changes);
      const errors = this.validator.validate(updated);
      
      if (errors.length > 0) {
        this.restoreBlock(blockId, backup);
        throw new ValidationError(errors);
      }
      
      this.history.push({ op: 'update', blockId, backup });
      return updated;
      
    } catch (error) {
      // Session remains valid even if operation fails
      this.restoreBlock(blockId, backup);
      throw error;
    }
  }
}
```

### Progressive Validation Levels

1. **Syntax Validation** - Is this valid block markup?
2. **Schema Validation** - Are attributes correct for this block type?
3. **Context Validation** - Is this block valid in this position?
4. **Content Validation** - Are inline formats supported?
5. **WordPress Validation** - Will WordPress accept this?

## Success Criteria

1. All new content is created with blocks
2. AI can effectively edit block-based content
3. No degradation in editing experience
4. Improved sync performance with partial updates
5. Clear separation between regular flow and import tool
6. **Zero invalid blocks reach WordPress** - All errors caught early
7. **AI success rate improves** - Fewer retry attempts needed
8. **Clear error guidance** - AI always knows how to fix issues