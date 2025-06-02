# WordPress Author MCP Server

A personality-based Model Context Protocol (MCP) server for WordPress that provides role-appropriate tools for content management.

## Key Design Principle: Map-Based Architecture

This MCP server uses a **map-based approach** rather than hardcoded role logic. The personality-to-tool mappings are entirely defined in JSON configuration, making the system flexible and easy to customize without modifying code.

## How It Works

1. **Features** are defined as standalone modules in `src/features/`
2. **Personalities** map to specific sets of features in `config/personalities.json`
3. **At launch**, specify a personality to expose only its mapped tools
4. **WordPress** handles all actual permission enforcement

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file with your WordPress credentials:

```env
WORDPRESS_URL=https://your-site.com
WORDPRESS_USERNAME=your-username
WORDPRESS_APP_PASSWORD=your-app-password
```

## Usage

Launch the MCP server with a specific personality:

```bash
# Contributor personality - limited tools for content creation
npx wordpress-author-mcp --personality=contributor

# Author personality - full authoring capabilities
npx wordpress-author-mcp --personality=author

# Administrator personality - complete site management
npx wordpress-author-mcp --personality=administrator
```

## Personality Mappings

The tool mappings are defined in `config/personalities.json`:

### Contributor
- `draft-article` - Create draft posts
- `edit-draft` - Edit existing drafts
- `submit-for-review` - Submit drafts for editorial review
- `view-editorial-feedback` - See editor comments
- `suggest-metadata` - Propose categories and tags

### Author
- All contributor tools, plus:
- `create-article` - Create and publish posts
- `publish-workflow` - Publish or schedule posts
- `manage-media` - Upload and manage media files
- `schedule-content` - Schedule future posts
- `manage-own-content` - Manage your own posts

### Administrator
- All author tools, plus:
- `bulk-content-operations` - Bulk actions on posts
- `manage-all-content` - View and manage all posts
- `site-configuration` - Manage site settings
- `user-management` - Manage users
- `plugin-management` - Manage plugins

## Adding Custom Personalities

Edit `config/personalities.json` to create custom role mappings:

```json
{
  "editor": {
    "name": "Editor",
    "description": "Editorial team member",
    "features": [
      "manage-all-content",
      "edit-draft",
      "publish-workflow",
      "bulk-content-operations"
    ],
    "context": {
      "can_publish": true,
      "can_edit_others": true
    }
  }
}
```

Then launch with:
```bash
npx wordpress-author-mcp --personality=editor
```

## Creating New Features

Add a new feature by creating a file in `src/features/category/feature-name.js`:

```javascript
export default {
  name: 'feature-name',
  description: 'What this feature does',
  
  inputSchema: {
    // JSON Schema for parameters
  },
  
  async execute(params, context) {
    const { wpClient } = context;
    // Implementation using wpClient
    return result;
  }
};
```

Then add it to any personality in `config/personalities.json`.

## Architecture Benefits

1. **No hardcoded roles** - All personality logic lives in configuration
2. **Easy customization** - Modify JSON to change tool availability
3. **WordPress authority** - The API enforces actual permissions
4. **Clean separation** - Features don't know about personalities
5. **Extensible** - Add features and map them without touching core code

## WordPress Permission Handling

The MCP server presents tools based on personality, but **WordPress always has final authority**:

- If a contributor tries to publish (via API manipulation), WordPress returns 403
- If an author tries to edit others' posts, WordPress denies it
- The MCP server gracefully handles these errors with helpful messages

## Development

```bash
# Run in development mode with auto-reload
npm run dev
```

## License

MIT