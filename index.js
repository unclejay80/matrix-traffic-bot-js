const request = require("request");
const sdk = require("matrix-bot-sdk");
const he = require("he");

const MatrixClient = sdk.MatrixClient;
const SimpleFsStorageProvider = sdk.SimpleFsStorageProvider;
const AutojoinRoomsMixin = sdk.AutojoinRoomsMixin;

const homeserverUrl = "https://matrix.org"; // make sure to update this with your url
const accessToken = process.env.TOKEN;

let intervalMap = new Map();

const storage = new SimpleFsStorageProvider("bot.json");

const client = new MatrixClient(homeserverUrl, accessToken, storage);

AutojoinRoomsMixin.setupOnClient(client);

client.start().then(() => console.log("Client started!"));

client.on("room.message", (roomId, event) => {
  if (!event["content"]) return;
  const sender = event["sender"];
  const body = event["content"]["body"];
  console.log(`${roomId}: ${sender} says '${body}`);

  if (body.startsWith("!echo")) {
    const replyText = body.substring("!echo".length).trim();
    client.sendMessage(roomId, {
      msgtype: "m.notice",
      body: replyText
    });
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
});

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
        value: he.decode(result.correct_answer)
      });

      optionsStr += "\n" + result.correct_answer;

      result.incorrect_answers.forEach(element => {
        optionsStr += "\n" + element;
        options.push({
          label: he.decode(element),
          value: he.decode(element)
        });
      });

      client.sendMessage(roomId, {
        label: question,
        type: "org.matrix.poll",
        msgtype: "org.matrix.options",
        options: options,
        body: "[Poll] " + question + optionsStr
      });
    }
  );
}
