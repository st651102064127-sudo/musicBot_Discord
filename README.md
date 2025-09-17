# 🎵 Discord Music Bot

Discord Bot สำหรับเล่นเพลงจาก YouTube พร้อม GUI ที่ใช้งานง่าย

## ✨ Features

- 🎵 เล่นเพลงจาก YouTube
- 📝 เลือกเพลงจากรายการ 5 อันดับ
- 🎛️ GUI ควบคุมการเล่น (หยุด/เล่น/เลื่อน/เคลียร์)
- 📋 ระบบคิวเพลง
- 🔊 ทดสอบเสียง
- 💎 ใช้เทคโนโลยีใหม่ล่าสุด (Discord.js v14)

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/YOUR_USERNAME/discord-music-bot.git
cd discord-music-bot
```

### 2. ติดตั้ง Dependencies
```bash
npm install
```

### 3. ตั้งค่า Environment
```bash
# สร้างไฟล์ .env
echo "DISCORD_TOKEN=your_bot_token_here" > .env
```

### 4. รัน Bot
```bash
npm start
```

## ⚙️ การตั้งค่า Discord Bot

### สร้าง Bot Application
1. ไป [Discord Developer Portal](https://discord.com/developers/applications)
2. คลิก "New Application" และตั้งชื่อ Bot
3. ไปแท็บ "Bot" และคลิก "Add Bot"
4. Copy Token ของ Bot
5. เปิดใช้งาน **MESSAGE CONTENT INTENT** ✅

### เชิญ Bot เข้า Server
1. ไปแท็บ "OAuth2" > "URL Generator"
2. เลือก Scopes: `bot` ✅
3. เลือก Bot Permissions:
   - Send Messages ✅
   - Connect ✅
   - Speak ✅
   - Use Voice Activity ✅
4. Copy URL และเชิญ Bot เข้าเซิร์ฟเวอร์

## 🎮 วิธีใช้งาน

| คำสั่ง | คำอธิบาย |
|--------|----------|
| `!play <ชื่อเพลง>` | ค้นหาและเลือกเพลงจาก YouTube |
| `!gui` | แสดงหน้าต่างควบคุมเพลง |
| `!test` | ทดสอบการเชื่อมต่อเสียง |

### GUI Controls
- ⏯️ **หยุด/เล่น** - หยุดหรือเล่นเพลงต่อ
- ⏭️ **เลื่อนเพลง** - เลื่อนไปเพลงถัดไป
- ⏹️ **หยุดเพลง** - หยุดและเคลียร์คิว
- 🗑️ **เคลียร์คิว** - ลบเพลงทั้งหมดในคิว
- 📜 **แสดงคิว** - แสดงรายการเพลงในคิว
- 👋 **ออกจากช่อง** - Bot ออกจาก Voice Channel

## 📋 ความต้องการของระบบ

- **Node.js** 16.0.0 ขึ้นไป
- **FFmpeg** 
- **Python** 3.x (สำหรับ node-gyp)

### Windows
```bash
# ด้วย Chocolatey (เปิด CMD as Administrator)
choco install nodejs ffmpeg python
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install nodejs npm ffmpeg python3
```

### macOS
```bash
# ด้วย Homebrew
brew install node ffmpeg python
```

## 🛠️ Dependencies

```json
{
  "discord.js": "^14.14.1",
  "@discordjs/voice": "^0.16.1",
  "@discordjs/opus": "^0.9.0",
  "opusscript": "^0.0.8",
  "@distube/ytdl-core": "^4.13.5",
  "yt-search": "^2.10.4",
  "ffmpeg-static": "^5.2.0",
  "sodium": "^3.0.2",
  "dotenv": "^16.3.1"
}
```

## 🔧 การแก้ไขปัญหา

### Bot ไม่เล่นเสียง
1. ตรวจสอบสิทธิ์ Bot ใน Voice Channel
2. ทดสอบด้วยคำสั่ง `!test`
3. ตรวจสอบว่าติดตั้ง FFmpeg แล้ว

### ytdl-core Error
```bash
npm install @distube/ytdl-core@latest
```

### Opus Error
```bash
npm install opusscript @discordjs/opus
```

## 📁 โครงสร้างโปรเจค

```
discord-music-bot/
├── bot.js              # โค้ดหลัก
├── package.json        # Dependencies
├── .env               # Environment variables
├── .gitignore         # Git ignore
└── README.md          # คู่มือการใช้งาน
```

## 🤝 Contributing

1. Fork โปรเจค
2. สร้าง Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit การเปลี่ยนแปลง (`git commit -m 'Add some AmazingFeature'`)
4. Push ไปยัง Branch (`git push origin feature/AmazingFeature`)
5. เปิด Pull Request

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

## ⚠️ Disclaimer

- Bot นี้สร้างขึ้นเพื่อการศึกษาและใช้งานส่วนตัว
- กรุณาเคารพลิขสิทธิ์ของเนื้อหาที่เล่น
- ไม่ควรนำไปใช้เชิงพาณิชย์

## 👨‍💻 Author


---

⭐ ถ้าโปรเจคนี้มีประโยชน์ อย่าลืมกด Star ด้วยนะ!
