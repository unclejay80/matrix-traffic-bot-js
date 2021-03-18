const sdk = require("matrix-bot-sdk");
var BaseBot = require("./base_bot");

module.exports = class SlaveBot extends (
  BaseBot
) {
  constructor(serverUrl, username, password) {
    super(serverUrl, username, password);
    this.intervalMap = new Map();
  }

  onRoomEvent(client, event, sender, roomId, body) {
    if (body.startsWith("!slave")) {
      var cmdElements = body.split(" ");
      var cmdCnt = cmdElements.length;

      if (cmdCnt >= 2) {
        var cmd = cmdElements[1].trim();

        this.handleSlaveCommand(client, roomId, cmd, cmdElements[2]);
      }
    }
  }

  handleSlaveCommand(client, roomId, cmd, parameter) {
    if (cmd == "echo" && parameter != undefined) {
      client.sendMessage(roomId, {
        msgtype: "m.notice",
        body: parameter,
      });
    }

    if (cmd == "text" && parameter != undefined) {
      const interval = parseInt(parameter) * 1000;
      if (interval == 0) {
        clearInterval(this.intervalMap.get(roomId));
      } else {
        const intervalHandle = setInterval(
          this.textIntervalHandler,
          interval,
          roomId,
          client
        );
        this.intervalMap.set(roomId, intervalHandle);
      }
    }
  }

  textIntervalHandler(roomId, client) {
    client.sendMessage(roomId, {
      msgtype: "m.notice",
      body: "parameter",
    });
  }
};
