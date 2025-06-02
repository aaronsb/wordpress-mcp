# WordPress Author MCP Server

A personality-based Model Context Protocol (MCP) server for WordPress that provides role-appropriate tools for content management. This server enables AI assistants like Claude to create, edit, and manage WordPress content through natural language interactions.

## Purpose & Features

- **🎭 Personality-Based Tool Mapping**: Three modes (Contributor/Author/Administrator) with role-appropriate tools
- **🔧 Semantic Operations**: High-level WordPress actions without API complexity
- **🛡️ WordPress-Native Permissions**: Let WordPress handle all permission enforcement
- **📝 Content Management**: Create drafts, publish posts, schedule content, manage media
- **⚡ Map-Based Architecture**: JSON configuration for tool assignments, no hardcoded roles

## Quick Start

The fastest way to get started:

```bash
# Clone and install
git clone https://github.com/aaronsb/wordpress-mcp
cd wordpress-mcp
npm install

# Run interactive setup
npm run setup
```

The setup wizard will:
1. Ask for your WordPress site URL and credentials
2. Help you choose a default personality (Contributor/Author/Administrator)
3. Create your `.env` configuration file
4. Generate ready-to-paste configurations for Claude Desktop and Claude Code

Just copy the generated configuration to your Claude settings and you're ready to go!

## How It Works

1. **Features** are defined as standalone modules in `src/features/`
2. **Personalities** map to specific sets of features in `config/personalities.json`
3. **At launch**, specify a personality to expose only its mapped tools
4. **WordPress** handles all actual permission enforcement

## Installation

```bash
git clone https://github.com/aaronsb/wordpress-mcp
cd wordpress-mcp
npm install
```

## Configuration

### 1. WordPress Setup

Create a `.env` file with your WordPress credentials:

```env
WORDPRESS_URL=https://your-site.com
WORDPRESS_USERNAME=your-username
WORDPRESS_APP_PASSWORD=your-app-password
```

**Note**: Use Application Passwords for better security. Generate one at:
`Users > Your Profile > Application Passwords` in your WordPress admin.

### 2. Claude Desktop Setup

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "wordpress-author": {
      "command": "node",
      "args": [
        "/path/to/wordpress-mcp/src/server.js",
        "--personality=author"
      ],
      "env": {
        "WORDPRESS_URL": "https://your-site.com",
        "WORDPRESS_USERNAME": "your-username",
        "WORDPRESS_APP_PASSWORD": "your-app-password"
      }
    }
  }
}
```

### 3. Claude Code Setup

#### Option A: Using the CLI (Recommended)

In your project directory, run:

```bash
claude mcp add wordpress-author \
  node /path/to/wordpress-mcp/src/server.js \
  --personality=author \
  -e WORDPRESS_URL=https://your-site.com \
  -e WORDPRESS_USERNAME=your-username \
  -e "WORDPRESS_APP_PASSWORD=your-app-password"
```

This will automatically add the configuration to your project.

#### Option B: Manual Configuration

Alternatively, add to your project's `.claude/settings.json`:

```json
{
  "mcpServers": {
    "wordpress-author": {
      "command": "node",
      "args": [
        "/path/to/wordpress-mcp/src/server.js",
        "--personality=author"
      ],
      "env": {
        "WORDPRESS_URL": "https://your-site.com",
        "WORDPRESS_USERNAME": "your-username",
        "WORDPRESS_APP_PASSWORD": "your-app-password"
      }
    }
  }
}
```

**Note**: Adjust the personality parameter (`--personality=`) to one of:
- `contributor` - Limited tools for content creation
- `author` - Full authoring capabilities (recommended)
- `administrator` - Complete site management

## Usage

Once configured, the WordPress tools will be available in Claude. You can:

- Create and edit draft posts
- Publish articles with scheduling options
- Manage media files
- Perform bulk operations (admin only)
- Search and filter all content (admin only)

Example prompts:
- "Create a draft blog post about AI development"
- "Publish my draft with ID 30"
- "Schedule a post for next Monday at 9 AM"
- "Show me all draft posts"

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
    "features": ["manage-all-content", "edit-draft", "publish-workflow", "bulk-content-operations"],
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

## Customization

See [CUSTOMIZATION.md](CUSTOMIZATION.md) for detailed instructions on:
- Creating custom personalities
- Adding new features
- Configuring role-based tool mappings
- Real-world examples (Editor, Reviewer, Social Media Manager)

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
