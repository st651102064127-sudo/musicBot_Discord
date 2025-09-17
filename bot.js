const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, demuxProbe, StreamType } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');
const { spawn } = require('child_process');
// Try to use ffmpeg-static, fallback to system ffmpeg
let ffmpegPath;
try {
    ffmpegPath = require('ffmpeg-static');
} catch (error) {
    console.log('ffmpeg-static not found, using system ffmpeg');
    ffmpegPath = 'ffmpeg'; // ใช้ ffmpeg ที่ติดตั้งในระบบ
}

class MusicBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates
            ]
        });

        this.queues = new Map(); // Guild ID -> Queue
        this.players = new Map(); // Guild ID -> Audio Player
        this.connections = new Map(); // Guild ID -> Voice Connection

        this.setupEvents();
    }

    setupEvents() {
        this.client.once('ready', () => {
            console.log(`🤖 ${this.client.user.tag} is ready!`);
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;

            const args = message.content.split(' ');
            const command = args[0].toLowerCase();

            switch (command) {
                case '!play':
                    await this.handlePlay(message, args.slice(1).join(' '));
                    break;
                case '!gui':
                    await this.showControlGUI(message);
                    break;
            }
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (interaction.isButton()) {
                await this.handleButtonInteraction(interaction);
            } else if (interaction.isStringSelectMenu()) {
                await this.handleSelectMenuInteraction(interaction);
            }
        });
    }

    async handlePlay(message, query) {
        if (!query) {
            return message.reply('❌ กรุณาใส่ชื่อเพลงที่ต้องการค้นหา!');
        }

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ คุณต้องเข้า Voice Channel ก่อน!');
        }

        try {
            // แสดงสถานะการค้นหา
            const searchMessage = await message.reply('🔍 กำลังค้นหาเพลง...');

            const searchResults = await ytSearch(query);
            const videos = searchResults.videos.slice(0, 5);

            if (videos.length === 0) {
                return searchMessage.edit('❌ ไม่พบเพลงที่ค้นหา!');
            }

            const embed = new EmbedBuilder()
                .setTitle('🎵 เลือกเพลงที่ต้องการ')
                .setDescription('กรุณาเลือกเพลงจากรายการด้านล่าง')
                .setColor('#FF0000')
                .setTimestamp();

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('song_select')
                .setPlaceholder('เลือกเพลง...');

            videos.forEach((video, index) => {
                embed.addFields({
                    name: `${index + 1}. ${video.title}`,
                    value: `**ช่อง:** ${video.author.name}\n**ระยะเวลา:** ${video.timestamp}\n**ยอดวิว:** ${this.formatViews(video.views)}`,
                    inline: false
                });

                selectMenu.addOptions({
                    label: video.title.length > 100 ? video.title.substring(0, 97) + '...' : video.title,
                    description: `${video.author.name} • ${video.timestamp}`,
                    value: `${index}_${video.videoId}`,
                    emoji: '🎵'
                });
            });

            const row = new ActionRowBuilder().addComponents(selectMenu);

            // Store search results temporarily
            if (!this.queues.has(message.guild.id)) {
                this.queues.set(message.guild.id, {
                    songs: [],
                    voiceChannel: voiceChannel,
                    textChannel: message.channel,
                    searchResults: videos,
                    nowPlaying: null
                });
            } else {
                this.queues.get(message.guild.id).searchResults = videos;
            }

            await searchMessage.edit({ content: null, embeds: [embed], components: [row] });

        } catch (error) {
            console.error('Error searching:', error);
            message.reply('❌ เกิดข้อผิดพลาดในการค้นหาเพลง!');
        }
    }

    formatViews(views) {
        if (views >= 1000000) {
            return (views / 1000000).toFixed(1) + 'M';
        } else if (views >= 1000) {
            return (views / 1000).toFixed(1) + 'K';
        }
        return views?.toString() || 'N/A';
    }

    async handleSelectMenuInteraction(interaction) {
        if (interaction.customId !== 'song_select') return;

        await interaction.deferReply();

        const [index, videoId] = interaction.values[0].split('_');
        const queue = this.queues.get(interaction.guild.id);
        
        if (!queue || !queue.searchResults) {
            return interaction.editReply({ content: '❌ เกิดข้อผิดพลาด!' });
        }

        const selectedSong = queue.searchResults[parseInt(index)];
        
        const song = {
            title: selectedSong.title,
            url: selectedSong.url,
            videoId: selectedSong.videoId,
            duration: selectedSong.timestamp,
            author: selectedSong.author.name,
            thumbnail: selectedSong.thumbnail,
            views: selectedSong.views,
            requestedBy: interaction.user
        };

        queue.songs.push(song);

        const embed = new EmbedBuilder()
            .setTitle('✅ เพิ่มเพลงในคิวแล้ว!')
            .setDescription(`**${song.title}**\nโดย: ${song.author}\nระยะเวลา: ${song.duration}`)
            .setThumbnail(song.thumbnail)
            .setColor('#00FF00')
            .addFields(
                { name: '📍 ตำแหน่งในคิว', value: `#${queue.songs.length}`, inline: true },
                { name: '👤 ขอโดย', value: interaction.user.displayName, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Update the original message to remove components
        try {
            await interaction.message.edit({ components: [] });
        } catch (error) {
            console.log('Could not edit original message');
        }

        if (!this.connections.has(interaction.guild.id)) {
            await this.joinChannel(queue.voiceChannel, interaction.guild.id);
        }

        if (queue.songs.length === 1 && !queue.nowPlaying) {
            await this.playNextSong(interaction.guild.id);
        }
    }

    async joinChannel(voiceChannel, guildId) {
        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guildId,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            this.connections.set(guildId, connection);

            connection.on(VoiceConnectionStatus.Disconnected, () => {
                setTimeout(() => {
                    if (connection.state.status === VoiceConnectionStatus.Disconnected) {
                        this.cleanup(guildId);
                    }
                }, 5000);
            });

            connection.on(VoiceConnectionStatus.Destroyed, () => {
                this.cleanup(guildId);
            });

            const player = createAudioPlayer();
            this.players.set(guildId, player);
            connection.subscribe(player);

            player.on(AudioPlayerStatus.Playing, () => {
                console.log('🎵 Audio player is now playing');
            });

            player.on(AudioPlayerStatus.Idle, () => {
                console.log('⏸️ Audio player is now idle');
                this.playNextSong(guildId);
            });

            player.on('error', (error) => {
                console.error('Player error:', error);
                const queue = this.queues.get(guildId);
                if (queue && queue.textChannel) {
                    queue.textChannel.send('❌ เกิดข้อผิดพลาดในการเล่นเพลง! กำลังเลื่อนไปเพลงถัดไป...');
                }
                this.playNextSong(guildId);
            });

            // เพิ่มการตรวจสอบ connection
            connection.on(VoiceConnectionStatus.Ready, () => {
                console.log('🔊 Voice connection is ready');
            });

            console.log(`✅ Joined voice channel in guild ${guildId}`);

        } catch (error) {
            console.error('Error joining channel:', error);
        }
    }

    async playNextSong(guildId) {
        const queue = this.queues.get(guildId);
        const player = this.players.get(guildId);

        if (!queue || !player) {
            return;
        }

        // เคลียร์เพลงปัจจุบัน
        queue.nowPlaying = null;

        if (queue.songs.length === 0) {
            // ไม่มีเพลงในคิว
            const embed = new EmbedBuilder()
                .setTitle('🎵 คิวเพลงหมดแล้ว')
                .setDescription('เพิ่มเพลงใหม่ด้วย `!play <ชื่อเพลง>`')
                .setColor('#FFA500');

            queue.textChannel.send({ embeds: [embed] });
            return;
        }

        const song = queue.songs.shift();
        queue.nowPlaying = song;

        try {
            console.log(`🎵 Playing: ${song.title}`);

            // Method 1: Try ytdl direct stream first (faster)
            let resource;
            try {
                const stream = ytdl(song.url, {
                    filter: 'audioonly',
                    quality: 'highestaudio',
                    highWaterMark: 1 << 25,
                });

                resource = createAudioResource(stream, {
                    inputType: StreamType.Arbitrary,
                    inlineVolume: true
                });

                console.log('✅ Using direct ytdl stream');
            } catch (ytdlError) {
                console.log('❌ Direct ytdl failed, trying FFmpeg...');
                // Method 2: Fallback to FFmpeg
                const ffmpegStream = this.createFFmpegStream(song.url);
                resource = createAudioResource(ffmpegStream, {
                    inputType: StreamType.Arbitrary,
                    inlineVolume: true
                });
                console.log('✅ Using FFmpeg stream');
            }

            player.play(resource);

            const embed = new EmbedBuilder()
                .setTitle('🎵 กำลังเล่น')
                .setDescription(`**${song.title}**`)
                .setThumbnail(song.thumbnail)
                .setColor('#0099FF')
                .addFields(
                    { name: '🎤 ศิลปิน', value: song.author, inline: true },
                    { name: '⏱️ ระยะเวลา', value: song.duration, inline: true },
                    { name: '👁️ ยอดวิว', value: this.formatViews(song.views), inline: true },
                    { name: '📋 เหลือในคิว', value: `${queue.songs.length} เพลง`, inline: true },
                    { name: '👤 ขอโดย', value: song.requestedBy.displayName, inline: true },
                    { name: '🔊 สถานะ', value: 'กำลังโหลด...', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'ใช้ !gui เพื่อควบคุมการเล่น' });

            const playingMessage = await queue.textChannel.send({ embeds: [embed] });

            // อัปเดตสถานะเมื่อเริ่มเล่น
            setTimeout(() => {
                const updatedEmbed = EmbedBuilder.from(embed)
                    .spliceFields(5, 1, { name: '🔊 สถานะ', value: 'กำลังเล่น ♪', inline: true });
                
                playingMessage.edit({ embeds: [updatedEmbed] }).catch(console.error);
            }, 2000);

        } catch (error) {
            console.error('Error playing song:', error);
            queue.textChannel.send(`❌ ไม่สามารถเล่นเพลง "${song.title}" ได้! กำลังเลื่อนไปเพลงถัดไป...`);
            this.playNextSong(guildId);
        }
    }

    async createFFmpegStream(url) {
        return new Promise((resolve, reject) => {
            // Get audio URL from ytdl
            ytdl.getInfo(url).then(info => {
                const audioFormat = ytdl.chooseFormat(info.formats, { 
                    quality: 'highestaudio',
                    filter: 'audioonly'
                });
                
                const ffmpegProcess = spawn(ffmpegPath, [
                    '-reconnect', '1',
                    '-reconnect_streamed', '1',
                    '-reconnect_delay_max', '5',
                    '-i', audioFormat.url,
                    '-analyzeduration', '0',
                    '-loglevel', '0',
                    '-f', 's16le',
                    '-ar', '48000',
                    '-ac', '2',
                    'pipe:1'
                ], {
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                ffmpegProcess.on('error', (error) => {
                    console.error('FFmpeg error:', error);
                    reject(error);
                });

                ffmpegProcess.stderr.on('data', (data) => {
                    console.log('FFmpeg stderr:', data.toString());
                });

                resolve(ffmpegProcess.stdout);
            }).catch(reject);
        });
    }

    async showControlGUI(message) {
        const queue = this.queues.get(message.guild.id);
        
        let description = 'ไม่มีเพลงในคิว';
        let color = '#9932CC';

        if (queue) {
            if (queue.nowPlaying) {
                description = `**กำลังเล่น:**\n🎵 ${queue.nowPlaying.title}\n\n`;
                color = '#00FF00';
            }
            
            if (queue.songs.length > 0) {
                description += `**คิว:** ${queue.songs.length} เพลง`;
            } else if (!queue.nowPlaying) {
                description = 'ไม่มีเพลงในคิว';
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('🎛️ ควบคุมเครื่องเล่นเพลง')
            .setDescription(description)
            .setColor(color)
            .setTimestamp();

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('pause_resume')
                    .setLabel('⏯️ หยุด/เล่น')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('skip')
                    .setLabel('⏭️ เลื่อนเพลง')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('stop')
                    .setLabel('⏹️ หยุดเพลง')
                    .setStyle(ButtonStyle.Danger)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('clear_queue')
                    .setLabel('🗑️ เคลียร์คิว')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('show_queue')
                    .setLabel('📜 แสดงคิว')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('leave')
                    .setLabel('👋 ออกจากช่อง')
                    .setStyle(ButtonStyle.Danger)
            );

        await message.reply({ embeds: [embed], components: [row1, row2] });
    }

    async handleButtonInteraction(interaction) {
        const guildId = interaction.guild.id;
        const queue = this.queues.get(guildId);
        const player = this.players.get(guildId);

        switch (interaction.customId) {
            case 'pause_resume':
                if (player) {
                    if (player.state.status === AudioPlayerStatus.Playing) {
                        player.pause();
                        await interaction.reply({ content: '⏸️ หยุดเพลงชั่วคราว', ephemeral: true });
                    } else if (player.state.status === AudioPlayerStatus.Paused) {
                        player.unpause();
                        await interaction.reply({ content: '▶️ เล่นเพลงต่อ', ephemeral: true });
                    } else {
                        await interaction.reply({ content: '❌ ไม่มีเพลงที่กำลังเล่น!', ephemeral: true });
                    }
                } else {
                    await interaction.reply({ content: '❌ ไม่มีเพลงที่กำลังเล่น!', ephemeral: true });
                }
                break;

            case 'skip':
                if (player && queue && (queue.nowPlaying || queue.songs.length > 0)) {
                    const skippedSong = queue.nowPlaying?.title || 'Unknown';
                    player.stop();
                    await interaction.reply({ content: `⏭️ เลื่อนจาก "${skippedSong}"`, ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ ไม่มีเพลงให้เลื่อน!', ephemeral: true });
                }
                break;

            case 'stop':
                if (player) {
                    player.stop();
                    if (queue) {
                        queue.songs = [];
                        queue.nowPlaying = null;
                    }
                    await interaction.reply({ content: '⏹️ หยุดเพลงและเคลียร์คิวแล้ว', ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ ไม่มีเพลงที่กำลังเล่น!', ephemeral: true });
                }
                break;

            case 'clear_queue':
                if (queue) {
                    queue.songs = [];
                    await interaction.reply({ content: '🗑️ เคลียร์คิวแล้ว', ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ ไม่มีคิว!', ephemeral: true });
                }
                break;

            case 'show_queue':
                if (queue && (queue.nowPlaying || queue.songs.length > 0)) {
                    let queueText = '';
                    
                    if (queue.nowPlaying) {
                        queueText += `**🎵 กำลังเล่น:**\n${queue.nowPlaying.title} - ${queue.nowPlaying.author}\n\n`;
                    }
                    
                    if (queue.songs.length > 0) {
                        queueText += '**📋 คิวถัดไป:**\n';
                        const queueList = queue.songs.slice(0, 10).map((song, index) => 
                            `${index + 1}. ${song.title} - ${song.author}`
                        ).join('\n');
                        queueText += queueList;
                        
                        if (queue.songs.length > 10) {
                            queueText += `\n... และอีก ${queue.songs.length - 10} เพลง`;
                        }
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('📜 คิวเพลง')
                        .setDescription(queueText || 'ไม่มีเพลงในคิว')
                        .setColor('#FFA500')
                        .setFooter({ text: `รวม ${queue.songs.length} เพลงในคิว` });

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ ไม่มีเพลงในคิว!', ephemeral: true });
                }
                break;

            case 'leave':
                this.cleanup(guildId);
                await interaction.reply({ content: '👋 ออกจากช่องเสียงแล้ว', ephemeral: true });
                break;
        }
    }

    cleanup(guildId) {
        const connection = this.connections.get(guildId);
        const player = this.players.get(guildId);
        const queue = this.queues.get(guildId);

        if (player) {
            player.stop();
            this.players.delete(guildId);
        }

        if (connection) {
            connection.destroy();
            this.connections.delete(guildId);
        }

        if (queue) {
            this.queues.delete(guildId);
        }

        console.log(`🧹 Cleaned up guild ${guildId}`);
    }

    start(token) {
        this.client.login(token);
    }
}

// การใช้งาน
const bot = new MusicBot();
bot.start('MTA0NDU1MTgxMTY2NDcxOTg3Mg.G2IQ4g.RESW1-nfeagGvlbi1t7VIx3-w-eRLaa-6LqZHY');

module.exports = MusicBot;