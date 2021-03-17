const sdk = require("matrix-bot-sdk");

const PantalaimonClient = sdk.PantalaimonClient;
const SimpleFsStorageProvider = sdk.SimpleFsStorageProvider;
const AutojoinRoomsMixin = sdk.AutojoinRoomsMixin;

module.exports = class SlaveBot {
  constructor(serverUrl, username, password) {
    this.serverUrl = serverUrl;
    this.username = username;
    this.password = password;
    this.storage = new SimpleFsStorageProvider("bot_" + username + ".json");
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.pClient = new PantalaimonClient(this.serverUrl, this.storage);

      this.pClient
        .createClientWithCredentials(this.username, this.password)
        .then((matrixClient) => {
          this.client = matrixClient;

          this.client
            .start()
            .then(() => {
              console.log("Client started!");
              this.afterClientInit(this.client);
              resolve();
            })
            .catch((err) => {
              reject(err);
            });
        });
    });
  }

  afterClientInit(client) {
    AutojoinRoomsMixin.setupOnClient(client);

    client.on("room.message", (roomId, event) => {
      if (!event["content"]) {
        return;
      }
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
    });
  }
};
