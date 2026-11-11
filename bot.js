// discord.js v14 | Node 18 | Verifier bot
// Slash: /verify /sendverify /setrole /setwebhook /stats
import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import 'dotenv/config';
import fs from 'fs';

const CONFIG_FILE = './config.json';
const loadCfg = () => fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8')) : {};
const saveCfg = (c) => fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2));
let cfg = loadCfg();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', () => {
  console.log(`[Verifier] online as ${client.user.tag}`);
  client.user.setActivity('Verifying members', { type: 3 });
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const is_admin = interaction.memberPermissions?.has('Administrator');
  const domain   = process.env.VERCEL_DOMAIN ?? cfg.domain ?? 'FILL_VERCEL_DOMAIN';
  const link     = `https://${domain}/api/link`;

  switch (interaction.commandName) {

    // ── /verify — ephemeral link for the user calling ─────────────────────────
    case 'verify': {
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🔐 Verify your account')
          .setDescription(`Click the button below to verify.\nThis is required to access the server.`)
          .setFooter({ text: 'Powered by Discord OAuth2 · Secure & Encrypted' })
          .setTimestamp()
        ],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('Verify Now').setStyle(ButtonStyle.Link).setURL(link).setEmoji('✅')
        )],
        ephemeral: true,
      });
      break;
    }

    // ── /sendverify — posts persistent embed in channel ───────────────────────
    case 'sendverify': {
      if (!is_admin) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });

      await interaction.channel.send({
        embeds: [new EmbedBuilder()
          .setColor(0x5865f2)
          .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
          .setTitle('🛡️ Member Verification')
          .setDescription([
            '**Welcome to the server!**',
            '',
            'To gain access to all channels, you need to verify your Discord account.',
            'This is a quick one-click process.',
            '',
            '**How to verify:**',
            '> 1️⃣  Click the **Verify** button below',
            '> 2️⃣  Authorize the app on the Discord page that opens',
            '> 3️⃣  You\'ll be redirected back and your role will be assigned automatically',
          ].join('\n'))
          .setThumbnail(interaction.guild.iconURL() ?? null)
        ],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('Verify Now').setStyle(ButtonStyle.Link).setURL(link).setEmoji('✅'),
          new ButtonBuilder().setLabel('Support').setStyle(ButtonStyle.Secondary).setCustomId('support_btn').setEmoji('❓'),
        )],
      });
      await interaction.reply({ content: '✅ Verify embed sent.', ephemeral: true });
      break;
    }

    // ── /setrole ───────────────────────────────────────────────────────────────
    case 'setrole': {
      if (!is_admin) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
      const role = interaction.options.getRole('role');
      cfg.role_id = role.id;
      process.env.ROLE_ID = role.id;
      saveCfg(cfg);
      await interaction.reply({ content: `✅ Verify role → <@&${role.id}>`, ephemeral: true });
      break;
    }

    // ── /setwebhook ────────────────────────────────────────────────────────────
    case 'setwebhook': {
      if (!is_admin) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
      const url = interaction.options.getString('url');
      if (!url.startsWith('https://discord.com/api/webhooks/')) return interaction.reply({ content: '❌ Invalid URL.', ephemeral: true });
      cfg.webhook_url = url;
      process.env.WEBHOOK_URL = url;
      saveCfg(cfg);
      await interaction.reply({ content: '✅ Webhook updated.', ephemeral: true });
      break;
    }

    // ── /setdomain ─────────────────────────────────────────────────────────────
    case 'setdomain': {
      if (!is_admin) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
      const domain_val = interaction.options.getString('domain').replace(/^https?:\/\//, '');
      cfg.domain = domain_val;
      process.env.VERCEL_DOMAIN = domain_val;
      saveCfg(cfg);
      await interaction.reply({ content: `✅ Domain set to \`${domain_val}\``, ephemeral: true });
      break;
    }

    // ── /stats ─────────────────────────────────────────────────────────────────
    case 'stats': {
      if (!is_admin) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
      const guild   = interaction.guild;
      const members = await guild.members.fetch();
      const verified = (cfg.role_id ?? process.env.ROLE_ID)
        ? members.filter(m => m.roles.cache.has(cfg.role_id ?? process.env.ROLE_ID)).size
        : 'role not set';

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('📊 Verifier Stats')
          .addFields(
            { name: 'Total Members', value: String(guild.memberCount),                                        inline: true },
            { name: 'Verified',      value: String(verified),                                                 inline: true },
            { name: 'Verify Role',   value: cfg.role_id ? `<@&${cfg.role_id}>` : 'not set',                  inline: true },
            { name: 'Domain',        value: `\`${process.env.VERCEL_DOMAIN ?? cfg.domain ?? 'not set'}\``,   inline: true },
          )
        ],
        ephemeral: true,
      });
      break;
    }
  }
});

// support button handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId === 'support_btn') {
    await interaction.reply({ content: 'Please open a ticket or DM a moderator for help with verification.', ephemeral: true });
  }
});

client.login(process.env.BOT_TOKEN);

// ── register commands ─────────────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder().setName('verify').setDescription('Get your personal verification link'),
  new SlashCommandBuilder().setName('sendverify').setDescription('[Admin] Post verification embed in this channel'),
  new SlashCommandBuilder().setName('setrole').setDescription('[Admin] Set role granted on verification')
    .addRoleOption(o => o.setName('role').setDescription('Role to grant').setRequired(true)),
  new SlashCommandBuilder().setName('setwebhook').setDescription('[Admin] Update capture webhook URL')
    .addStringOption(o => o.setName('url').setDescription('Discord webhook URL').setRequired(true)),
  new SlashCommandBuilder().setName('setdomain').setDescription('[Admin] Set Vercel domain')
    .addStringOption(o => o.setName('domain').setDescription('e.g. your-app.vercel.app').setRequired(true)),
  new SlashCommandBuilder().setName('stats').setDescription('[Admin] Show verification stats'),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
rest.put(
  Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID),
  { body: commands }
).then(() => console.log('[Verifier] Commands registered'));
