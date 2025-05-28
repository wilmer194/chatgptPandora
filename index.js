const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'page') {
    for (const entry of body.entry) {
      const webhook_event = entry.messaging[0];
      const sender_psid = webhook_event.sender.id;

      if (webhook_event.message && webhook_event.message.text) {
        const userMessage = webhook_event.message.text;
        const botResponse = await sendToChatGPT(userMessage);
        await sendMessage(sender_psid, botResponse);
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

async function sendToChatGPT(message) {
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: message }],
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error OpenAI:', error);
    return 'Lo siento, hubo un problema al procesar tu mensaje.';
  }
}

async function sendMessage(sender_psid, response) {
  try {
    await axios.post(`https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: sender_psid },
      message: { text: response },
    });
  } catch (error) {
    console.error('Error al enviar mensaje a Messenger:', error.response?.data || error);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
