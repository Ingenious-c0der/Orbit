const crypto = require("crypto");
const Swarm = require("discovery-swarm");
const defaults = require("dat-swarm-defaults");
const net = require("net");
const readline = require("readline");

const peers = {};
let connSeq = 0;

const myId = crypto.randomBytes(32);
console.log('Your identity: ' + myId.toString('hex'));

let rl;

function log() {
  if (rl) {
    rl.clearLine();
    rl.close();
    rl = undefined;
  }
  for (let i = 0, len = arguments.length; i < len; i++) {
    console.log(arguments[i]);
  }
  askUser();
}

const askUser = async () => {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Send message: ', message => {
    for (let id in peers) {
      peers[id].conn.write(message);
    }
    rl.close();
    rl = undefined;
    askUser();
  });
};

const config = defaults({
  id: myId,
});

const sw = Swarm(config);

const getAvailablePort = () => {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => {
        resolve(port);
      });
    });
    server.on('error', reject);
  });
};

(async () => {
  try {
    const port = await getAvailablePort();
    sw.listen(port);
    console.log('Listening to port: ' + port);

    sw.join('our-fun-channel');

    sw.on('connection', (conn, info) => {
      const seq = connSeq;
      const peerId = info.id.toString('hex');
      log(`Connected #${seq} to peer: ${peerId}`);

      if (info.initiator) {
        try {
          conn.setKeepAlive(true, 600);
        } catch (exception) {
          log('exception', exception);
        }
      }

      conn.on('data', data => {
        log(
          'Received Message from peer ' + peerId,
          '----> ' + data.toString()
        );
      });

      conn.on('close', () => {
        log(`Connection ${seq} closed, peer id: ${peerId}`);
        if (peers[peerId].seq === seq) {
          delete peers[peerId];
        }
      });

      if (!peers[peerId]) {
        peers[peerId] = {};
      }
      peers[peerId].conn = conn;
      peers[peerId].seq = seq;
      connSeq++;
    });

    askUser();
  } catch (err) {
    console.error('Failed to get available port:', err);
  }
})();
