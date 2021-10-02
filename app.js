const TelegramBot = require('node-telegram-bot-api');
const base64url = require('base64url');
const {google} = require('googleapis');
const {PubSub} = require('@google-cloud/pubsub');
const intel = require('intel');
const fs = require('fs');

// replace the value below with the Telegram token you receive from @BotFather
const tokenBot = 'YOUR_BOT_TOKEN';

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(tokenBot, {polling: true});

//add handler for logs to file
intel.addHandler(new intel.handlers.File('logs.log'));

//auth in gmail api
try {
    const credentials =  JSON.parse(fs.readFileSync('./YOUR_CREDENTIALS.json'));
    const token =  JSON.parse(fs.readFileSync('./YOUR_TOKEN.json'));

    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client =  new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(token);
    var gmail = google.gmail({version: 'v1', auth: oAuth2Client});
} catch (err) {
    intel.error(new Date() + ' : ' + err);
}

//References an existing subscription
const subscriptionName = 'YOUR_SUBSCRIPTION';
const pubSubClient = new PubSub({projectId: 'YOUR_PROJECT_ID', keyFilename:"YOUR_KEY.json"});
const subscription = pubSubClient.subscription(subscriptionName);

async function  watch() {
    try {
        intel.info(new Date() + ' : bot started!');
        await gmail.users.watch({
            userId: 'me',
            topicName: 'YOUR_PROJECT_ID/topics/gmail',
            labelIds: ["INBOX"]
        });
    } catch (err) {
        intel.error(new Date() + ' : ' + err);
    }
}

// Create an event handler to handle messages
var last_msg_id ;
const messageHandler = async message  =>  {
    try {
        gmail.users.messages.list({
            userId: 'me',
            labelIds: ["INBOX"]
        }).then( data => {
            if (last_msg_id !==  data.data.messages[0].id){
                last_msg_id =  data.data.messages[0].id;
                intel.warn(new Date() + ' : ' + 'new message' + ':' + last_msg_id);
                gmail.users.messages.get({
                    userId: 'me',
                    id:  data.data.messages[0].id,
                }).then(  data => {
                    let payload =  data.data.payload;
                    if (payload) {
                        if (data.data.payload.body.data){
                            var mailBody = base64url.decode(data.data.payload.body.data);
                            if ( mailBody.length >= 200) {
                                mailBody = mailBody.substr(0, 200);
                                mailBody = mailBody + '...';
                            }
                        } else {
                            mailBody = data.data.snippet;
                            mailBody = mailBody + '...';
                        }
                        mailBody = mailBody.replace(/<br\/>/g, `
`);
                        mailBody = mailBody.replace(/<\/?[^>]+(>|$)/g, "");
                        mailBody = mailBody.replace(/&gt;/g, '>');
                        mailBody = mailBody.replace(/&lt;/g, '<');
                        mailBody = mailBody.replace(/&#39;/g, '`');
                        let headers = payload.headers;
                        let searchDate = 'Date';
                        let dateValue =  headers.find( date => date.name === searchDate).value;
                        let searchFrom = 'From';
                        let FromValue =  headers.find( from => from.name === searchFrom).value;
                        let searchSubject = 'Subject';
                        let SubjectValue =  headers.find( Subject => Subject.name === searchSubject).value || ' ';
                        let message = `🙆🏻‍♂️От: ${FromValue}
⏰Время: ${dateValue}
📎Тема: ${SubjectValue}
✏Сообщение:
${mailBody}`;
                        return bot.sendMessage(434085260, message);
                    } else {
                        intel.warn(new Date() + ' : ' + 'no data found!');
                    }
                });
            }
        });
    } catch (err) {
        intel.error(new Date() + ' : ' + err);
    }
    message.ack();
};

// Listen for new messages
watch().then(subscription.on('message', messageHandler));


// Listen for any kind of message. There are different kinds of messages.
bot.onText(/\/id/, (msg) => {
    const chatId = msg.chat.id;
    // send a message to the chat acknowledging receipt of their message
    bot.sendMessage(chatId, `id is ${chatId}`).catch(err => console.log(err));
});


