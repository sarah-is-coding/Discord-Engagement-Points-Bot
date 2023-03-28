// node index.js

require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client({
    intents: [
      Discord.GatewayIntentBits.Guilds,
      Discord.GatewayIntentBits.GuildMembers,
      Discord.GatewayIntentBits.GuildVoiceStates,
      Discord.GatewayIntentBits.GuildMessages
    ]
});

const PREFIX = '!';
const points = new Map();
const config = new Map();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('guildMemberAdd', (member) => {
  initializeConfig(member.guild.id);
  const initialPoints = config.get(member.guild.id).initialPoints;
  points.set(member.id, initialPoints);
  updateRole(member, config.get(member.guild.id));
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    if (oldState.member.user.bot) return;
  
    const joinedVoiceChannel = !oldState.channel && newState.channel;
    if (joinedVoiceChannel) {
      const guildConfig = config.get(newState.guild.id);
      addPoints(newState.member.id, guildConfig.voiceChannelJoinPoints);
      updateRole(newState.member, guildConfig);
    }
  });

client.on('message', async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith(PREFIX)) {
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'event') {
      if (message.member.hasPermission('MANAGE_ROLES')) {
        const userId = args[0].replace(/[<@!>]/g, '');
        addPoints(userId, config.get(message.guild.id).eventPoints);
        const member = message.guild.member(userId);
        updateRole(message.member, config.get(message.guild.id));
      }
    } 
    else if (command === 'points') {
      const currentPoints = points.get(message.author.id) || 0;
      message.channel.send(`${message.author.username}, you currently have ${currentPoints} points.`);
    }
    else if (command === 'config') {
        if (message.member.hasPermission('ADMINISTRATOR')) {
          const setting = args[0];
          const value = args[1];
  
          if (!config.has(message.guild.id)) {
            initializeConfig(message.guild.id);
          }
  
          const guildConfig = config.get(message.guild.id);
  
          if (setting === 'specialChannels' && value) {
            const channelName = value.startsWith('#') ? value.slice(1) : value;
            const channel = message.guild.channels.cache.find((ch) => ch.name === channelName);
  
            if (channel) {
              if (guildConfig.specialChannels.includes(channelName)) {
                guildConfig.specialChannels = guildConfig.specialChannels.filter((name) => name !== channelName);
              } else {
                guildConfig.specialChannels.push(channelName);
              }
              message.channel.send(`Updated special channels: ${guildConfig.specialChannels.join(', ')}`);
            } else {
              message.channel.send('Invalid channel name');
            }
          } else if (setting in guildConfig && !isNaN(parseInt(value))) {
            guildConfig[setting] = parseInt(value);
            message.channel.send(`Setting \`${setting}\` updated to ${value}`);
          } else {
            message.channel.send('Invalid setting or value');
          }
        }
      }
    } else {
        const guildConfig = config.get(message.guild.id);
        const today = new Date().toDateString();
        const userKey = `${message.author.id}-${today}`;
    
        if (!points.has(userKey)) {
          points.set(userKey, 0);
        }
    
        const userDailyPoints = points.get(userKey);
        if (userDailyPoints < guildConfig.maxDailyPoints) {
          let pointsToAdd = Math.min(guildConfig.messagePoints, guildConfig.maxDailyPoints - userDailyPoints);
    
          if (guildConfig.specialChannels.includes(message.channel.name)) {
            pointsToAdd = Math.min(guildConfig.specialMessagePoints, guildConfig.maxDailyPoints - userDailyPoints);
          }
    
          addPoints(message.author.id, pointsToAdd);
          points.set(userKey, userDailyPoints + pointsToAdd);
          updateRole(message.member, config.get(message.guild.id));
        }
      }
    });

  
  function initializeConfig(guildId) {
    if (!config.has(guildId)) {
      config.set(guildId, {
        initialPoints: 25,
        eventPoints: 30,
        messagePoints: 2,
        specialMessagePoints: 5,
        weeklyPointDeduction: 5,
        specialChannels: [],
        voiceChannelJoinPoints: 10,
        maxDailyPoints: 40,
        roleNames: {
          regular: 'Regulars',
          casual: 'Casuals',
          deeplyMissed: 'Deeply Missed',
        },
      });
    }
  }

function addPoints(userId, amount) {
  const currentPoints = points.get(userId) || 0;
  // points shouldn't dip below zero
  const newPoints = Math.max(currentPoints + pointsToAdd, 0);
  points.set(userId, currentPoints + amount);
}

function updateRole(member, guildConfig) {
  const currentPoints = points.get(member.id) || 0;
  const regularRole = member.guild.roles.cache.find((role) => role.name === guildConfig.roleNames.regular);
  const casualRole = member.guild.roles.cache.find((role) => role.name === guildConfig.roleNames.casual);
  const deeplyMissedRole = member.guild.roles.cache.find((role) => role.name === guildConfig.roleNames.deeplyMissed);
  
  if (currentPoints >= 100) {
    member.roles.add(regularRole);
    member.roles.remove(casualRole);
    member.roles.remove(deeplyMissedRole);
  } else if (currentPoints > 0) {
    member.roles.add(casualRole);
    member.roles.remove(regularRole);
    member.roles.remove(deeplyMissedRole);
} else {
  member.roles.add(deeplyMissedRole);
  member.roles.remove(regularRole);
  member.roles.remove(casualRole);
}
}

// Implement the weekly point deduction and role updates
setInterval(() => {
client.guilds.cache.forEach((guild) => {
  guild.members.cache.forEach((member) => {
    if (!member.user.bot) {
      addPoints(member.id, -config.get(guild.id).weeklyPointDeduction);
      updateRole(member, config.get(guild.id));
    }
  });
});
}, 1000 * 60 * 60 * 24 * 7); // 1000 ms * 60 s * 60 min * 24 h * 7 days

client.login(process.env.TOKEN);

