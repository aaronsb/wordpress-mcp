# Semantic Hints Architecture

## Overview

The WordPress Author MCP Server implements a semantic hints system that guides AI agents through WordPress content management workflows. This system provides contextual information, suggestions, and workflow guidance to improve AI decision-making and reduce errors.

## Core Concepts

### 1. Semantic Context

Every operation response includes semantic context that helps AI understand:
- What type of content was affected (post vs page)
- What the content is used for
- Best practices for that content type

Example from `create-page.js`:
```javascript
semanticContext: {
  type: 'page',
  description: 'Static page for site structure',
  usage: 'Use pages for permanent content that forms your site structure, not for time-based blog content',
}
```

### 2. Suggested Actions

Operations return `suggestedActions` arrays that guide the AI to logical next steps:

```javascript
// From feature-mapper.js - createDraftArticle
suggestedActions: ['edit-draft', 'pull-for-editing', 'submit-for-review'],
```

### 3. Workflow Guidance

Rich workflow guidance provides step-by-step instructions:

```javascript
workflowGuidance: '📝 Your draft is saved. Next steps:\n- Use pull-for-editing to edit with blocks\n- Use submit-for-review when ready for publication'
```

### 4. Hints

Contextual hints appear throughout responses to guide behavior:

```javascript
hint: 'Draft created - use edit-draft to modify or submit-for-review when ready'
```

## Implementation Patterns

### 1. Content Type Awareness

The system maintains clear semantic distinction between posts and pages:

```javascript
// In pullForEditing response
semanticContext: {
  contentType: contentType,
  hint: contentType === 'page' 
    ? 'This is a PAGE - use it for permanent, timeless content that forms your site structure'
    : 'This is a POST - use it for time-based content like news, articles, or blog entries'
}
```

### 2. Action-Based Routing

The unified semantic tools use action parameters with built-in hints:

```javascript
// Block Editor Tool
action: {
  type: 'string',
  enum: [
    'list', 'read', 'edit', 'insert', 'delete', 'reorder', 'validate',
    // Semantic content actions with intuitive names
    'add-section', 'add-subsection', 'add-paragraph', 'add-list', 
    'add-quote', 'add-code', 'add-separator', 'continue-writing'
  ],
  description: 'Block editing action to perform'
}
```

### 3. Error Recovery Hints

When operations fail or have partial success, hints guide recovery:

```javascript
// From bulk operations
hint: errors.length > 0 
  ? 'Check errors array for details on failed conversions' 
  : 'All files converted successfully'
```

### 4. Progressive Disclosure

The system provides increasing detail based on context:

```javascript
// From findPostsForWorkflow
const workflowGuidance = this.getWorkflowGuidance(params.intent, formattedContent.length, totalItems);

// Returns context-specific guidance like:
"📝 Use 'pull-for-editing' with a post ID to start editing. After editing, use 'sync-to-wordpress' to save changes."
```

## Semantic Block Operations

### Smart Block Suggestions

When adding blocks, the system suggests logical next blocks:

```javascript
getSemanticBlockConfig(semanticType, existingBlocks, content) {
  switch (semanticType) {
    case 'section':
      return {
        type: 'core/heading',
        content: content || 'New Section',
        attributes: { level: hasHeadings ? 2 : 1 },
        hint: 'Section heading added - use add-paragraph to start content',
        suggestedNext: ['add-paragraph', 'add-subsection', 'add-list']
      };
  }
}
```

### Context-Aware Defaults

The system analyzes document structure to provide smart defaults:

```javascript
// Heading levels adjust based on existing structure
attributes: { level: hasHeadings ? 2 : 1 }, // H1 for first, H2 for subsequent
```

## Workflow Guidance Examples

### 1. Search Intent Guidance

Different search intents provide different guidance:

```javascript
const guidance = {
  edit: "📝 Use 'pull-for-editing' with a post ID to start editing...",
  review: "🔍 Found posts awaiting review. Use 'publish-workflow' to approve...",
  publish: "🚀 Ready to publish! Use 'publish-workflow' with the post ID...",
  comment: "💬 Use 'view-editorial-feedback' to see comments...",
}
```

### 2. No Results Help

When searches return no results, context-specific help is provided:

```javascript
const noResultsHelp = {
  edit: "No drafts found. Try searching without filters or create a new draft with 'draft-article'.",
  review: "No pending posts found. Posts must be submitted for review first.",
  publish: "No posts ready to publish. Check drafts or pending posts.",
}
```

### 3. Status-Based Suggestions

Content status drives suggested actions:

```javascript
switch (status) {
  case 'draft':
    actions.push('pull-for-editing', 'submit-for-review', 'publish-workflow');
    break;
  case 'pending':
    actions.push('review-content', 'publish-workflow', 'pull-for-editing');
    break;
}
```

## Adding Semantic Hints

### 1. In Feature Responses

Add semantic context to feature responses:

```javascript
return {
  success: true,
  // ... core response data ...
  
  // Add semantic context
  semanticContext: {
    contentType: 'post',
    hint: 'Describe what just happened and what to do next'
  },
  
  // Suggest logical next actions
  suggestedActions: ['action-1', 'action-2'],
  
  // Provide detailed workflow guidance
  workflowGuidance: 'Step-by-step instructions for the user'
};
```

### 2. In Error Responses

Even errors should include helpful hints:

```javascript
return {
  success: false,
  error: 'Permission denied',
  message: 'You can only trash your own posts',
  hint: 'To restore this post, an editor or administrator can help'
};
```

### 3. In Block Operations

Block operations include semantic type information:

```javascript
if (result.success) {
  result.semanticType = semanticType;
  result.semanticContext = {
    hint: blockConfig.hint,
    suggestedNext: blockConfig.suggestedNext
  };
}
```

## Best Practices

### 1. Be Specific

Instead of generic hints, provide specific, actionable guidance:

```javascript
// Bad
hint: 'Operation completed'

// Good
hint: 'Draft created - use pull-for-editing to edit with blocks or submit-for-review when ready'
```

### 2. Consider User Roles

Tailor hints based on user permissions:

```javascript
const suggestedActions = personality === 'administrator' 
  ? ['delete-content', 'change-owner', 'bulk-operations']
  : ['edit-draft', 'submit-for-review', 'trash-content'];
```

### 3. Use Consistent Patterns

Maintain consistent hint patterns across features:
- Past tense for completed actions: "Draft created"
- Present tense for current state: "This is a PAGE"
- Imperative for next steps: "Use pull-for-editing to..."

### 4. Progressive Detail

Start with essential information, provide more detail when needed:

```javascript
// Basic hint
hint: 'Page updated'

// With context
hint: 'Page updated - remember pages are for static, timeless content'

// With next steps
hint: 'Page updated - use list-blocks to see structure or add-section to continue'
```

## Integration with AI Agents

### 1. Tool Discovery

Semantic descriptions help AI discover the right tool:

```javascript
description: '[Content Management] Create, edit, and manage posts and pages'
```

### 2. Parameter Understanding

Action enums with semantic names guide AI choices:

```javascript
enum: ['add-section', 'add-paragraph', 'continue-writing']
// Instead of generic: ['insert', 'append', 'write']
```

### 3. Error Recovery

Hints in error responses help AI recover gracefully:

```javascript
catch (error) {
  return {
    success: false,
    error: error.message,
    hint: 'Check if the post exists and you have permission to edit it',
    suggestedActions: ['find-posts', 'check-permissions']
  };
}
```

## Future Enhancements

### 1. Learning System

Track which hints lead to successful AI task completion and adapt accordingly.

### 2. Contextual Tool Descriptions

Dynamic tool descriptions based on current session state:

```javascript
description: (context) => {
  if (context.hasActiveSession) {
    return `Edit blocks in ${context.session.contentType} #${context.session.contentId}`;
  }
  return 'Edit blocks (requires active editing session)';
}
```

### 3. Workflow Templates

Pre-defined workflow sequences with built-in guidance:

```javascript
workflows: {
  'publish-article': [
    { action: 'draft-article', hint: 'Create initial draft' },
    { action: 'pull-for-editing', hint: 'Open for block editing' },
    { action: 'add-sections', hint: 'Structure your content' },
    { action: 'submit-for-review', hint: 'Send to editors' },
    { action: 'publish-workflow', hint: 'Publish when approved' }
  ]
}
```

### 4. Validation Hints

Real-time hints during block validation:

```javascript
validationHints: {
  'core/heading': 'Heading levels should follow hierarchy (h1 → h2 → h3)',
  'core/image': 'Always include alt text for accessibility',
  'core/list': 'Use ordered lists for sequential steps, unordered for general points'
}
```

## Conclusion

The semantic hints system transforms the WordPress Author MCP from a simple API wrapper into an intelligent content management assistant. By providing contextual guidance, suggesting next actions, and explaining WordPress concepts, it helps AI agents make better decisions and complete tasks more efficiently.

The key to the system's success is its deep integration throughout the codebase - every operation considers what information would help an AI agent succeed and includes appropriate hints, suggestions, and guidance in its response.