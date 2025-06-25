# WordPress Page Creation Examples

This guide demonstrates how to use the WordPress Author MCP server to create and manage pages.

## Understanding Pages vs Posts

**Pages** are for static, timeless content that forms your site structure:
- About Us, Contact, Services
- Hierarchical (parent-child relationships)
- Don't appear in RSS feeds
- Have menu ordering

**Posts** are for time-based content:
- Blog entries, news, articles
- Organized by categories and tags
- Appear in RSS feeds
- Have publish dates that matter

## Basic Page Creation

### Create a Draft Page

```javascript
// Create a simple draft page
mcp.draft-page({
  title: "About Our Company",
  content: "We are a leading provider of innovative solutions..."
})

// Response includes semantic context
{
  success: true,
  pageId: 123,
  status: "draft",
  semanticContext: {
    type: "page",
    hint: "This is a page, not a post. Pages are for timeless content..."
  }
}
```

### Publish a Page Immediately

```javascript
// Create and publish a page
mcp.create-page({
  title: "Contact Us",
  content: "# Get in Touch\n\nWe'd love to hear from you...",
  status: "publish"
})
```

## Hierarchical Page Structure

### Create Child Pages

```javascript
// First, create a parent page
const services = await mcp.create-page({
  title: "Our Services",
  content: "Explore our comprehensive service offerings.",
  status: "publish",
  menu_order: 2
})

// Then create child pages
await mcp.create-page({
  title: "Web Development",
  content: "Custom web solutions tailored to your needs.",
  parent: services.pageId,  // Makes this a child of Services
  status: "publish",
  menu_order: 1
})

await mcp.create-page({
  title: "Mobile Apps",
  content: "Native and cross-platform mobile applications.",
  parent: services.pageId,
  status: "publish", 
  menu_order: 2
})
```

This creates a structure like:
- Our Services (`/services/`)
  - Web Development (`/services/web-development/`)
  - Mobile Apps (`/services/mobile-apps/`)

## Page Templates

WordPress themes often provide custom page templates:

```javascript
mcp.create-page({
  title: "Full Width Layout",
  content: "This page uses a full-width template without sidebar.",
  template: "full-width.php",  // Template file from theme
  status: "publish"
})
```

Common templates:
- `default` - Standard page template
- `full-width.php` - No sidebar
- `landing-page.php` - Marketing landing page
- `contact.php` - Contact form page

## Editing Pages

### Pull a Page for Editing

```javascript
// Pull page into editing session
const session = await mcp.pull-for-editing({
  postId: 123,
  type: "page"  // Important: specify type as "page"
})

// Returns document handle for editing
{
  documentHandle: "wp-session-abc123",
  title: "About Our Company",
  semanticContext: {
    contentType: "page",
    hint: "This is a PAGE - use it for permanent, timeless content"
  }
}
```

### Edit Page Content

```javascript
// Read the page
await mcp.read-document({
  documentHandle: "wp-session-abc123"
})

// Make edits using various methods
await mcp.edit-document-line({
  documentHandle: "wp-session-abc123",
  lineNumber: 5,
  newLine: "## Our Updated Mission"
})

// Add new content
await mcp.insert-at-line({
  documentHandle: "wp-session-abc123",
  lineNumber: 10,
  content: "### New Section\nAdditional content here..."
})
```

### Save Changes

```javascript
// Sync changes back to WordPress
await mcp.sync-to-wordpress({
  documentHandle: "wp-session-abc123"
})

// Page is updated with semantic awareness
{
  success: true,
  pageId: 123,
  message: "Page synced to WordPress successfully",
  semanticContext: {
    contentType: "page",
    hint: "Page updated - remember pages are for static, timeless content"
  }
}
```

## Menu Ordering

Control page order in navigation menus:

```javascript
// Create pages with specific menu order
await mcp.create-page({
  title: "Home",
  content: "Welcome to our website",
  menu_order: 0,  // First in menu
  status: "publish"
})

await mcp.create-page({
  title: "About",
  content: "Learn about our company",
  menu_order: 10,  // After Home
  status: "publish"
})

await mcp.create-page({
  title: "Contact",
  content: "Get in touch",
  menu_order: 99,  // Last in menu
  status: "publish"
})
```

## Common Page Patterns

### Company Website Structure

```javascript
// Main pages
const about = await mcp.create-page({
  title: "About Us",
  menu_order: 1
})

const services = await mcp.create-page({
  title: "Services", 
  menu_order: 2
})

const contact = await mcp.create-page({
  title: "Contact",
  menu_order: 5
})

// Sub-pages under About
await mcp.create-page({
  title: "Our Team",
  parent: about.pageId
})

await mcp.create-page({
  title: "Company History",
  parent: about.pageId
})

// Service pages
await mcp.create-page({
  title: "Consulting",
  parent: services.pageId
})
```

### Landing Page

```javascript
mcp.create-page({
  title: "Special Offer",
  content: `
# Limited Time Offer

## 50% Off All Services

[Call to action content...]
  `,
  template: "landing-page.php",
  status: "publish"
})
```

## Best Practices

1. **Use Pages for Permanent Content**: About, Contact, Services, Privacy Policy
2. **Use Posts for Time-Based Content**: News, Blog, Announcements
3. **Plan Hierarchy**: Think about parent-child relationships
4. **Set Menu Order**: Control navigation appearance
5. **Choose Templates**: Use theme templates for different layouts
6. **Semantic Context**: The MCP server provides hints about content type

## Troubleshooting

### Page Not Appearing in Menu
- Check `menu_order` is set
- Verify page is published
- Theme may require manual menu configuration

### URL Structure Issues
- Parent pages must exist before creating children
- WordPress generates URLs based on hierarchy
- Check permalink settings in WordPress

### Template Not Working
- Verify template file exists in theme
- Some templates require specific theme support
- Default to `default` if unsure