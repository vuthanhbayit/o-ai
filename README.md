# O-AI

A modern desktop application built with Electron, Vue 3, and TypeScript.

## Features

- Modern UI with Vue 3 and Tailwind CSS
- Terminal integration with xterm.js
- Cross-platform support (macOS, Windows, Linux)
- Auto-update support
- TypeScript for type safety

## Tech Stack

- **Electron** - Desktop application framework
- **Vue 3** - Progressive JavaScript framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Next generation build tool
- **Tailwind CSS** - Utility-first CSS framework
- **xterm.js** - Terminal emulator
- **Pinia** - Vue state management
- **electron-updater** - Auto-update functionality

## Development

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Install Dependencies

```bash
pnpm install
```

### Development Mode

```bash
pnpm dev
```

### Build

```bash
# For macOS
pnpm build:mac

# For Windows
pnpm build:win

# For Linux
pnpm build:linux
```

## Publishing Updates

Build and publish to GitHub Releases with auto-update:

```bash
# Set GitHub token
export GH_TOKEN="your_github_token"

# Build and publish
pnpm publish:mac
```

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/)
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## License

MIT

## Author

vuthanhbayit@gmail.com
