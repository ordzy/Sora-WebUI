# Sora WebUI

A modern, feature-rich web interface for streaming content with cross-device synchronization.

## Features

- 🎨 **Beautiful UI** - Modern, responsive design with multiple themes
- 🔐 **User Authentication** - Secure email/password authentication via Supabase
- ☁️ **Cloud Sync** - Automatic synchronization of settings, modules, and watch history across devices
- 📱 **Cross-Platform** - Works seamlessly on desktop, tablet, and mobile
- 🎭 **Module System** - Support for custom streaming modules
- 📺 **Watch History** - Track your viewing progress with continue watching functionality
- ⚙️ **Customizable** - Extensive settings for appearance, subtitles, and playback

## Setup

### Prerequisites

- Node.js 16+ and npm
- A Supabase account (for authentication and sync features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ordzy/Sora-WebUI.git
   cd Sora-WebUI
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Supabase (Optional - for auth & sync)**
   
   Create a `.env.local` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   Then run the SQL schema in your Supabase project (see `supabase-schema.sql`)

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

## Configuration

### Without Supabase

The app works perfectly without Supabase - authentication and sync features will be disabled, and data will be stored locally in your browser.

### With Supabase

When configured with Supabase credentials:
- User authentication with email/password
- Automatic data synchronization every 15 seconds
- Cross-device sync for settings, modules, and watch history
- Secure data storage with Row Level Security (RLS)

## Tech Stack

- **React** - UI framework
- **Vite** - Build tool and dev server
- **Supabase** - Authentication and database
- **Tailwind CSS** - Styling
- **HLS.js** - Video streaming support

## Project Structure

```
src/
├── components/        # React components
├── contexts/          # React contexts (Auth, etc.)
├── lib/              # Utilities and services
├── constants/        # App constants (themes, etc.)
└── index.css         # Global styles
```

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
