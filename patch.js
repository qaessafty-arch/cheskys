const fs = require('fs');
let code = fs.readFileSync('src/context/RoomContext.tsx', 'utf8');
code = code.replace(
  "if (currentRoomRef.current?.status === 'waiting') {\n            console.warn(\"[RoomContext] Resetting currentRoom to null because docSnap does not exist\"); setCurrentRoom(null);\n          }",
  "if (currentRoomRef.current?.status === 'waiting') {\n            const timeSinceCreation = Date.now() - (new Date(currentRoomRef.current.createdAt).getTime() || 0);\n            if (timeSinceCreation > 15000) {\n              console.warn(\"[RoomContext] Resetting currentRoom to null because docSnap does not exist\");\n              setCurrentRoom(null);\n            } else {\n              console.warn(\"[RoomContext] docSnap does not exist, but room was just created. Bypassing reset.\");\n            }\n          }"
);
fs.writeFileSync('src/context/RoomContext.tsx', code);
