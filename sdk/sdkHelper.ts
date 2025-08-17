import { CreateJobRequest } from "./sdk";

const buildJobreqoptions = (
  accountName: string,
  currentUrl: string,
  saveRoot?: string
): CreateJobRequest => {
  const returner: CreateJobRequest = {
    accountName: accountName,
    urlOrId: currentUrl,
  };
  if (saveRoot) {
    returner.saveRoot = saveRoot;
  }
  return returner;
};
