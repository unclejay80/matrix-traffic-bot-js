const request = require("request");
const sdk = require("matrix-bot-sdk");
const he = require("he");
var MasterBot = require("./master_bot.js");

const PantalaimonClient = sdk.PantalaimonClient;
const SimpleFsStorageProvider = sdk.SimpleFsStorageProvider;
const AutojoinRoomsMixin = sdk.AutojoinRoomsMixin;

const homeserverUrl = process.env.SERVER_URL;

let intervalMap = new Map();

var client = null;

var masterBot = new MasterBot(
  homeserverUrl,
  process.env.HOMESERVER_HOST,
  process.env.USERNAME,
  process.env.PASSWORD,
  process.env.SLAVE_BASE_USERNAME,
  process.env.SLAVE_BASE_PASSWORD
);

masterBot.start();

/*
const pClient = new PantalaimonClient(homeserverUrl, storage);

pClient
  .createClientWithCredentials(process.env.USERNAME, process.env.PASSWORD)
  .then((matrixClient) => {
    client = matrixClient;

    client.start().then(() => {
      console.log("Client started!");
      afterClientInit(client);
    });
  });
*/
function afterClientInit(client) {
  AutojoinRoomsMixin.setupOnClient(client);

  client.on("room.message", (roomId, event) => {
    if (!event["content"]) return;
    const sender = event["sender"];
    const body = event["content"]["body"];
    console.log(`${roomId}: ${sender} says '${body}`);

    if (body.startsWith("!echo")) {
      const replyText = body.substring("!echo".length).trim();
      client.sendMessage(roomId, {
        msgtype: "m.notice",
        body: replyText,
      });
    }

    if (body.startsWith("!calc")) {
      const expression = body.substring("!calc".length).trim();
      doMath(roomId, event, expression);
    }

    if (body.startsWith("!poll")) {
      var cmdElements = body.split(" ");
      const arguments = cmdElements.length;
      if (arguments == 1) {
        sendRandomQuestion(roomId);
      } else if (arguments == 2) {
        const interval = parseInt(cmdElements[1]) * 1000;
        if (interval == 0) {
          clearInterval(intervalMap.get(roomId));
        } else {
          const intervalHandle = setInterval(
            pollIntervalHandler,
            interval,
            roomId
          );
          intervalMap.set(roomId, intervalHandle);
        }
      }
    }

    if (body.startsWith("!cam")) {
      sendWebcamImage(
        roomId,
        "https://livespotting.com/snapshots/LS_10vJe.jpg"
      );
    }
  });
}

function pollIntervalHandler(roomId) {
  sendRandomQuestion(roomId);
}

function sendRandomQuestion(roomId) {
  request(
    "https://opentdb.com/api.php?amount=1",
    { json: true },
    (err, res, body) => {
      if (err) {
        return console.log(err);
      }
      console.log(body.url);
      const result = body.results[0];
      const question = he.decode(result.question);
      var options = [];
      var optionsStr = "";
      options.push({
        label: he.decode(result.correct_answer),
        value: he.decode(result.correct_answer),
      });

      optionsStr += "\n" + result.correct_answer;

      result.incorrect_answers.forEach((element) => {
        optionsStr += "\n" + element;
        options.push({
          label: he.decode(element),
          value: he.decode(element),
        });
      });

      client.sendMessage(roomId, {
        label: question,
        type: "org.matrix.poll",
        msgtype: "org.matrix.options",
        options: options,
        body: "[Poll] " + question + optionsStr,
      });
    }
  );
}

function doMath(roomId, event, expression) {
  const url = "http://api.mathjs.org/v4/?expr=" + encodeURI(expression);
  request(url, (err, res, body) => {
    if (err) {
      return console.log(err);
    }
    client.replyText(roomId, event, body);
  });
}

function sendWebcamImage(roomId, url) {
  try {
    request(url, { encoding: null }, (err, res, body) => {
      if (err) {
        return console.log(err);
      }
      client.uploadContent(body, "image/jpeg", "test.jpg").then((mxcUri) => {
        client
          .sendMessage(roomId, {
            msgtype: "m.image",
            body: "",
            url: mxcUri,
          })
          .catch((err) => {
            console.log("caught", err.message);
          });
      });
    });
  } catch (error) {
    console.log(error);
  }
}
