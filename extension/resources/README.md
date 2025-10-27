# Resources

This directory contains static resources for the extension:

- `icons/` - Extension icons and UI assets
- `templates/` - Prompt templates and configuration templates
- `icon.svg` - SVG version of extension icon (for reference)

## Extension Icon

The extension icon should be placed here as `icon.png`:
- **Size**: 128x128 pixels (minimum), 256x256 or 512x512 recommended
- **Format**: PNG (SVG not supported by VS Code Marketplace)
- **Background**: Should work on both light and dark themes

To add an icon:
1. Create or obtain a 128x128 (or larger) PNG image
2. Save it as `resources/icon.png`
3. Update `package.json` to include: `"icon": "resources/icon.png"`

A placeholder SVG is provided (`icon.svg`) but must be converted to PNG for marketplace publishing.

## Icons

Place extension icons here for use in the VS Code UI.

## Templates

Place prompt templates and other text templates here.
