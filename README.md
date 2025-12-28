# 🛡️ Safeguard

A Discord moderation bot with a web dashboard, built with modern TypeScript tooling.

## 📦 Project Structure

```
safeguard/
├── apps/
│   ├── bot/          # Discord bot (Bun + discord.js)
│   └── dashboard/    # Web dashboard (Next.js 16 + React 19)
├── packages/
│   └── database/     # Shared Prisma database layer
└── ...
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/) (v10+)
- [Bun](https://bun.sh/) (for the bot)
- PostgreSQL database (or [Supabase](https://supabase.com/))

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/safeguard.git
cd safeguard

# Install dependencies
pnpm install

# Set up environment variables
cp apps/bot/.env.example apps/bot/.env
# Edit .env files with your credentials
```

### Database Setup

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Open Prisma Studio (optional)
pnpm db:studio
```

### Development

```bash
# Run bot only
pnpm dev:bot

# Run dashboard only
pnpm dev:web

# Run both in parallel
pnpm dev
```

## 🛠️ Scripts

| Script              | Description                      |
| ------------------- | -------------------------------- |
| `pnpm dev`          | Run all apps in development mode |
| `pnpm dev:bot`      | Run the Discord bot              |
| `pnpm dev:web`      | Run the web dashboard            |
| `pnpm lint`         | Run ESLint on all files          |
| `pnpm lint:fix`     | Fix auto-fixable lint issues     |
| `pnpm format`       | Format all files with Prettier   |
| `pnpm format:check` | Check formatting without writing |
| `pnpm db:generate`  | Generate Prisma client           |
| `pnpm db:push`      | Push schema changes to database  |
| `pnpm db:studio`    | Open Prisma Studio               |

## 🧰 Tech Stack

### Bot

- **Runtime**: [Bun](https://bun.sh/)
- **Framework**: [discord.js](https://discord.js.org/) v14
- **Database**: PostgreSQL via Prisma

### Dashboard

- **Framework**: [Next.js](https://nextjs.org/) 16
- **UI**: [React](https://react.dev/) 19
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) v4
- **Auth**: [Supabase](https://supabase.com/)

### Shared

- **Database ORM**: [Prisma](https://www.prisma.io/) v7
- **Package Manager**: [pnpm](https://pnpm.io/) workspaces
- **Linting**: ESLint + Prettier
- **Git Hooks**: Husky + lint-staged

## 📁 Environment Variables

### Bot (`apps/bot/.env`)

```env
BOT_TOKEN=your_discord_bot_token
PUBLIC_KEY=your_public_key
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
```

### Database (`packages/database/.env`)

```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.
