import { Console } from "console";
import { init } from "./utils/init";
import { browser } from "wxt/browser";
import { downloadlistener } from "./utils/downloadslistener";

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });
  // get from the local storage
  init();
  console.log("Background initialized");
  downloadlistener();
});
