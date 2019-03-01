
//imports
var mc = require('minecraft-protocol'); //duh
var fs = require('fs'); //to read creds file
var webserver = require('./webserver.js'); //to serve the webserver



var secrets = JSON.parse(fs.readFileSync('secrets.json'));


webserver.createServer(80);
webserver.onstart(function() {
    startQueuing();
});
webserver.onstop(function(){
    stop();
})

var proxyClient;
var client;
var server;

function stop(){
    client.end();
    if (proxyClient) {
        proxyClient.end("Stopped the proxy.");
    }
    server.close();
}

function startQueuing() {
    client = mc.createClient({
        host: "2b2t.org",
        port: 25565,
        username: secrets.username,
        password: secrets.password,
        version: "1.12.2"
      });
    var finishedQueue = false;
    client.on("packet", function(data,meta){
        if(!finishedQueue && meta.name === "playerlist_header"){
            var headermessage = JSON.parse(data.header);
            var positioninqueue = headermessage.text.split("\n")[5].substring(25);
            var ETA = headermessage.text.split("\n")[6].substring(27);
            webserver.queuePlace = positioninqueue;
            webserver.ETA = ETA;
            server.motd = "Place in queue: " +  positioninqueue;
        }
        if (!finishedQueue && meta.name === "chat") {
            var chatMessage = JSON.parse(data.message);
            if(chatMessage.text && chatMessage.text === "Connecting to the server..."){
                finishedQueue = true;
                webserver.queuePlace = "FINISHED";
                webserver.ETA = "NOW";
            }
        } 
    
        if (proxyClient) {
            filterPacketAndSend(data, meta, proxyClient);
        }
        // console.log("packet  meta: " + JSON.stringify(meta) +"\n\tdata: "+JSON.stringify(data));
    });
    
    
    
    
    server = mc.createServer({
        'online-mode':false,
        encryption:true,
        host:'0.0.0.0',
        port:25565,
        version:'1.12.2',
        maxPlayers: 1
    })
    
    server.on('login', function(newProxyClient){
        newProxyClient.write('login', {
            entityId: newProxyClient.id,
            levelType: 'default',
            gameMode: 0,
            dimension: 0,
            difficulty: 2,
            maxPlayers: server.maxPlayers,
            reducedDebugInfo: false
          });
        newProxyClient.write('position', {
            x: 0,
            y: 1.62,
            z: 0,
            yaw: 0,
            pitch: 0,
            flags: 0x00
          });
    
          newProxyClient.on('packet', function(data, meta){                    
              filterPacketAndSend(data, meta, client);
          })
    
        proxyClient = newProxyClient;
    });
}


function filterPacketAndSend(data, meta, dest) {
    if (meta.name !="keep_alive" && meta.name !="update_time") {
        dest.write(meta.name, data);
    }
}