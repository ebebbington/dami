// deno-lint-ignore-file

// Pure NodeJS
function pureJsExample () {
  const net = require("net");
  const socket = new net.Socket();
  socket.setEncoding("ascii");
  socket.on("connect", function () {
    console.log("connected");
    socket.write("action: Login\r\nusername: admin\r\nsecret: mysecret\r\n\r\n");
    //var event = { event: 'Connect' };
    //self.emit(baseEvent + event.event, event);
  });
// @param {Error} error Fires right before the `close` event
  socket.on("error", function (error) {
    console.log("socket errored");
  });
// @param {Boolean} had_error If the connection closed from an error.
  socket.on("close", function (had_error) {
    console.log("socket closed");
  });
  socket.on("end", function () {
    console.log("ended");
  });
  socket.once("data", function (data) {
    console.log("got data");
    console.log(data);
    const a = "action: GetConfig\r\nActionID: 2345\r\nFilename: sip.conf\r\n\r\n";
    socket.write(a);
  });
  socket.on("data", (data) => {
    console.log("got other data");
    console.log(data);
  });
  socket.connect(5038, "0.0.0.0");
}

function namiExample () {
// NAMI
  const n = require('nami')
  const nami = new n.Nami({
    host: "0.0.0.0",
    port: 5038,
    username: "admin",
    secret: "mysecret"
  })
//const message = n.

  nami.on('namiConnected', function (event) {
    var action = new n.Actions.Command({ command: "sip show peers"});
    action.variables = {
      'Command': 'sip show peers',
      command: "sip show peers"
    };
    action.command = "sip show peers"
    action.Command = "sip show peers"
    nami.send(action, function(response) {
      console.log(response)
    });
  });
  nami.open();
}

//namiExample()
//pureJsExample()
