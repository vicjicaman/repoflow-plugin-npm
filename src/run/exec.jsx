import _ from "lodash";
import fs from "fs";
import path from "path";
import { exec, spawn, wait } from "@nebulario/core-process";

export const start = async (operation, params, cxt) => {
  const {
    performer,
    performer: { type },
    config: { cluster }
  } = params;

  const {
    payload,
    config: { cluster: performerCluster },
    code: {
      paths: {
        absolute: { folder }
      }
    },
    module: {
      iteration: { mode }
    }
  } = performer;

  const startCmd = "start:" + mode;

  const envFile = path.join(folder, ".env");
  fs.writeFileSync(envFile, payload);

  const runps = operation.spawn(
    "yarn",
    [startCmd],
    {
      cwd: folder
    },
    {},
    cxt
  );

  await runps.promise;
};
