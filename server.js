const http = require("http");
const fs = require("fs");

const { Player } = require("./game/class/player");
const { World } = require("./game/class/world");

const worldData = require("./game/data/basic-world-data");

let player;
let world = new World();
world.loadWorld(worldData);

const server = http.createServer((req, res) => {
  /* ============== ASSEMBLE THE REQUEST BODY AS A STRING =============== */
  let reqBody = "";
  req.on("data", (data) => {
    reqBody += data;
  });

  req.on("end", () => {
    // After the assembly of the request body is finished
    /* ==================== PARSE THE REQUEST BODY ====================== */
    if (reqBody) {
      req.body = reqBody
        .split("&")
        .map((keyValuePair) => keyValuePair.split("="))
        .map(([key, value]) => [key, value.replace(/\+/g, " ")])
        .map(([key, value]) => [key, decodeURIComponent(value)])
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
    }

    /* ======================== ROUTE HANDLERS ========================== */
    // Phase 1: GET /
    if (req.method === "GET" && req.url === "/") {
      const htmlPage = fs.readFileSync("views/new-player.html", "utf-8");

      let rooms = world.availableRoomsToString();
      const resBody = htmlPage.replace(/#{availableRooms}/g, `${rooms}`);

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      return res.end(resBody);
    }

    // Phase 2: POST /player
    if (req.method === "POST" && req.url === "/player") {
      const reqBody = req.body;

      let name = reqBody.name;
      let roomId = reqBody.roomId;
      let room = world.rooms[roomId];

      player = new Player(name, room);

      res.statusCode = 302;
      res.setHeader("Location", `/rooms/${roomId}`);
      return res.end();
    }

    // Type in your code before the route handler of Phase 3 to
    // redirect to the home page if there is no player
    if (!player) {
      return redirect(res, "/");
    }

    // Phase 3: GET /rooms/:roomId
    if (req.method === "GET" && req.url.startsWith("/rooms/")) {
      const urlParts = req.url.split("/");

      if (urlParts.length === 3) {
        const htmlPage = fs.readFileSync("views/room.html", "utf-8");

        let roomId = urlParts[2];
        let room = world.rooms[roomId];

        // If :roomId is not the roomId of the player"s current room,
        // redirect the client to the correct current room of the player
        if (room !== player.currentRoom) {
          return redirect(res, `/rooms/${player.currentRoom.id}`);
        }

        const resBody = htmlPage
          .replace(/#{roomName}/g, `${room.name}`)
          .replace(/#{roomId}/g, `${room.id}`)
          .replace(/#{roomItems}/g, `${room.itemsToString()}`)
          .replace(/#{inventory}/g, `${player.inventoryToString()}`)
          .replace(/#{exits}/g, `${room.exitsToString()}`);

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html");
        return res.end(resBody);
      }
    }

    // Phase 4: GET /rooms/:roomId/:direction
    if (req.method === "GET" && req.url.startsWith("/rooms/")) {
      const urlParts = req.url.split("/");

      if (urlParts.length === 4) {
        let roomId = urlParts[2];
        let room = world.rooms[roomId];

        // Just like in the previous phase, ... redirect
        if (room !== player.currentRoom) {
          return redirect(res, `/rooms/${player.currentRoom.id}`);
        }

        let direction = urlParts[3];
        // Implement a try/catch to redirect the player back
        // to the current room in case of errors!
        try {
          let newId = player.move(direction[0]).id;
          return redirect(res, `/rooms/${newId}`);
        } catch (error) {
          return redirect(res, `/rooms/${roomId}`);
        }
      }
    }

    // Phase 5: POST /items/:itemId/:action
    if (req.method === "POST" && req.url.startsWith("/items/")) {
      const urlParts = req.url.split("/");
      let itemId = urlParts[2];
      let action = urlParts[3];

      try {
        switch (action) {
          case "drop":
            player.dropItem(itemId);
            break;
          case "eat":
            player.eatItem(itemId);
            break;
          case "take":
            player.takeItem(itemId);
            break;
        }

        res.statusCode = 302;
        return redirect(res, `/rooms/${player.currentRoom.id}`);
      } catch (error) {
        const htmlPage = fs.readFileSync("./views/error.html", "utf-8");
        const resBody = htmlPage
          .replace(/#{errorMessage}/g, error.message)
          .replace(/#{roomId}/g, player.currentRoom.id);
        res.statusCode = 302;
        res.setHeader("Location", "views/error.html");
        return res.end(resBody);
      }
    }

    // Phase 6: Redirect if no matching route handlers
    res.statusCode = 302;
    return redirect(res, `/rooms/${player.currentRoom.id}`);
  });
});

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  return res.end();
}

const port = 5000;

server.listen(port, () => console.log("Server is listening on port", port));
