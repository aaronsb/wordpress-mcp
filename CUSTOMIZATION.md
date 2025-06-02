# Customizing WordPress MCP Personality Mappings

This guide explains how to customize the personality-to-tool mappings for your WordPress MCP server.

## Understanding the Personality System

The WordPress MCP server uses a "personality" system that provides different tool sets based on typical WordPress roles:

- **Contributor**: Minimal tools for safe content creation
- **Author**: Balanced capabilities for content creation and publishing
- **Administrator**: Full access to all content management tools

## Configuration File Structure

The personality mappings are defined in `config/personalities.json`:

```json
{
  "personality-name": {
    "name": "Display Name",
    "description": "What this personality does",
    "features": ["list", "of", "available", "tools"],
    "context": {
      "can_publish": false,
      "can_upload_media": false,
      "default_post_status": "draft"
    }
  }
}
```

## Available Features

These are the built-in features you can assign to personalities:

### Content Features
- `draft-article` - Create draft posts
- `edit-draft` - Edit existing drafts
- `submit-for-review` - Submit drafts for editorial review
- `view-editorial-feedback` - View comments on posts
- `create-article` - Create posts with publishing options
- `publish-workflow` - Publish or schedule posts

### Media Features
- `manage-media` - List and manage media library

### Management Features
- `bulk-content-operations` - Perform bulk actions on posts
- `manage-all-content` - View and filter all posts

## Creating Custom Personalities

### Example 1: Editor Role

An editor who can manage all content but shouldn't change site settings:

```json
{
  "editor": {
    "name": "Editor",
    "description": "Editorial team member - can edit and publish any content",
    "features": [
      "draft-article",
      "edit-draft",
      "create-article",
      "publish-workflow",
      "manage-media",
      "manage-all-content",
      "bulk-content-operations",
      "view-editorial-feedback"
    ],
    "context": {
      "can_publish": true,
      "can_upload_media": true,
      "can_edit_others": true,
      "default_post_status": "draft"
    }
  }
}
```

### Example 2: Content Reviewer

Someone who can only review and provide feedback:

```json
{
  "reviewer": {
    "name": "Content Reviewer",
    "description": "Can view all content and provide feedback",
    "features": [
      "manage-all-content",
      "view-editorial-feedback"
    ],
    "context": {
      "can_publish": false,
      "can_upload_media": false,
      "can_edit_others": false,
      "default_post_status": "draft"
    }
  }
}
```

### Example 3: Social Media Manager

Creates and schedules content but with limited administrative access:

```json
{
  "social-media": {
    "name": "Social Media Manager",
    "description": "Creates and schedules social media content",
    "features": [
      "draft-article",
      "edit-draft",
      "create-article",
      "publish-workflow",
      "manage-media",
      "manage-own-content"
    ],
    "context": {
      "can_publish": true,
      "can_upload_media": true,
      "can_edit_others": false,
      "default_post_status": "publish",
      "publish_capability": "own_only"
    }
  }
}
```

## Using Custom Personalities

After adding a custom personality to `config/personalities.json`:

1. **Launch with your custom personality:**
   ```bash
   node src/server.js --personality=editor
   ```

2. **Update your Claude configuration:**
   ```json
   {
     "mcpServers": {
       "wordpress-author": {
         "command": "node",
         "args": [
           "/path/to/wordpress-mcp/src/server.js",
           "--personality=editor"
         ]
       }
     }
   }
   ```

## Best Practices

1. **Start Minimal**: Begin with fewer tools and add more as needed
2. **Match WordPress Roles**: Align personalities with your WordPress user roles
3. **Test Permissions**: Remember that WordPress enforces actual permissions
4. **Document Custom Roles**: Add descriptions to help users understand each personality

## Context Properties

The `context` object provides hints about the personality's capabilities:

- `can_publish`: Whether this role typically can publish posts
- `can_upload_media`: Whether this role can upload files
- `can_edit_others`: Whether this role can edit other users' content
- `can_manage_site`: Whether this role has site management capabilities
- `workflow_stage`: The typical workflow stage (creation/publication/management)
- `default_post_status`: Default status for new posts
- `publish_capability`: Scope of publishing ability (own_only/all_content)

Note: These are hints for the UI/UX. WordPress API permissions are always authoritative.

## Adding New Features

To add custom features beyond the built-in ones:

1. Create a new feature file in `src/features/category/feature-name.js`
2. Add the feature name to your personality's features array
3. See the existing features for implementation examples

## Troubleshooting

- **Tools not appearing**: Check that feature names match exactly
- **Permission errors**: WordPress user permissions override personality settings
- **Custom personality not loading**: Verify JSON syntax in personalities.json

Remember: The personality system controls which tools are *presented* to the AI. WordPress always has final authority on what operations are *permitted*.