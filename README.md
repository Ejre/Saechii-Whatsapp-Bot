# Saechii-Whatsapp-Bot

Saechii-Whatsapp-Bot is a feature-rich WhatsApp bot built using [Baileys](https://github.com/WhiskeySockets/Baileys). It includes various utilities such as AI chat (with a custom persona), media downloaders (Instagram, YouTube), sticker creation, and group management tools.

## 🚀 Features

*   **AI Chat**: Talk to an AI with a "Tsundere" anime girl persona using `!ai` or enable continuous mode with `!autoai`.
*   **Media Downloader**:
    *   Instagram Downloader (`.dl`)
    *   YouTube Video Downloader (`.yt`)
*   **Sticker Maker**: Convert images or short videos/GIFs into WhatsApp stickers (`.s`).
*   **View Once Revealer**: Automatically saves "View Once" media and allows you to retrieve them (`.rvo`).
*   **Group Tools**: Tag all members in a group (`.tagall`, `.p`, `.h`).
*   **Utility**: Ping check (`.ping`).

## 📋 Requirements

*   [Node.js](https://nodejs.org/) (v16 or higher recommended)
*   [FFmpeg](https://ffmpeg.org/) (Required for sticker creation)

## 🛠️ Installation

1.  **Clone the repository** (or download the source code):
    ```bash
    git clone https://github.com/yourusername/Saechii-Whatsapp-Bot.git
    cd Saechii-Whatsapp-Bot
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure the Bot**:
    *   Open `index.js` and ensure your API Key is set (currently configured inline).
    *   *(Optional)* Setup a `.env` file if you plan to use the Express server or want to secure your credentials.

4.  **Start the Bot**:
    ```bash
    npm start
    ```
    *   Scan the QR code that appears in your terminal using WhatsApp (Linked Devices).

## 📖 Usage / Commands

| Command | Description | Example |
| :--- | :--- | :--- |
| `.menu` | Show the list of available commands | `.menu` |
| `.ping` | Check if the bot is active and responsive | `.ping` |
| `!ai <text>` | Ask the AI something | `!ai Halo!` |
| `!autoai enable/disable` | Enable/Disable continuous AI chat mode | `!autoai enable` |
| `.s` | Reply to an image/video to make a sticker | Reply with `.s` |
| `.dl <link>` | Download Instagram Reels/Images | `.dl https://instagram.com/...` |
| `.yt <link>` | Download YouTube Videos | `.yt https://youtu.be/...` |
| `.rvo` | Reply to a View Once message to see it again | Reply with `.rvo` |
| `.tagall` / `.p` | Mention all members in a group | `.tagall` |
| `.h <text>` | Hidden tag (mention all without showing list) | `.h Info penting!` |
| `.del` | Delete a message (Reply to the message) | Reply with `.del` |

## 📂 Project Structure

*   `index.js`: Main bot logic and command handlers.
*   `server.js`: Simple Express API server (optional).
*   `auth_info/`: Session data for WhatsApp authentication (generated after login).
*   `rvo_media/`: Folder where "View Once" media is saved automatically.

## ⚠️ Notes

*   **FFmpeg**: Ensure FFmpeg is installed and added to your system's PATH variable for the sticker feature to work.
*   **API Limits**: The bot uses the Botcahx API for AI and Downloaders. Ensure you have a valid API Key if the default one limits usage.

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or pull requests to improve the bot.

## 📝 License

This project is licensed under the ISC License.
