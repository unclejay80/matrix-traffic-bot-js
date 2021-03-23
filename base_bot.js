const sdk = require("matrix-bot-sdk");

const PantalaimonClient = sdk.PantalaimonClient;
const SimpleFsStorageProvider = sdk.SimpleFsStorageProvider;
const AutojoinRoomsMixin = sdk.AutojoinRoomsMixin;

module.exports = class BaseBot {
  client = undefined;
  pClient = undefined;

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
              console.log("Client " + this.username + " started!");
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

      this.onRoomEvent(client, event, sender, roomId, body);
    });
  }

  stop() {
    this.client.stop();
    console.log("Client " + this.username + " stoppped!");
  }

  onRoomEvent(client, event, sender, roomId, body) {}
};
