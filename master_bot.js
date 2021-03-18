const request = require("request");
const sdk = require("matrix-bot-sdk");
const he = require("he");

const PantalaimonClient = sdk.PantalaimonClient;
const SimpleFsStorageProvider = sdk.SimpleFsStorageProvider;
const AutojoinRoomsMixin = sdk.AutojoinRoomsMixin;

var SlaveBot = require("./slave_bot");

module.exports = class MasterBot {
  constructor(
    serverUrl,
    homeServerHost,
    username,
    password,
    slaveBaseUserame,
    slaveBasePassword,
    slaveCnt
  ) {
    this.serverUrl = serverUrl;
    this.homeServerHost = homeServerHost;
    this.username = username;
    this.password = password;
    this.storage = new SimpleFsStorageProvider("bot_" + username + ".json");
    this.slaveBaseUserame = slaveBaseUserame;
    this.slaveBasePassword = slaveBasePassword;
    this.slaveCnt = slaveCnt;
    this.slaveList = [];
  }

  start() {
    this.connect();
    this.runSlaves();
  }

  connect() {
    this.pClient = new PantalaimonClient(this.serverUrl, this.storage);

    this.pClient
      .createClientWithCredentials(this.username, this.password)
      .then((matrixClient) => {
        this.client = matrixClient;

        this.client.start().then(() => {
          console.log("Client started!");
          this.afterClientInit(this.client);
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

      if (body.startsWith("!master")) {
        var cmdElements = body.split(" ");
        var cmdCnt = cmdElements.length;

        if (cmdCnt >= 2) {
          var cmd = cmdElements[1].trim();

          if (cmd == "runslaves") {
            this.runSlaves();
          }

          if (cmd == "hello") {
            client.sendMessage(roomId, {
              msgtype: "m.notice",
              body: "hello",
            });
          }

          if (cmd == "joinslaves") {
            for (var i = 0; i < this.slaveCnt; i++) {
              var slaveId =
                "@" + this.slaveBaseUserame + i + ":" + this.homeServerHost;

              client.inviteUser(slaveId, roomId).then((err, data) => {});
            }
          }

          if (cmd == "kickslaves") {
            for (var i = 0; i < this.slaveCnt; i++) {
              var slaveId =
                "@" + this.slaveBaseUserame + i + ":" + this.homeServerHost;

              client.kickUser(slaveId, roomId, "").then((err, data) => {});
            }
          }

          if (cmd == "start") {
            var roomName = cmdElements[2].trim();

            var slaveIds = [];
            for (var i = 0; i < this.slaveCnt; i++) {
              slaveIds.push(
                "@" + this.slaveBaseUserame + i + ":" + this.homeServerHost
              );
            }

            client
              .createRoom({
                name: roomName,
                visibility: "public",
                invite: slaveIds,
              })
              .then((err, data) => {
                client.sendMessage(roomId, {
                  msgtype: "m.notice",
                  body: "replyText",
                });
              });
          }
        }
      }
    });
  }

  runSlaves() {
    for (var i = 0; i < this.slaveCnt; i++) {
      var slave = new SlaveBot(
        this.serverUrl,
        this.slaveBaseUserame + i,
        this.slaveBasePassword
      );
      this.slaveList.push(slave);
      slave.connect();
    }
  }
};
