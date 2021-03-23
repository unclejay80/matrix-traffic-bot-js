const request = require("request");
const sdk = require("matrix-bot-sdk");
const he = require("he");
const fs = require("fs");

const LAST_SLAVE_ID = "LAST_SLAVE_ID";

const PantalaimonClient = sdk.PantalaimonClient;
const SimpleFsStorageProvider = sdk.SimpleFsStorageProvider;
const AutojoinRoomsMixin = sdk.AutojoinRoomsMixin;
const AdminApis = sdk.AdminApis;
const SynapseAdminApis = sdk.SynapseAdminApis;

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
    this.slaveList = new Map();
  }

  start() {
    this.connect();
    //this.runSlaves();
  }

  connect() {
    this.pClient = new PantalaimonClient(this.serverUrl, this.storage);

    this.pClient
      .createClientWithCredentials(this.username, this.password)
      .then((matrixClient) => {
        this.client = matrixClient;
        this.synapseAdminApis = new SynapseAdminApis(this.client);

        this.client.start().then(() => {
          console.log("Master started!");
          this.afterClientInit(this.client);
        });
      });
  }

  afterClientInit(client) {
    AutojoinRoomsMixin.setupOnClient(client);

    client.on("room.message", (roomId, event) => {
      this.handleEvent(roomId, event, client);
    });
  }

  async handleEvent(roomId, event, client) {
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

        if (cmd == "runslave") {
          this.runSingleSlave(parseInt(cmdElements[2]));
        }

        if (cmd == "hello") {
          client.sendMessage(roomId, {
            msgtype: "m.notice",
            body: "hello",
          });
        }

        if (cmd == "createslaves") {
          var slavesCreateCnt = parseInt(cmdElements[2]);

          var lastId = this.getLastSlaveId();

          for (var i = 1; i <= slavesCreateCnt; i++) {
            var nextId = lastId + i;
            var slaveId =
              "@" + this.slaveBaseUserame + nextId + ":" + this.homeServerHost;

            await this.synapseAdminApis
              .upsertUser(slaveId, {
                password: this.slaveBasePassword,
              })
              .then((err, data) => {
                console.log("slave " + slaveId + " created");
                this.runSingleSlave(nextId);
              });

            this.incLastSlaveId();
          }
        }

        if (cmd == "joinslaves") {
          client.getJoinedRoomMembers(roomId).then((members) => {
            this.slaveList.forEach((slave, id, map) => {
              var slaveId =
                "@" + this.slaveBaseUserame + id + ":" + this.homeServerHost;

              if (!members.includes(slaveId)) {
                client.inviteUser(slaveId, roomId).then((err, data) => {});
              }
            });
          });
        }

        if (cmd == "stopslaves") {
          this.slaveList.forEach((slave, key, map) => {
            slave.stop();
          });
          this.slaveList.clear();
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
  }

  getLastSlaveId() {
    var lastId = -1;
    try {
      lastId = parseInt(this.storage.readValue(LAST_SLAVE_ID));
    } catch {}
    if (isNaN(lastId)) {
      lastId = -1;
    }
    return lastId;
  }

  incLastSlaveId() {
    var lastId = this.getLastSlaveId() + 1;
    this.storage.storeValue(LAST_SLAVE_ID, lastId);
  }

  runSingleSlave(id) {
    if (this.slaveList.has(id)) {
      return;
    }

    var slave = new SlaveBot(
      this.serverUrl,
      this.slaveBaseUserame + id,
      this.slaveBasePassword
    );
    this.slaveList.set(id, slave);

    slave.connect();
  }

  runSlaves() {
    var slaveCnt = this.getLastSlaveId();
    for (var i = 0; i <= slaveCnt; i++) {
      this.runSingleSlave(i);
    }
  }
};
