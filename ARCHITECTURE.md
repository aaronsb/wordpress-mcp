# WordPress Author MCP Server Architecture

## Overview

The WordPress Author MCP Server is designed with a personality-based architecture that provides semantic operations for WordPress content management. Unlike traditional API wrappers, this server embeds WordPress knowledge and workflows directly into features.

## Conceptual Model: ECU Mapping

Like automotive Engine Control Unit (ECU) mappings, this MCP server uses different "personality maps" optimized for specific use cases:

- **Contributor Mode** (Economy): Minimal tool set, safe operations only, optimized for content creation
- **Author Mode** (Comfort): Balanced capabilities for daily content work, publishing and media management
- **Administrator Mode** (Performance): Full power access, all tools available for complete site control

Just as ECU maps adjust fuel injection, timing, and boost pressure without changing the engine itself, our personality maps adjust tool availability without changing the core server implementation.

## Core Design Principles

1. **Semantic Operations Over API Wrappers**: Features represent high-level intentions, not low-level API calls
2. **Personality-Based Tool Filtering**: Reduce AI cognitive load by exposing only relevant tools
3. **Context-Aware Execution**: Features adapt based on runtime context and user capabilities
4. **Modular Feature System**: Easy to extend with new capabilities
5. **WordPress Knowledge Embedded**: Business logic lives in features, not in AI prompts
6. **Content Type Awareness**: Clear semantic distinction between posts (time-based) and pages (static)

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client (AI Agent)                    │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      MCP Protocol Layer                      │
│                    (Request/Response Handler)                │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Personality Manager                       │
│              (Role-based Feature Filtering)                  │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Feature Registry                         │
│              (Semantic Feature Definitions)                  │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   WordPress Client                           │
│          (REST API Abstraction + Permission Handling)        │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### 1. MCP Server (server.js)

- Handles MCP protocol communication
- Routes requests to appropriate handlers
- Manages server lifecycle
- Provides error handling

### 2. Personality Manager

- Loads personality configurations
- Filters features based on selected personality
- Validates personality definitions
- Provides contextual feature access

### 3. Feature Registry

- Loads and manages semantic features
- Provides feature discovery
- Handles feature lifecycle
- Validates feature schemas

### 4. WordPress Client

- Abstracts WordPress REST API
- Handles authentication
- Manages API responses
- Provides error recovery

## Feature Architecture

Each feature is a self-contained module with:

```javascript
{
  name: 'feature-name',
  description: 'Human and AI readable description',

  // Which personalities can see this tool
  personalities: ['author', 'administrator'],

  // Input validation schema
  inputSchema: {
    // JSON Schema definition
  },

  // Execution logic with embedded workflows
  async execute(params, context) {
    // Semantic operation implementation
    // WordPress handles all permission checking
  }
}
```

## Personality System

### Configuration Structure

```json
{
  "personality-name": {
    "name": "Display Name",
    "description": "Purpose and capabilities",
    "features": ["feature-1", "feature-2"],
    "context": {
      "default_post_status": "draft",
      "can_publish": false,
      "scope_rules": ["own_content_only"]
    }
  }
}
```

### Personality Hierarchy

1. **Contributor**: Basic content creation, no publishing
2. **Author**: Own content management and publishing
3. **Administrator**: Full site and content management

## Scope Rule System

### Rule Categories

1. **Content Scope**

   - `own_content_only`: Can only modify own posts
   - `all_content`: Can modify any content
   - `team_content`: Can modify team members' content

2. **Action Scope**

   - `create_draft`: Can create draft posts
   - `publish_content`: Can publish posts
   - `delete_content`: Can delete posts
   - `modify_settings`: Can change site settings

3. **Resource Scope**
   - `upload_media`: Can upload files
   - `manage_users`: Can modify users
   - `install_plugins`: Can add plugins

### Rule Enforcement

```javascript
// Before execution
const permitted = await scopeRuleEngine.check(feature.scopeRules, context.user, params);

if (!permitted.allowed) {
  return gracefulError(permitted.reason);
}
```

## Extension Points

### 1. Adding New Features

Create a new file in `src/features/category/feature-name.js`:

```javascript
export default {
  name: 'my-feature',
  description: 'What this feature does',
  eligibility: {
    /* ... */
  },
  scopeRules: [
    /* ... */
  ],
  async execute(params, context) {
    // Implementation
  },
};
```

### 2. Adding New Personalities

Edit `config/personalities.json`:

```json
{
  "custom-role": {
    "name": "Custom Role",
    "features": ["feature-1", "feature-2"],
    "context": {
      /* ... */
    }
  }
}
```

### 3. Adding Scope Rules

Extend `src/core/scope-rules/`:

```javascript
export class CustomScopeRule extends BaseScopeRule {
  async evaluate(context, params) {
    // Custom logic
  }
}
```

## Security Considerations

1. **Least Privilege Default**: Contributor personality is default
2. **WordPress Authority**: API permissions are ultimate authority
3. **Graceful Degradation**: Features handle permission denials
4. **No Credential Storage**: Uses environment variables
5. **Audit Logging**: Optional action logging

## Performance Optimizations

1. **Lazy Feature Loading**: Features loaded on demand
2. **Connection Pooling**: Reuse WordPress API connections
3. **Response Caching**: Optional caching layer
4. **Minimal Tool Surface**: Only expose needed tools

## Content Type Handling

### Posts vs Pages

The architecture maintains clear semantic distinction between content types:

**Posts** (Time-based content):
- Blog entries, news, articles
- Support categories and tags
- Appear in RSS feeds
- Have publish dates that matter
- Can be scheduled

**Pages** (Static content):
- About, Services, Contact pages
- Support hierarchical structure (parent-child)
- Have menu ordering
- Support custom templates
- Form site structure

### Unified Editing Workflow

Both posts and pages use the same document session workflow:

```javascript
// Pull for editing with type parameter
pull-for-editing { postId: 10, type: 'page' }
// Returns consistent document handle

// Edit operations work identically
edit-document-line { documentHandle, lineNumber, newLine }

// Sync preserves content type context
sync-to-wordpress { documentHandle }
// Automatically updates correct endpoint
```

### Content Type Awareness

Features include semantic context to guide AI behavior:

```javascript
{
  semanticContext: {
    contentType: 'page',
    hint: 'This is a PAGE - use it for permanent, timeless content'
  }
}
```

## Error Handling Strategy

1. **Semantic Errors**: Return user-friendly explanations
2. **Permission Errors**: Suggest alternative approaches
3. **API Errors**: Retry with backoff
4. **Validation Errors**: Clear parameter guidance

## Future Extensibility

1. **Plugin System**: Third-party feature packages
2. **Workflow Templates**: Reusable operation sequences
3. **Learning System**: Adapt to usage patterns
4. **Multi-Site Support**: Manage multiple WordPress instances
5. **Webhook Integration**: Real-time WordPress events
