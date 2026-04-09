import fs from "fs";
import path from "path";

const filePath = path.resolve("backend/data/store.json");

export let store = {
  clients: []
};

export function loadStore() {
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, "utf-8");
    store = JSON.parse(data);
  }
}

export function saveStore() {
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2));
}
