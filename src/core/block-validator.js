/**
 * Block Validator
 * 
 * Validates WordPress blocks before they reach WordPress
 * Implements immediate validation to prevent cascading errors
 */

export class BlockValidator {
  constructor() {
    // Core WordPress block types and their schemas
    this.blockSchemas = new Map([
      ['core/paragraph', {
        attributes: {
          align: { type: 'string', enum: ['left', 'center', 'right', 'wide', 'full'] },
          content: { type: 'string' },
          dropCap: { type: 'boolean' },
          placeholder: { type: 'string' },
          fontSize: { type: 'string' },
          textColor: { type: 'string' },
          backgroundColor: { type: 'string' },
        }
      }],
      ['core/heading', {
        attributes: {
          align: { type: 'string', enum: ['left', 'center', 'right'] },
          content: { type: 'string' },
          level: { type: 'number', minimum: 1, maximum: 6, required: true },
          placeholder: { type: 'string' },
          textColor: { type: 'string' },
          backgroundColor: { type: 'string' },
        }
      }],
      ['core/list', {
        attributes: {
          ordered: { type: 'boolean' },
          values: { type: 'string' },
          reversed: { type: 'boolean' },
          start: { type: 'number' },
        }
      }],
      ['core/quote', {
        attributes: {
          value: { type: 'string' },
          citation: { type: 'string' },
          align: { type: 'string', enum: ['left', 'center', 'right'] },
        }
      }],
      ['core/code', {
        attributes: {
          content: { type: 'string' },
        }
      }],
      ['core/image', {
        attributes: {
          url: { type: 'string', required: true },
          alt: { type: 'string' },
          caption: { type: 'string' },
          align: { type: 'string', enum: ['left', 'center', 'right', 'wide', 'full'] },
          width: { type: 'number' },
          height: { type: 'number' },
          linkDestination: { type: 'string' },
          link: { type: 'string' },
        }
      }],
      ['core/separator', {
        attributes: {
          className: { type: 'string' },
        }
      }],
      ['core/table', {
        attributes: {
          hasFixedLayout: { type: 'boolean' },
          caption: { type: 'string' },
          head: { type: 'array' },
          body: { type: 'array' },
          foot: { type: 'array' },
        }
      }],
    ]);

    // Format support by block type
    this.blockFormatSupport = new Map([
      ['core/paragraph', ['bold', 'italic', 'link', 'code', 'strikethrough', 'subscript', 'superscript']],
      ['core/heading', ['bold', 'italic', 'link']],
      ['core/list', ['bold', 'italic', 'link', 'code']],
      ['core/quote', ['bold', 'italic', 'link']],
      ['core/button', ['bold', 'italic']],
      ['core/code', []],
    ]);
  }

  /**
   * Validate a single block
   * @param {object} block - Block to validate
   * @returns {string[]} Array of validation errors
   */
  validateBlock(block) {
    const errors = [];

    // Level 1: Basic structure validation
    if (!block.type) {
      errors.push('Block must have a type');
      return errors; // Can't continue without type
    }

    if (!block.id) {
      errors.push('Block must have an id');
    }

    // Level 2: Block type validation
    if (!this.isValidBlockType(block.type)) {
      errors.push(`Unknown block type: ${block.type}`);
      const suggestion = this.suggestBlockType(block.type);
      if (suggestion) {
        errors.push(`Did you mean: ${suggestion}?`);
      }
    }

    // Level 3: Schema validation
    const schema = this.blockSchemas.get(block.type);
    if (schema) {
      const schemaErrors = this.validateAgainstSchema(block.attributes || {}, schema.attributes);
      errors.push(...schemaErrors);
    }

    // Level 4: Content validation
    if (block.content) {
      const contentErrors = this.validateContent(block);
      errors.push(...contentErrors);
    }

    // Level 5: Format validation
    if (block.content && this.blockFormatSupport.has(block.type)) {
      const formatErrors = this.validateFormats(block);
      errors.push(...formatErrors);
    }

    return errors;
  }

  /**
   * Validate multiple blocks in context
   * @param {object[]} blocks - Array of blocks to validate
   * @returns {object} Validation result with errors by block
   */
  validateBlocks(blocks) {
    const result = {
      valid: true,
      errors: [],
      blockErrors: new Map(),
    };

    // Validate each block individually
    blocks.forEach((block, index) => {
      const errors = this.validateBlock(block);
      if (errors.length > 0) {
        result.valid = false;
        result.blockErrors.set(block.id || `block-${index}`, errors);
        result.errors.push(`Block ${block.id || index}: ${errors.join(', ')}`);
      }
    });

    // Context validation (block relationships)
    const contextErrors = this.validateBlockContext(blocks);
    if (contextErrors.length > 0) {
      result.valid = false;
      result.errors.push(...contextErrors);
    }

    return result;
  }

  /**
   * Check if block type is valid
   */
  isValidBlockType(type) {
    return this.blockSchemas.has(type) || type.startsWith('core/');
  }

  /**
   * Suggest a similar valid block type
   */
  suggestBlockType(invalidType) {
    const validTypes = Array.from(this.blockSchemas.keys());
    
    // Simple suggestion based on partial match
    const match = validTypes.find(type => 
      type.includes(invalidType.replace('core/', '')) ||
      invalidType.includes(type.replace('core/', ''))
    );
    
    return match;
  }

  /**
   * Validate attributes against schema
   */
  validateAgainstSchema(attributes, schema) {
    const errors = [];

    // Check required attributes
    Object.entries(schema).forEach(([key, definition]) => {
      if (definition.required && !(key in attributes)) {
        errors.push(`Missing required attribute: ${key}`);
      }
    });

    // Validate attribute values
    Object.entries(attributes).forEach(([key, value]) => {
      const definition = schema[key];
      if (!definition) {
        // Unknown attribute - not necessarily an error
        return;
      }

      // Type validation
      if (definition.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== definition.type) {
          errors.push(`Attribute ${key} must be ${definition.type}, got ${actualType}`);
        }
      }

      // Enum validation
      if (definition.enum && !definition.enum.includes(value)) {
        errors.push(`Attribute ${key} must be one of: ${definition.enum.join(', ')}`);
      }

      // Numeric validation
      if (definition.type === 'number') {
        if (definition.minimum !== undefined && value < definition.minimum) {
          errors.push(`Attribute ${key} must be at least ${definition.minimum}`);
        }
        if (definition.maximum !== undefined && value > definition.maximum) {
          errors.push(`Attribute ${key} must be at most ${definition.maximum}`);
        }
      }
    });

    return errors;
  }

  /**
   * Validate block content
   */
  validateContent(block) {
    const errors = [];

    // Check for empty content in blocks that require it
    const contentRequiredBlocks = ['core/paragraph', 'core/heading', 'core/list', 'core/quote'];
    if (contentRequiredBlocks.includes(block.type) && !block.content?.trim()) {
      errors.push(`${block.type} block requires content`);
    }

    // Check for malformed HTML
    if (block.content && this.hasUnbalancedTags(block.content)) {
      errors.push('Content contains unbalanced HTML tags');
    }

    return errors;
  }

  /**
   * Validate inline formats
   */
  validateFormats(block) {
    const errors = [];
    const supportedFormats = this.blockFormatSupport.get(block.type) || [];

    // Check for unsupported formats
    const usedFormats = this.detectUsedFormats(block.content);
    const unsupportedFormats = usedFormats.filter(format => !supportedFormats.includes(format));

    if (unsupportedFormats.length > 0) {
      errors.push(`Block type ${block.type} doesn't support formats: ${unsupportedFormats.join(', ')}`);
    }

    return errors;
  }

  /**
   * Validate block context (relationships between blocks)
   */
  validateBlockContext(blocks) {
    const errors = [];

    // Example: Check for nested lists (not allowed in WordPress)
    let inList = false;
    blocks.forEach((block, index) => {
      if (block.type === 'core/list') {
        if (inList) {
          errors.push(`Nested lists are not supported (block ${index})`);
        }
        inList = true;
      } else {
        inList = false;
      }
    });

    return errors;
  }

  /**
   * Check for unbalanced HTML tags
   */
  hasUnbalancedTags(html) {
    const tagStack = [];
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
      const [fullMatch, tagName] = match;
      const isClosing = fullMatch.startsWith('</');
      const isSelfClosing = fullMatch.endsWith('/>') || ['br', 'hr', 'img', 'input'].includes(tagName.toLowerCase());

      if (isSelfClosing) continue;

      if (isClosing) {
        if (tagStack.length === 0 || tagStack[tagStack.length - 1] !== tagName) {
          return true;
        }
        tagStack.pop();
      } else {
        tagStack.push(tagName);
      }
    }

    return tagStack.length > 0;
  }

  /**
   * Detect which inline formats are used in content
   */
  detectUsedFormats(content) {
    const formats = [];
    
    if (/<strong>|<b>/.test(content)) formats.push('bold');
    if (/<em>|<i>/.test(content)) formats.push('italic');
    if (/<a\s/.test(content)) formats.push('link');
    if (/<code>/.test(content)) formats.push('code');
    if (/<s>|<del>/.test(content)) formats.push('strikethrough');
    if (/<sub>/.test(content)) formats.push('subscript');
    if (/<sup>/.test(content)) formats.push('superscript');

    return formats;
  }

  /**
   * Get valid attributes for a block type
   */
  getValidAttributesForType(blockType) {
    const schema = this.blockSchemas.get(blockType);
    if (!schema) return {};

    const validAttrs = {};
    Object.entries(schema.attributes).forEach(([key, definition]) => {
      validAttrs[key] = {
        type: definition.type,
        enum: definition.enum,
        required: definition.required,
      };
    });

    return validAttrs;
  }

  /**
   * Get example attributes for a block type
   */
  getExampleAttributes(blockType) {
    const examples = {
      'core/paragraph': { fontSize: 'large', align: 'center' },
      'core/heading': { level: 2, align: 'left' },
      'core/list': { ordered: true, reversed: false },
      'core/image': { alt: 'Description of image', align: 'center' },
      'core/quote': { citation: 'Author Name' },
    };

    return examples[blockType] || {};
  }

  /**
   * Get valid block types
   */
  getValidBlockTypes() {
    return Array.from(this.blockSchemas.keys());
  }

  /**
   * Get suggestions for fixing errors
   */
  getSuggestionsForErrors(errors) {
    const suggestions = [];

    errors.forEach(error => {
      if (error.includes('Missing required attribute')) {
        suggestions.push('Add the missing required attributes to the block');
      } else if (error.includes('Unknown block type')) {
        suggestions.push('Use one of the valid block types: ' + this.getValidBlockTypes().join(', '));
      } else if (error.includes('must be one of')) {
        suggestions.push('Check the valid values in the error message');
      } else if (error.includes('unbalanced HTML')) {
        suggestions.push('Ensure all HTML tags are properly closed');
      }
    });

    return suggestions.join('\n');
  }
}