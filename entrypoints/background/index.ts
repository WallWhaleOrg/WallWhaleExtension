import { init } from "./utils/init";

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });
  // get from the local storage
  init();
});
